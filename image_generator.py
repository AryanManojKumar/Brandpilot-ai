import os
import requests
import time
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

load_dotenv()


def generate_marketing_prompt(brand_data):
    """Generate marketing image prompt with brand name for Nano Banana Edit"""
    primary_color = brand_data.get('colors', [{}])[0].get('hex', '#FF6B00') if brand_data.get('colors') else '#FF6B00'
    brand_name = brand_data.get('brand_name', 'Brand')
    company_vibe = brand_data.get('company_vibe', 'Professional and modern')
    
    prompt = f"""Transform this product image into a professional marketing graphic for social media.

REQUIREMENTS:
- Add the brand name "{brand_name}" prominently in bold, modern typography
- Create a lifestyle scene with a person naturally holding/using the product
- Style: {company_vibe}, Instagram-worthy, authentic UGC aesthetic
- Use brand color {primary_color} as an accent in the design
- Add subtle design elements (shapes, gradients) that complement the brand
- Natural lighting, clean background
- The person should look genuine and happy, not like a professional model
- Make it look like a high-quality social media post

TEXT TO ADD:
- Brand name: "{brand_name}" (large, bold, prominent)
- Optional tagline area at bottom

STYLE:
- Modern, clean, professional
- {company_vibe}
- Social media ready (Instagram/Facebook)
- Eye-catching but authentic

OUTPUT: A complete marketing graphic with the product, person, and brand name clearly visible."""
    
    return prompt


def generate_ugc_image_nano_banana(product_image_url: str, brand_data: dict):
    """Generate UGC image prompt from brand data"""
    primary_color = brand_data.get('colors', [{}])[0].get('hex', '#000000') if brand_data.get('colors') else '#000000'
    
    prompt = f"""Create a high-quality UGC (user-generated content) marketing image featuring this product.

STYLE: Authentic lifestyle photography, natural and relatable, Instagram-worthy aesthetic

SCENE: A person naturally holding or using the product in a real-life setting. The person should look genuine and happy, not like a professional model. Casual, everyday environment.

BRAND IDENTITY:
- Brand: {brand_data.get('brand_name', 'Unknown')}
- Vibe: {brand_data.get('company_vibe', 'Professional and modern')}
- Industry: {brand_data.get('industry', 'General')}
- Primary Color: {primary_color}

REQUIREMENTS:
- Natural lighting (soft, warm, inviting)
- Shallow depth of field (product in focus, background slightly blurred)
- Authentic expression (genuine smile, natural pose)
- Clean, uncluttered background
- Product clearly visible and recognizable
- {brand_data.get('company_vibe', 'Professional')} aesthetic throughout

AVOID:
- Overly staged or artificial poses
- Professional studio lighting
- Stock photo appearance
- Cluttered backgrounds
- Multiple products

OUTPUT: Photorealistic, high-resolution image suitable for social media marketing."""
    
    return prompt


def add_brand_overlay(image_url: str, brand_data: dict, output_path: str):
    """
    Add brand logo and name overlay to generated image
    """
    print(f"🎨 Adding brand overlay...")
    
    # Download the generated image
    response = requests.get(image_url)
    response.raise_for_status()
    img = Image.open(BytesIO(response.content))
    
    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    width, height = img.size
    
    # Create overlay layer
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # Get brand color (default to white if not available)
    brand_color = '#FFFFFF'
    if brand_data.get('colors') and len(brand_data['colors']) > 0:
        brand_color = brand_data['colors'][0].get('hex', '#FFFFFF')
    
    # Add logo if available
    logo_added = False
    logo_url = brand_data.get('logo_url')
    
    if logo_url:
        try:
            # Download logo
            logo_response = requests.get(logo_url, timeout=5)
            if logo_response.status_code == 200:
                logo = Image.open(BytesIO(logo_response.content))
                
                # Resize logo to fit (max 150px width)
                logo_max_width = min(150, width // 4)
                logo_ratio = logo_max_width / logo.width
                logo_new_height = int(logo.height * logo_ratio)
                logo = logo.resize((logo_max_width, logo_new_height), Image.Resampling.LANCZOS)
                
                # Convert logo to RGBA
                if logo.mode != 'RGBA':
                    logo = logo.convert('RGBA')
                
                # Position logo in top-left corner with padding
                logo_x = 20
                logo_y = 20
                
                # Add white background behind logo for visibility
                logo_bg = Image.new('RGBA', (logo.width + 20, logo.height + 20), (255, 255, 255, 200))
                overlay.paste(logo_bg, (logo_x - 10, logo_y - 10), logo_bg)
                overlay.paste(logo, (logo_x, logo_y), logo)
                
                logo_added = True
                print(f"✅ Logo added")
        except Exception as e:
            print(f"⚠️  Could not add logo: {e}")
    
    # Add brand name at bottom
    brand_name = brand_data.get('brand_name', 'Brand')
    
    # Try to load a nice font, fallback to default
    try:
        # Try to use a system font
        font_size = max(24, height // 25)
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("Arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    # Get text size
    bbox = draw.textbbox((0, 0), brand_name, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Position text at bottom center
    text_x = (width - text_width) // 2
    text_y = height - text_height - 30
    
    # Add semi-transparent background behind text
    padding = 15
    bg_rect = [
        text_x - padding,
        text_y - padding,
        text_x + text_width + padding,
        text_y + text_height + padding
    ]
    draw.rounded_rectangle(bg_rect, radius=10, fill=(0, 0, 0, 180))
    
    # Draw brand name
    draw.text((text_x, text_y), brand_name, fill='white', font=font)
    
    print(f"✅ Brand name added: {brand_name}")
    
    # Composite overlay onto original image
    final_img = Image.alpha_composite(img, overlay)
    
    # Convert back to RGB for saving as JPEG
    final_img = final_img.convert('RGB')
    
    # Save
    final_img.save(output_path, 'JPEG', quality=95)
    print(f"💾 Final image saved: {output_path}")
    
    return output_path


def upload_to_tmpfiles(file_path: str):
    """Upload image to tmpfiles.org and get public URL"""
    url = "https://tmpfiles.org/api/v1/upload"
    
    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(url, files=files)
        response.raise_for_status()
    
    result = response.json()
    
    if result.get('status') == 'success':
        # tmpfiles.org returns URL like: https://tmpfiles.org/12345
        # We need to convert it to direct download URL: https://tmpfiles.org/dl/12345
        temp_url = result['data']['url']
        # Convert to direct download URL
        public_url = temp_url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
        print(f"📤 Image uploaded to tmpfiles.org: {public_url}")
        return public_url
    else:
        raise Exception(f"Failed to upload to tmpfiles.org: {result}")


def generate_ugc_image_nano_banana(product_image_url: str, brand_data: dict):
    """
    Generate marketing image using Kie.ai Nano Banana Edit API
    """
    api_key = os.getenv("KIE_API_KEY")
    if not api_key:
        raise ValueError("KIE_API_KEY not found in environment variables")
    
    # Generate marketing prompt
    prompt = generate_marketing_prompt(brand_data)
    
    # Step 1: Create task
    create_url = "https://api.kie.ai/api/v1/jobs/createTask"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "google/nano-banana-edit",
        "input": {
            "prompt": prompt,
            "image_urls": [product_image_url],
            "output_format": "png",
            "image_size": "1:1"
        }
    }
    
    print(f"🎨 Creating marketing image with Nano Banana Edit...")
    print(f"📸 Product image: {product_image_url}")
    print(f"📝 Prompt: {prompt[:150]}...")
    
    response = requests.post(create_url, headers=headers, json=payload)
    response.raise_for_status()
    
    result = response.json()
    
    if result.get('code') != 200:
        raise Exception(f"Failed to create task: {result.get('msg')}")
    
    task_id = result['data']['taskId']
    print(f"✅ Task created: {task_id}")
    
    # Step 2: Poll for results
    query_url = f"https://api.kie.ai/api/v1/jobs/recordInfo?taskId={task_id}"
    max_attempts = 60
    attempt = 0
    
    while attempt < max_attempts:
        attempt += 1
        time.sleep(2)
        
        print(f"⏳ Checking status... (attempt {attempt}/{max_attempts})")
        
        status_response = requests.get(query_url, headers=headers)
        status_response.raise_for_status()
        
        status_data = status_response.json()
        
        if status_data.get('code') != 200:
            raise Exception(f"Failed to query task: {status_data.get('msg')}")
        
        task_data = status_data['data']
        state = task_data['state']
        
        if state == 'success':
            import json
            result_json = json.loads(task_data['resultJson'])
            generated_image_url = result_json['resultUrls'][0]
            
            print(f"✅ Marketing image generated successfully!")
            print(f"🖼️  URL: {generated_image_url}")
            
            return {
                'success': True,
                'image_url': generated_image_url,
                'task_id': task_id,
                'cost_time': task_data.get('costTime'),
                'prompt': prompt
            }
        
        elif state == 'fail':
            fail_msg = task_data.get('failMsg', 'Unknown error')
            fail_code = task_data.get('failCode', 'N/A')
            raise Exception(f"Image generation failed: [{fail_code}] {fail_msg}")
        
        elif state == 'waiting':
            continue
    
    raise Exception(f"Image generation timed out after {max_attempts * 2} seconds")


def generate_ugc_prompt(brand_data):
    """Legacy function - kept for compatibility"""
    return generate_marketing_prompt(brand_data)
    """
    Generate UGC image using Kie.ai Flex Image To Image API
    """
    api_key = os.getenv("KIE_API_KEY")
    if not api_key:
        raise ValueError("KIE_API_KEY not found in environment variables")
    
    # Generate prompt
    prompt = generate_ugc_prompt(brand_data)
    
    # Step 1: Create task
    create_url = "https://api.kie.ai/api/v1/jobs/createTask"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "flux-2/flex-image-to-image",
        "input": {
            "input_urls": [product_image_url],
            "prompt": prompt,
            "aspect_ratio": "1:1",
            "resolution": "2K"
        }
    }
    
    print(f"🎨 Creating image generation task...")
    print(f"📸 Product image: {product_image_url}")
    print(f"📝 Prompt: {prompt[:100]}...")
    
    response = requests.post(create_url, headers=headers, json=payload)
    response.raise_for_status()
    
    result = response.json()
    
    if result.get('code') != 200:
        raise Exception(f"Failed to create task: {result.get('msg')}")
    
    task_id = result['data']['taskId']
    print(f"✅ Task created: {task_id}")
    
    # Step 2: Poll for results
    query_url = f"https://api.kie.ai/api/v1/jobs/recordInfo?taskId={task_id}"
    max_attempts = 60  # 60 attempts * 2 seconds = 2 minutes max
    attempt = 0
    
    while attempt < max_attempts:
        attempt += 1
        time.sleep(2)  # Wait 2 seconds between polls
        
        print(f"⏳ Checking status... (attempt {attempt}/{max_attempts})")
        
        status_response = requests.get(query_url, headers=headers)
        status_response.raise_for_status()
        
        status_data = status_response.json()
        
        if status_data.get('code') != 200:
            raise Exception(f"Failed to query task: {status_data.get('msg')}")
        
        task_data = status_data['data']
        state = task_data['state']
        
        if state == 'success':
            # Parse resultJson
            import json
            result_json = json.loads(task_data['resultJson'])
            generated_image_url = result_json['resultUrls'][0]
            
            print(f"✅ Image generated successfully!")
            print(f"🖼️  URL: {generated_image_url}")
            
            return {
                'success': True,
                'image_url': generated_image_url,
                'task_id': task_id,
                'cost_time': task_data.get('costTime'),
                'prompt': prompt,
                'raw_image_url': generated_image_url  # Keep original for reference
            }
        
        elif state == 'fail':
            fail_msg = task_data.get('failMsg', 'Unknown error')
            fail_code = task_data.get('failCode', 'N/A')
            raise Exception(f"Image generation failed: [{fail_code}] {fail_msg}")
        
        elif state == 'waiting':
            continue  # Keep polling
    
    # Timeout
    raise Exception(f"Image generation timed out after {max_attempts * 2} seconds")


# For testing
if __name__ == "__main__":
    test_brand = {
        'brand_name': 'Renly',
        'company_vibe': 'Creative, innovative, empowering',
        'industry': 'Graphics Multimedia and Web Design',
        'colors': [{'hex': '#f4d219', 'name': 'Accent'}]
    }
    
    prompt = generate_ugc_prompt(test_brand)
    print("Generated Prompt:")
    print("=" * 80)
    print(prompt)
    print("=" * 80)
    
    # Test with a sample image URL
    # result = generate_ugc_image_kie_flex(
    #     "https://example.com/product.jpg",
    #     test_brand
    # )
    # print(result)
