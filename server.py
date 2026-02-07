from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from crewai import Agent, Task, Crew, LLM
from brandfetch_tool import BrandfetchTool
import os
from dotenv import load_dotenv
import uvicorn
import json
import re
import jwt
import bcrypt
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from database import save_brand, create_conversation, save_message, get_brand_by_domain, get_brands_by_conversation, get_all_brands, save_generated_content, get_generated_content_by_brand, get_generated_content_by_conversation, save_scheduled_post, get_scheduled_posts_by_conversation, get_due_scheduled_posts, update_scheduled_post_after_publish, save_conversation_x_account, get_conversation_x_account, create_user, get_user_by_username, save_video_generation_task, get_video_task_id, update_video_generation_status
from image_generator import generate_marketing_prompt, generate_ugc_image_nano_banana, upload_to_tmpfiles
from video_generator import start_video_generation, check_video_status
from twitter_utils import generate_caption_with_ai, post_to_twitter
from fastapi import UploadFile, File, Form
from datetime import datetime
from fastapi.staticfiles import StaticFiles
from pathlib import Path

load_dotenv()

scheduler = BackgroundScheduler()


def process_due_scheduled_posts():
    """Run by scheduler: post any due scheduled posts to X and update DB."""
    due = get_due_scheduled_posts()
    if not due:
        return
    for row in due:
        post_id = row["id"]
        image_url = row.get("generated_image_url")
        caption = (row.get("caption") or "").strip() or "Check this out!"
        if not image_url:
            update_scheduled_post_after_publish(post_id, False, error_message="Missing image URL")
            continue
        result = post_to_twitter(image_url, caption)
        if result.get("success"):
            update_scheduled_post_after_publish(post_id, True, post_url=result.get("post_url"))
        else:
            update_scheduled_post_after_publish(post_id, False, error_message=result.get("message", "Unknown error"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(process_due_scheduled_posts, "interval", minutes=1, id="scheduled_posts")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="IIT Gandhinagar Social Media Agent API", lifespan=lifespan)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads/products")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Serve uploaded files statically
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth: JWT and password hashing (bcrypt directly to avoid passlib/bcrypt version issues)
JWT_SECRET = os.getenv("JWT_SECRET", "brandpilot-secret-change-in-production")
JWT_ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)


def _password_bytes(password: str) -> bytes:
    """Bcrypt only supports passwords up to 72 bytes."""
    raw = (password or "").encode("utf-8")
    return raw[:72] if len(raw) > 72 else raw


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_password_bytes(password), password_hash.encode("utf-8"))
    except Exception:
        return False


def get_current_username(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract username from JWT. Raises 401 if missing or invalid."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("username")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# Configure LLM - Using Kie.ai API (Gemini 2.5 Flash via OpenAI-compatible endpoint)
llm = LLM(
    model="openai/gemini-2.5-flash",
    api_key=os.getenv("KIE_API_KEY"),
    base_url="https://api.kie.ai/gemini-2.5-flash/v1"
)

# Initialize the Brandfetch tool
brandfetch_tool_instance = BrandfetchTool(api_key=os.getenv("BRANDFETCH_API_KEY"))
brandfetch_tool = brandfetch_tool_instance.get_tool()

# Create the agent (GOJO - Router/Orchestrator)
brand_researcher = Agent(
    role="GOJO - Router and Platform Orchestrator",
    goal="Get the user's website URL for brand fetch, then guide them only to features we have implemented",
    backstory="""You are GOJO, the friendly router/orchestrator of IIT Gandhinagar Social Media Agent. You guide users through the platform without inventing features or giving step-by-step solutions.

    YOUR PRIMARY TASK:
    - Get the user's website URL (or domain/ticker/ISIN/crypto symbol) so we can run the brand fetch tool and save their brand to the database.
    - Use the Brandfetch tool ONLY when you have a clear website domain/ticker/ISIN/crypto symbol.
    - Do not talk about features or steps we have not implemented. Only mention what exists on the platform.

    WHAT WE HAVE IMPLEMENTED (only say these):
    1. Brand fetch: You collect their website URL and run brand analysis; the brand is saved to the database.
    2. Content Creation Dashboard: Where users find all their fetched brand information and can create content. Do NOT explain how to create content step-by-step; tell them to go to the Content Creation Dashboard.
    3. Social Media Manager: Where users can find all created assets and X (Twitter) account analytics—only when their X account is connected.

    STRICT RULES (avoid hallucinations):
    - For any content-related query (how to create content, how to make posts, what to post, etc.): Do NOT give solutions or tutorials. Tell them to go to the Content Creation Dashboard—all their fetched brand info is there and they can create content there.
    - When relevant, mention the Social Media Manager: created assets and X analytics (if X is connected).
    - Never describe tools, workflows, or features that are not listed above.
    - Be friendly, professional, and short. Redirect to the right place; do not teach how to do things.
    """,
    tools=[brandfetch_tool],
    llm=llm,
    verbose=True,
    allow_delegation=False
)


class ChatRequest(BaseModel):
    message: str
    conversation_id: str = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str  # same as username
    brand_synced: bool = False
    brand_id: int | None = None


class AuthRequest(BaseModel):
    username: str
    password: str


@app.post("/auth/signup")
async def signup(req: AuthRequest):
    """Register a new user. Creates user and a conversation keyed by username."""
    username = (req.username or "").strip()
    password = req.password or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="Username too short")
    user = get_user_by_username(username)
    if user:
        raise HTTPException(status_code=400, detail="Username already taken")
    password_hash = _hash_password(password)
    user_id = create_user(username, password_hash)
    if not user_id:
        raise HTTPException(status_code=400, detail="Username already taken")
    create_conversation(username)
    canonical = username.strip().lower()
    token = jwt.encode(
        {"username": canonical, "sub": str(user_id)},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    return {"token": token, "username": canonical}


@app.post("/auth/login")
async def login(req: AuthRequest):
    """Login and return JWT."""
    username = (req.username or "").strip()
    password = req.password or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    user = get_user_by_username(username)
    if not user or not _verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    canonical = user["username"]
    token = jwt.encode(
        {"username": canonical, "sub": str(user["id"])},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    return {"token": token, "username": canonical}


@app.get("/", response_class=HTMLResponse)
async def read_root():
    try:
        # Get the absolute path to index.html
        current_dir = os.path.dirname(os.path.abspath(__file__))
        html_path = os.path.join(current_dir, "index.html")
        
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Error: index.html not found</h1>", status_code=404)


def parse_brand_data_from_response(agent_response: str, raw_brandfetch_data: str = None):
    """Parse brand data from agent response and raw Brandfetch data"""
    brand_data = {}
    
    # Extract brand name
    name_match = re.search(r'\*\*Brand Name:\*\*\s*([^\n]+)', agent_response, re.IGNORECASE)
    if name_match:
        brand_data['brand_name'] = name_match.group(1).strip()
    
    # Extract logo URL
    logo_match = re.search(r'\*\*Logo URL:\*\*\s*(https?://[^\s\n]+)', agent_response, re.IGNORECASE)
    if logo_match:
        brand_data['logo_url'] = logo_match.group(1).strip()
    
    # Extract product/service
    product_match = re.search(r'\*\*Product/Service:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)', agent_response, re.IGNORECASE)
    if product_match:
        brand_data['product_service'] = product_match.group(1).strip()
    
    # Extract company vibe
    vibe_match = re.search(r'\*\*Company Vibe:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)', agent_response, re.IGNORECASE)
    if vibe_match:
        brand_data['company_vibe'] = vibe_match.group(1).strip()
    
    # Extract target audience
    audience_match = re.search(r'\*\*Target Audience:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)', agent_response, re.IGNORECASE)
    if audience_match:
        brand_data['target_audience'] = audience_match.group(1).strip()
    
    # Extract industry
    industry_match = re.search(r'\*\*Industry:\*\*\s*([^\n]+)', agent_response, re.IGNORECASE)
    if industry_match:
        brand_data['industry'] = industry_match.group(1).strip()
    
    # Extract domain from the user message or infer from brand name
    # Try to find domain in the response or use brand name as fallback
    if brand_data.get('brand_name'):
        # Try to extract domain from logo URL or social links
        if brand_data.get('logo_url') and 'brandfetch.io' in brand_data['logo_url']:
            # Domain might be in the conversation, use brand name as domain for now
            brand_data['domain'] = brand_data['brand_name'].lower().replace(' ', '') + '.com'
        else:
            brand_data['domain'] = brand_data['brand_name'].lower().replace(' ', '') + '.com'
    
    # Extract brand colors
    colors = []
    color_section = re.search(r'\*\*Brand Colors:\*\*\s*(.*?)(?:\*\*|$)', agent_response, re.IGNORECASE | re.DOTALL)
    if color_section:
        color_lines = color_section.group(1).strip().split('\n')
        for line in color_lines:
            hex_match = re.search(r'#([0-9a-fA-F]{6})', line)
            name_match = re.search(r'\(([^)]+)\)', line)
            if hex_match:
                colors.append({
                    'name': name_match.group(1) if name_match else 'primary',
                    'hex': '#' + hex_match.group(1)
                })
    brand_data['colors'] = colors
    
    # Extract social links
    social_links = []
    social_section = re.search(r'\*\*Social Media:\*\*\s*(.*?)(?:\*\*|✅|$)', agent_response, re.IGNORECASE | re.DOTALL)
    if social_section:
        social_lines = social_section.group(1).strip().split('\n')
        for line in social_lines:
            url_match = re.search(r'(https?://[^\s\)]+)', line)
            if url_match:
                url = url_match.group(1)
                platform = 'unknown'
                if 'twitter.com' in url or 'x.com' in url:
                    platform = 'twitter'
                elif 'instagram.com' in url:
                    platform = 'instagram'
                elif 'facebook.com' in url:
                    platform = 'facebook'
                elif 'linkedin.com' in url:
                    platform = 'linkedin'
                elif 'youtube.com' in url:
                    platform = 'youtube'
                elif 'tiktok.com' in url:
                    platform = 'tiktok'
                
                social_links.append({
                    'platform': platform,
                })
    brand_data['social_links'] = social_links
    
    return brand_data


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, username: str = Depends(get_current_username)):
    try:
        # Use authenticated username as conversation key
        conversation_id = username
        create_conversation(conversation_id)
        
        # Save user message
        save_message(conversation_id, "user", request.message)
        
        task = Task(
            description=f"""
            User message: {request.message}
            
            Context: You are GOJO, the router/orchestrator. Your main job is to get the website URL for the brand fetch tool. Only talk about what we have implemented. Do not give step-by-step solutions for creating or posting content—redirect to the right dashboard instead.
            
            Instructions:
            
            1. IF greeting or general question (hello, hi, what is this, what can you do):
               - Welcome them briefly to IIT Gandhinagar Social Media Agent
               - Ask for their website URL so we can run brand fetch and save their brand
               - DO NOT use any tools
            
            2. IF they provide a website/domain/ticker (nike.com, AAPL, etc):
               - Use Brandfetch tool to fetch brand data
               - Analyze and provide:
                 **Brand Name:** [name]
                 **Logo URL:** [primary logo URL]
                 **Product/Service:** [what they offer]
                 **Company Vibe:** [analyze colors/fonts/description]
                 **Target Audience:** [infer from positioning]
                 **Industry:** [sector]
                 **Brand Colors:** [list with hex codes]
                 **Social Media:** [links if available]
               - Say: "✅ BrandSync Complete! Your brand profile has been saved to our database."
               - Then: Tell them to go to the Content Creation Dashboard to see their fetched brand info and create content. Optionally mention the Social Media Manager for created assets and X analytics (when X is connected).
            
            3. IF they ask about brand but did not give a URL/identifier:
               - Politely ask for website URL, stock ticker, ISIN, or crypto symbol
            
            4. IF content-related (how to create content, how to post, what to post, make a post, create graphics/videos, etc):
               - Do NOT give tutorials or step-by-step solutions
               - Tell them: Go to the Content Creation Dashboard—all your fetched brand information is there and you can create content there
               - Optionally add: In the Social Media Manager you can find all created assets and X account analytics (if your X account is connected)
            
            5. IF they ask about posting, scheduling, or assets:
               - Tell them: Go to the Social Media Manager to see your created assets and X analytics (when X is connected). Do not explain how to post step-by-step.
            
            Only mention features we have: brand fetch (you), Content Creation Dashboard, Social Media Manager. Be brief and redirect; do not hallucinate features or give how-to solutions.
            """,
            agent=brand_researcher,
            expected_output="Brief response: either asking for website URL, brand analysis after fetch, or redirecting user to Content Creation Dashboard or Social Media Manager without giving step-by-step solutions."
        )
        
        crew = Crew(
            agents=[brand_researcher],
            tasks=[task],
            verbose=False
        )
        
        result = crew.kickoff()
        
        # CrewAI returns different result types - handle both
        if hasattr(result, 'raw'):
            response_text = str(result.raw)
        else:
            response_text = str(result)
        
        # Save assistant message
        save_message(conversation_id, "assistant", response_text)
        
        # Check if brand data was fetched (look for BrandSync Complete or brand analysis)
        brand_synced = False
        brand_id = None
        
        if "brandsync complete" in response_text.lower() or "brand name:" in response_text.lower():
            # Try to get raw Brandfetch data from tool output
            raw_brandfetch_data = None
            if hasattr(result, 'tasks_output') and result.tasks_output:
                for task_output in result.tasks_output:
                    if hasattr(task_output, 'raw') and task_output.raw:
                        # Check if this looks like Brandfetch JSON
                        if '"name"' in str(task_output.raw) and '"domain"' in str(task_output.raw):
                            raw_brandfetch_data = str(task_output.raw)
                            break
            
            # Parse brand data
            brand_data = parse_brand_data_from_response(response_text, raw_brandfetch_data)
            
            # Save to database if we have minimum required data
            if brand_data.get('brand_name') and brand_data.get('domain'):
                brand_id = save_brand(conversation_id, brand_data)
                if brand_id:
                    brand_synced = True
                    print(f"✅ Brand saved to database! ID: {brand_id}")
        
        return ChatResponse(
            response=response_text,
            conversation_id=conversation_id,
            brand_synced=brand_synced,
            brand_id=brand_id
        )
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Error in chat endpoint: {error_details}")
        err_msg = str(e).lower()
        # LLM provider down/maintenance (e.g. Kie.ai 500 "server is being maintained")
        if "maintained" in err_msg or "internal server error" in err_msg or "invalid response object" in err_msg:
            raise HTTPException(
                status_code=503,
                detail="The AI service is temporarily unavailable. Please try again in a few minutes.",
            )
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brands")
async def get_brands():
    """Get all saved brands"""
    try:
        brands = get_all_brands()
        return {"brands": brands}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brands/me")
async def get_my_brands(username: str = Depends(get_current_username)):
    """Get all brands for the authenticated user (username = conversation key)."""
    try:
        brands = get_brands_by_conversation(username)
        return {"brands": brands, "username": username}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brands/conversation/{conversation_id}")
async def get_conversation_brands(conversation_id: str, username: str = Depends(get_current_username)):
    """Get all brands for a conversation; only allowed for own username."""
    if conversation_id != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        brands = get_brands_by_conversation(conversation_id)
        return {"brands": brands, "conversation_id": conversation_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brands/{domain}")
async def get_brand(domain: str):
    """Get a specific brand by domain"""
    try:
        brand = get_brand_by_domain(domain)
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
        return brand
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brands/{brand_id}/details")
async def get_brand_details(brand_id: int):
    """Get detailed brand information by ID"""
    try:
        from database import get_connection
        from psycopg2.extras import RealDictCursor
        
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get brand with colors and social links
        cur.execute("""
            SELECT b.*,
                   array_agg(DISTINCT jsonb_build_object('name', bc.color_name, 'hex', bc.color_hex)) 
                   FILTER (WHERE bc.id IS NOT NULL) as colors,
                   array_agg(DISTINCT jsonb_build_object('platform', bs.platform, 'url', bs.url)) 
                   FILTER (WHERE bs.id IS NOT NULL) as social_links
            FROM brands b
            LEFT JOIN brand_colors bc ON b.id = bc.brand_id
            LEFT JOIN brand_social_links bs ON b.id = bs.brand_id
            WHERE b.id = %s
            GROUP BY b.id
        """, (brand_id,))
        
        brand = cur.fetchone()
        cur.close()
        conn.close()
        
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        return dict(brand)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-ugc")
async def generate_ugc_content(
    brand_id: int = Form(...),
    product_image: UploadFile = File(...),
    username: str = Depends(get_current_username),
):
    """Generate UGC marketing image for a brand"""
    try:
        # Get brand details
        from database import get_connection
        from psycopg2.extras import RealDictCursor
        
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT b.*,
                   COALESCE(array_agg(DISTINCT jsonb_build_object('name', bc.color_name, 'hex', bc.color_hex)) 
                   FILTER (WHERE bc.id IS NOT NULL), '{}') as colors
            FROM brands b
            LEFT JOIN brand_colors bc ON b.id = bc.brand_id
            WHERE b.id = %s
            GROUP BY b.id
        """, (brand_id,))
        
        brand = cur.fetchone()
        cur.close()
        conn.close()
        
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        brand_data = dict(brand)
        
        # Save uploaded product image
        import shutil
        from pathlib import Path
        import uuid
        
        # Generate unique filename
        file_extension = product_image.filename.split('.')[-1]
        unique_filename = f"{brand_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(product_image.file, buffer)
        
        print(f"💾 Product image saved locally: {file_path}")
        
        # Upload to tmpfiles.org to get public URL
        product_image_url = upload_to_tmpfiles(str(file_path))
        
        # Generate marketing image using Nano Banana Edit
        print(f"🎨 Generating marketing image for {brand_data['brand_name']}...")
        
        result = generate_ugc_image_nano_banana(product_image_url, brand_data)
        
        if not result['success']:
            raise HTTPException(status_code=500, detail="Image generation failed")
        
        generated_image_url = result['image_url']
        prompt = result['prompt']
        
        # Save to database (username = conversation key)
        content_id = save_generated_content(
            brand_id=brand_id,
            conversation_id=username,
            product_image_url=product_image_url,
            generated_image_url=generated_image_url,
            prompt_used=prompt
        )
        
        print(f"✅ Content saved to database! ID: {content_id}")
        
        return {
            "success": True,
            "content_id": content_id,
            "product_image_url": product_image_url,
            "generated_image_url": generated_image_url,
            "prompt": prompt,
            "task_id": result.get('task_id'),
            "cost_time_ms": result.get('cost_time')
        }
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error generating UGC: {error_trace}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-video")
async def generate_video_content(
    brand_id: int = Form(...),
    product_image: UploadFile = File(...),
    model: str = Form("veo3_fast"),  # veo3 or veo3_fast
    aspect_ratio: str = Form("9:16"),  # 16:9, 9:16, or Auto
    username: str = Depends(get_current_username),
):
    """Start video generation for a brand using Veo 3.1 API"""
    try:
        # Get brand details
        from database import get_connection
        from psycopg2.extras import RealDictCursor
        
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT b.*,
                   COALESCE(array_agg(DISTINCT jsonb_build_object('name', bc.color_name, 'hex', bc.color_hex)) 
                   FILTER (WHERE bc.id IS NOT NULL), '{}') as colors
            FROM brands b
            LEFT JOIN brand_colors bc ON b.id = bc.brand_id
            WHERE b.id = %s
            GROUP BY b.id
        """, (brand_id,))
        
        brand = cur.fetchone()
        cur.close()
        conn.close()
        
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        brand_data = dict(brand)
        
        # Save uploaded product image
        import shutil
        import uuid
        
        file_extension = product_image.filename.split('.')[-1]
        unique_filename = f"video_{brand_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(product_image.file, buffer)
        
        print(f"💾 Product image saved locally: {file_path}")
        
        # Upload to tmpfiles.org to get public URL
        product_image_url = upload_to_tmpfiles(str(file_path))
        
        # Start video generation (async - returns task ID immediately)
        print(f"🎬 Starting video generation for {brand_data['brand_name']}...")
        
        result = start_video_generation(product_image_url, brand_data, model, aspect_ratio)
        
        if not result['success']:
            raise HTTPException(status_code=500, detail=result.get('error', 'Video generation failed'))
        
        # Save to database with status='generating'
        content_id = save_video_generation_task(
            brand_id=brand_id,
            conversation_id=username,
            product_image_url=product_image_url,
            prompt_used=result['prompt'],
            video_task_id=result['task_id']
        )
        
        if not content_id:
            raise HTTPException(status_code=500, detail="Failed to save video task to database")
        
        print(f"✅ Video task saved to database! Content ID: {content_id}, Task ID: {result['task_id']}")
        
        return {
            "success": True,
            "content_id": content_id,
            "task_id": result['task_id'],
            "product_image_url": product_image_url,
            "prompt": result['prompt'],
            "message": "Video generation started. Poll /video-status/{content_id} for updates."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error starting video generation: {error_trace}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/video-status/{content_id}")
async def get_video_status(
    content_id: int,
    username: str = Depends(get_current_username),
):
    """Check the status of a video generation task"""
    try:
        # Get task info from database
        task_info = get_video_task_id(content_id)
        
        if not task_info:
            raise HTTPException(status_code=404, detail="Video task not found")
        
        # Verify ownership
        if task_info['conversation_id'] != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # If already completed or failed, return cached result
        if task_info['status'] == 'completed' and task_info['video_url']:
            return {
                "status": "completed",
                "video_url": task_info['video_url'],
                "content_id": content_id
            }
        elif task_info['status'] == 'failed':
            return {
                "status": "failed",
                "error": "Video generation failed",
                "content_id": content_id
            }
        
        # Otherwise, check with Veo API
        video_task_id = task_info['video_task_id']
        if not video_task_id:
            raise HTTPException(status_code=500, detail="Missing video task ID")
        
        status_result = check_video_status(video_task_id)
        
        if status_result['status'] == 'completed':
            # Update database with video URL
            video_url = status_result.get('video_url')
            update_video_generation_status(content_id, 'completed', video_url)
            
            return {
                "status": "completed",
                "video_url": video_url,
                "resolution": status_result.get('resolution', 'unknown'),
                "content_id": content_id
            }
        elif status_result['status'] == 'failed':
            # Update database with failed status
            update_video_generation_status(content_id, 'failed')
            
            return {
                "status": "failed",
                "error": status_result.get('error', 'Video generation failed'),
                "content_id": content_id
            }
        else:
            # Still generating
            return {
                "status": "generating",
                "message": "Video is still being generated. Please check again in 15-30 seconds.",
                "content_id": content_id
            }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error checking video status: {error_trace}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brands/{brand_id}/generated-content")
async def get_brand_generated_content(brand_id: int):
    """Get all generated content for a brand"""
    try:
        content = get_generated_content_by_brand(brand_id)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/generated-content/me")
async def get_my_generated_content(username: str = Depends(get_current_username)):
    """Get all generated content for the authenticated user."""
    try:
        content = get_generated_content_by_conversation(username)
        return {"content": content, "username": username}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/generated-content/conversation/{conversation_id}")
async def get_conversation_generated_content(conversation_id: str, username: str = Depends(get_current_username)):
    """Get all generated content for a conversation; only allowed for own username."""
    if conversation_id != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        content = get_generated_content_by_conversation(conversation_id)
        return {"content": content, "conversation_id": conversation_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-caption")
async def generate_caption(
    content_id: int = Form(...),
    brand_id: int = Form(...)
):
    """Generate AI caption for social media post"""
    try:
        # Get brand details
        from database import get_connection
        from psycopg2.extras import RealDictCursor
        
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT * FROM brands WHERE id = %s", (brand_id,))
        brand = cur.fetchone()
        cur.close()
        conn.close()
        
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        brand_data = dict(brand)
        
        # Generate caption
        caption = generate_caption_with_ai(brand_data)
        
        return {
            "success": True,
            "caption": caption
        }
        
    except Exception as e:
        import traceback
        print(f"Error generating caption: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/twitter/connect")
async def twitter_connect(username: str = Depends(get_current_username)):
    """Verify X (Twitter) connection and link it to the authenticated user."""
    import tweepy

    api_key = os.getenv("TWITTER_API_KEY")
    api_secret = os.getenv("TWITTER_API_SECRET")
    access_token = os.getenv("TWITTER_ACCESS_TOKEN")
    access_token_secret = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")

    if not all([api_key, api_secret, access_token, access_token_secret]):
        raise HTTPException(
            status_code=500,
            detail="Twitter credentials not configured (missing TWITTER_* in .env)",
        )

    try:
        auth = tweepy.OAuth1UserHandler(
            api_key, api_secret, access_token, access_token_secret
        )
        api = tweepy.API(auth)
        user = api.verify_credentials()
        x_username = user.screen_name
        name = getattr(user, "name", user.screen_name)
        x_user_id = str(user.id) if getattr(user, "id", None) else None

        create_conversation(username)
        save_conversation_x_account(username, x_username, x_user_id)

        return {
            "success": True,
            "username": x_username,
            "name": name,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@app.get("/twitter/connection")
async def twitter_connection(username: str = Depends(get_current_username)):
    """Return the X account linked to the authenticated user (if any)."""
    try:
        row = get_conversation_x_account(username)
        if not row or not row.get("x_username"):
            return {"connected": False}
        return {
            "connected": True,
            "username": row["x_username"],
            "user_id": row.get("x_user_id"),
        }
    except Exception as e:
        return {"connected": False}


@app.get("/twitter/user-insights")
async def twitter_user_insights(username: str):
    """Fetch X user profile and stats from TweetAPI for the connected user"""
    import requests as req

    api_key = os.getenv("TWEETAPI")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="TWEETAPI not configured in .env",
        )

    if not username or not username.strip():
        raise HTTPException(status_code=400, detail="username is required")

    username = username.strip().lstrip("@")

    try:
        r = req.get(
            "https://api.tweetapi.com/tw-v2/user/by-username",
            params={"username": username},
            headers={"X-API-Key": api_key},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        return data
    except req.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="User not found")
        try:
            err_body = e.response.json()
            raise HTTPException(
                status_code=e.response.status_code,
                detail=err_body.get("message", err_body.get("error", e.response.text)),
            )
        except Exception:
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except req.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"TweetAPI error: {str(e)}")


@app.get("/twitter/user-tweets")
async def twitter_user_tweets(user_id: str):
    """Fetch recent tweets by user from TweetAPI (tw-v2/user/tweets)."""
    import requests as req

    api_key = os.getenv("TWEETAPI")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="TWEETAPI not configured in .env",
        )

    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")

    user_id = user_id.strip()

    try:
        r = req.get(
            "https://api.tweetapi.com/tw-v2/user/tweets",
            params={"userId": user_id},
            headers={"X-API-Key": api_key},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        return data
    except req.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="User not found")
        try:
            err_body = e.response.json()
            raise HTTPException(
                status_code=e.response.status_code,
                detail=err_body.get("message", err_body.get("error", e.response.text)),
            )
        except Exception:
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except req.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"TweetAPI error: {str(e)}")


@app.post("/post-now")
async def post_now(
    content_id: int = Form(...),
    caption: str = Form(...),
    username: str = Depends(get_current_username),
):
    """Post immediately to X (Twitter) with the given content and caption."""
    try:
        from database import get_connection
        from psycopg2.extras import RealDictCursor

        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT gc.id, gc.generated_image_url
            FROM generated_content gc
            WHERE gc.id = %s AND gc.conversation_id = %s
            """,
            (content_id, username),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Content not found or access denied")
        image_url = row.get("generated_image_url")
        if not image_url:
            raise HTTPException(status_code=400, detail="Content has no image URL")
        result = post_to_twitter(image_url, (caption or "").strip() or "Check this out!")
        if not result.get("success"):
            raise HTTPException(status_code=502, detail=result.get("message", "Post failed"))
        return {
            "success": True,
            "post_url": result.get("post_url"),
            "message": result.get("message", "Posted successfully"),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in post-now: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/schedule-post")
async def schedule_post(
    content_id: int = Form(...),
    caption: str = Form(...),
    scheduled_time: str = Form(...),
    platform: str = Form("twitter"),
    username: str = Depends(get_current_username),
):
    """Schedule a social media post for the authenticated user."""
    try:
        scheduled_dt = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
        post_id = save_scheduled_post(
            content_id=content_id,
            conversation_id=username,
            caption=caption,
            scheduled_time=scheduled_dt,
            platform=platform
        )
        
        if not post_id:
            raise HTTPException(status_code=500, detail="Failed to schedule post")
        
        return {
            "success": True,
            "post_id": post_id,
            "message": "Post scheduled successfully"
        }
        
    except Exception as e:
        import traceback
        print(f"Error scheduling post: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scheduled-posts/me")
async def get_my_scheduled_posts(username: str = Depends(get_current_username)):
    """Get all scheduled posts for the authenticated user."""
    try:
        posts = get_scheduled_posts_by_conversation(username)
        return {"posts": posts, "username": username}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scheduled-posts/conversation/{conversation_id}")
async def get_conversation_scheduled_posts(conversation_id: str, username: str = Depends(get_current_username)):
    """Get scheduled posts for a conversation; only allowed for own username."""
    if conversation_id != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        posts = get_scheduled_posts_by_conversation(conversation_id)
        return {"posts": posts, "conversation_id": conversation_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
