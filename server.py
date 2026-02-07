from fastapi import FastAPI, HTTPException
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
from database import save_brand, create_conversation, save_message, get_brand_by_domain, get_brands_by_conversation, get_all_brands, save_generated_content, get_generated_content_by_brand, get_generated_content_by_conversation, save_scheduled_post, get_scheduled_posts_by_conversation, save_conversation_x_account, get_conversation_x_account
from image_generator import generate_marketing_prompt, generate_ugc_image_nano_banana, upload_to_tmpfiles
from twitter_utils import generate_caption_with_ai, post_to_twitter
from fastapi import UploadFile, File, Form
from datetime import datetime
from fastapi.staticfiles import StaticFiles
from pathlib import Path

load_dotenv()

app = FastAPI(title="IIT Gandhinagar Social Media Agent API")

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads/products")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Serve uploaded files statically
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure LLM - Using Kie.ai API (Gemini 2.5 Flash via OpenAI-compatible endpoint)
llm = LLM(
    model="openai/gemini-2.5-flash",
    api_key=os.getenv("KIE_API_KEY"),
    base_url="https://api.kie.ai/gemini-2.5-flash/v1"
)

# Initialize the Brandfetch tool
brandfetch_tool_instance = BrandfetchTool(api_key=os.getenv("BRANDFETCH_API_KEY"))
brandfetch_tool = brandfetch_tool_instance.get_tool()

# Create the agent
brand_researcher = Agent(
    role="Brand Research Specialist and Platform Orchestrator",
    goal="Welcome users to BrandSync platform, analyze their brand, and guide them to specialized agents",
    backstory="""You are the friendly orchestrator of IIT Gandhinagar Social Media Agent - an AI-powered content automation platform.
    
    YOUR PLATFORM:
    IIT Gandhinagar Social Media Agent helps businesses automate their marketing content creation and social media management through 2 specialized AI agents:
    1. Brand Research Agent (YOU) - Analyzes brand identity, colors, vibe, target audience
    2. Content Creator Agent - Generates videos, graphics, and captions aligned with brand
    
    YOUR ROLE:
    - Welcome users warmly and explain what IIT Gandhinagar Social Media Agent does
    - Ask for their website URL to perform BrandSync
    - Use Brandfetch tool ONLY when you have a clear website domain/ticker/ISIN/crypto symbol
    - Analyze the brand data to determine: product/service, company vibe, target audience, industry
    - After successful BrandSync, inform them their brand is stored in the database
    - Introduce them to the Content Creator agent
    
    CONVERSATION STYLE:
    - Be friendly, professional, and enthusiastic
    - For greetings, respond naturally and explain the platform
    - Only use Brandfetch when you have a specific identifier
    - After brand analysis, celebrate the completion and guide next steps
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
    conversation_id: str
    brand_synced: bool = False
    brand_id: int | None = None


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
async def chat(request: ChatRequest):
    try:
        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or f"conv_{os.urandom(8).hex()}"
        
        # Create conversation in DB
        create_conversation(conversation_id)
        
        # Save user message
        save_message(conversation_id, "user", request.message)
        
        task = Task(
            description=f"""
            User message: {request.message}
            
            Context: You are the orchestrator of IIT Gandhinagar Social Media Agent platform - an AI-powered content automation system.
            
            Instructions based on user message:
            
            1. IF greeting/general question (hello, hi, what is this, what can you do):
               - Welcome them to IIT Gandhinagar Social Media Agent
               - Explain: "IIT Gandhinagar Social Media Agent automates your marketing content creation. We have 2 AI agents:
                 • Brand Research Agent (me) - Analyzes your brand identity
                 • Content Creator Agent - Generates videos, graphics, and captions"
               - Ask for their website URL to start BrandSync
               - DO NOT use any tools
            
            2. IF they provide a website/domain/ticker (nike.com, AAPL, etc):
               - Use Brandfetch tool to fetch brand data
               - Analyze and provide:
                 **Brand Name:** [name]
                 **Logo URL:** [primary logo URL]
                 **Product/Service:** [what they offer]
                 **Company Vibe:** [analyze colors/fonts/description - e.g., "Modern & Innovative"]
                 **Target Audience:** [infer from positioning]
                 **Industry:** [sector]
                 **Brand Colors:** [list with hex codes]
                 **Social Media:** [links if available]
               - After analysis, say: "✅ BrandSync Complete! Your brand profile has been saved to our database."
               - Then introduce next steps: "Now you can use our Content Creator Agent to generate brand-consistent content!"
            
            3. IF asking about brand but no identifier:
               - Politely ask for website URL, stock ticker, ISIN, or crypto symbol
            
            Be conversational, enthusiastic, and helpful!
            """,
            agent=brand_researcher,
            expected_output="Welcoming response, brand analysis with insights, or guidance to next steps."
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
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Error in chat endpoint: {error_details}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brands")
async def get_brands():
    """Get all saved brands"""
    try:
        brands = get_all_brands()
        return {"brands": brands}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brands/conversation/{conversation_id}")
async def get_conversation_brands(conversation_id: str):
    """Get all brands for a specific conversation"""
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
    conversation_id: str = Form(...),
    product_image: UploadFile = File(...)
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
        
        # Save to database
        content_id = save_generated_content(
            brand_id=brand_id,
            conversation_id=conversation_id,
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


@app.get("/brands/{brand_id}/generated-content")
async def get_brand_generated_content(brand_id: int):
    """Get all generated content for a brand"""
    try:
        content = get_generated_content_by_brand(brand_id)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/generated-content/conversation/{conversation_id}")
async def get_conversation_generated_content(conversation_id: str):
    """Get all generated content for a conversation"""
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
async def twitter_connect(conversation_id: str = None):
    """Verify X (Twitter) connection and optionally link it to a conversation for persistence."""
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
        username = user.screen_name
        name = getattr(user, "name", user.screen_name)
        x_user_id = str(user.id) if getattr(user, "id", None) else None

        if conversation_id and conversation_id.strip():
            create_conversation(conversation_id.strip())
            save_conversation_x_account(conversation_id.strip(), username, x_user_id)

        return {
            "success": True,
            "username": username,
            "name": name,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@app.get("/twitter/connection")
async def twitter_connection(conversation_id: str):
    """Return the X account linked to this conversation (if any) so the frontend can restore state."""
    if not conversation_id or not conversation_id.strip():
        return {"connected": False}
    try:
        row = get_conversation_x_account(conversation_id.strip())
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


@app.post("/schedule-post")
async def schedule_post(
    content_id: int = Form(...),
    conversation_id: str = Form(...),
    caption: str = Form(...),
    scheduled_time: str = Form(...),
    platform: str = Form("twitter")
):
    """Schedule a social media post"""
    try:
        # Parse scheduled time
        scheduled_dt = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
        
        # Save to database
        post_id = save_scheduled_post(
            content_id=content_id,
            conversation_id=conversation_id,
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


@app.get("/scheduled-posts/conversation/{conversation_id}")
async def get_conversation_scheduled_posts(conversation_id: str):
    """Get all scheduled posts for a conversation"""
    try:
        posts = get_scheduled_posts_by_conversation(conversation_id)
        return {"posts": posts, "conversation_id": conversation_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
