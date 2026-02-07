"""
Video Generator Module using Veo 3.1 API (kie.ai)

This module handles video generation using the Veo 3.1 API for creating
marketing videos from product images and brand information.
"""

import os
import requests
import time
from dotenv import load_dotenv

load_dotenv()

# API Configuration
VEO_API_BASE = "https://api.kie.ai"
VEO_GENERATE_URL = f"{VEO_API_BASE}/api/v1/veo/generate"
VEO_STATUS_URL = f"{VEO_API_BASE}/api/v1/veo/record-info"


def generate_video_prompt(brand_data: dict) -> str:
    """
    Generate a marketing video prompt from brand data.
    
    Args:
        brand_data: Dictionary containing brand information
        
    Returns:
        A detailed prompt string for video generation
    """
    brand_name = brand_data.get('brand_name', 'Brand')
    company_vibe = brand_data.get('company_vibe', 'Professional and modern')
    industry = brand_data.get('industry', 'General')
    target_audience = brand_data.get('target_audience', 'General audience')
    product_service = brand_data.get('product_service', 'products')
    
    # Get primary brand color if available
    primary_color = '#000000'
    if brand_data.get('colors') and len(brand_data['colors']) > 0:
        primary_color = brand_data['colors'][0].get('hex', '#000000')
    
    prompt = f"""Create a professional marketing video for {brand_name}.

BRAND CONTEXT:
- Brand: {brand_name}
- Industry: {industry}
- Vibe: {company_vibe}
- Target Audience: {target_audience}
- Product/Service: {product_service}
- Primary Color: {primary_color}

VIDEO REQUIREMENTS:
- Start with the product clearly visible and in focus
- Add subtle, elegant motion to bring the product to life
- Create a smooth, professional camera movement (slow zoom or pan)
- Maintain the {company_vibe} aesthetic throughout
- Keep the focus on the product as the hero element
- Add subtle ambient lighting effects that enhance the product
- The movement should feel premium and intentional

STYLE:
- Modern, clean, and professional
- Social media ready (Instagram/TikTok quality)
- Smooth, cinematic motion
- {company_vibe} aesthetic

OUTPUT: A 5-8 second professional marketing video showcasing the product with elegant motion."""
    
    return prompt


def start_video_generation(product_image_url: str, brand_data: dict, 
                           model: str = "veo3_fast", 
                           aspect_ratio: str = "9:16") -> dict:
    """
    Start a video generation task using Veo 3.1 API.
    
    This function starts the video generation and returns immediately with the task ID.
    Use check_video_status() to poll for completion.
    
    Args:
        product_image_url: Public URL of the product image
        brand_data: Dictionary containing brand information
        model: "veo3" (quality) or "veo3_fast" (faster, cheaper)
        aspect_ratio: "16:9" (landscape), "9:16" (portrait), or "Auto"
        
    Returns:
        Dictionary with:
            - success: bool
            - task_id: str (if successful)
            - prompt: str (the prompt used)
            - error: str (if failed)
    """
    api_key = os.getenv("KIE_API_KEY")
    if not api_key:
        return {
            'success': False,
            'error': 'KIE_API_KEY not found in environment variables'
        }
    
    # Generate prompt
    prompt = generate_video_prompt(brand_data)
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "prompt": prompt,
        "imageUrls": [product_image_url],
        "model": model,
        "aspect_ratio": aspect_ratio,
        "generationType": "FIRST_AND_LAST_FRAMES_2_VIDEO",
        "enableTranslation": True
    }
    
    print(f"🎬 Starting video generation with Veo 3.1...")
    print(f"📸 Product image: {product_image_url}")
    print(f"🎯 Model: {model}, Aspect ratio: {aspect_ratio}")
    print(f"📝 Prompt: {prompt[:150]}...")
    
    try:
        response = requests.post(VEO_GENERATE_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        if result.get('code') == 200:
            task_id = result['data']['taskId']
            print(f"✅ Video generation task created: {task_id}")
            return {
                'success': True,
                'task_id': task_id,
                'prompt': prompt
            }
        else:
            error_msg = result.get('msg', 'Unknown error')
            print(f"❌ Video generation failed: {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }
            
    except requests.exceptions.Timeout:
        return {
            'success': False,
            'error': 'Request timed out. Please try again.'
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': f'Request failed: {str(e)}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }


def check_video_status(task_id: str) -> dict:
    """
    Check the status of a video generation task.
    
    Args:
        task_id: The task ID returned from start_video_generation()
        
    Returns:
        Dictionary with:
            - status: 'generating', 'completed', or 'failed'
            - video_url: str (if completed)
            - error: str (if failed)
            - raw_response: dict (full API response)
    """
    api_key = os.getenv("KIE_API_KEY")
    if not api_key:
        return {
            'status': 'failed',
            'error': 'KIE_API_KEY not found in environment variables'
        }
    
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    try:
        response = requests.get(
            f"{VEO_STATUS_URL}?taskId={task_id}",
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        
        if result.get('code') != 200:
            return {
                'status': 'failed',
                'error': result.get('msg', 'Failed to get task status'),
                'raw_response': result
            }
        
        data = result.get('data', {})
        success_flag = data.get('successFlag', 0)
        
        # successFlag: 0=generating, 1=success, 2=failed, 3=generation failed
        if success_flag == 0:
            return {
                'status': 'generating',
                'raw_response': result
            }
        elif success_flag == 1:
            # Parse result URLs
            response_data = data.get('response', {})
            result_urls = response_data.get('resultUrls', [])
            video_url = result_urls[0] if result_urls else None
            
            print(f"✅ Video generation completed!")
            print(f"🎬 Video URL: {video_url}")
            
            return {
                'status': 'completed',
                'video_url': video_url,
                'resolution': response_data.get('resolution', 'unknown'),
                'raw_response': result
            }
        else:
            # Failed (2 or 3)
            error_msg = data.get('errorMessage') or result.get('msg', 'Video generation failed')
            print(f"❌ Video generation failed: {error_msg}")
            return {
                'status': 'failed',
                'error': error_msg,
                'error_code': data.get('errorCode'),
                'raw_response': result
            }
            
    except requests.exceptions.Timeout:
        return {
            'status': 'failed',
            'error': 'Request timed out'
        }
    except requests.exceptions.RequestException as e:
        return {
            'status': 'failed',
            'error': f'Request failed: {str(e)}'
        }
    except Exception as e:
        return {
            'status': 'failed',
            'error': f'Unexpected error: {str(e)}'
        }


def generate_video_with_polling(product_image_url: str, brand_data: dict,
                                 model: str = "veo3_fast",
                                 aspect_ratio: str = "9:16",
                                 max_wait_seconds: int = 600,
                                 poll_interval_seconds: int = 15) -> dict:
    """
    Generate a video and wait for completion (blocking).
    
    This is a convenience function that starts generation and polls until complete.
    For API endpoints, prefer using start_video_generation() + check_video_status()
    for non-blocking operation.
    
    Args:
        product_image_url: Public URL of the product image
        brand_data: Dictionary containing brand information
        model: "veo3" (quality) or "veo3_fast" (faster, cheaper)
        aspect_ratio: "16:9", "9:16", or "Auto"
        max_wait_seconds: Maximum time to wait for completion
        poll_interval_seconds: Time between status checks
        
    Returns:
        Dictionary with:
            - success: bool
            - video_url: str (if successful)
            - task_id: str
            - prompt: str
            - error: str (if failed)
    """
    # Start generation
    start_result = start_video_generation(product_image_url, brand_data, model, aspect_ratio)
    
    if not start_result.get('success'):
        return start_result
    
    task_id = start_result['task_id']
    prompt = start_result['prompt']
    
    # Poll for completion
    start_time = time.time()
    attempt = 0
    
    while time.time() - start_time < max_wait_seconds:
        attempt += 1
        print(f"⏳ Checking video status... (attempt {attempt})")
        
        status_result = check_video_status(task_id)
        
        if status_result['status'] == 'completed':
            return {
                'success': True,
                'video_url': status_result['video_url'],
                'task_id': task_id,
                'prompt': prompt,
                'resolution': status_result.get('resolution')
            }
        elif status_result['status'] == 'failed':
            return {
                'success': False,
                'error': status_result.get('error', 'Video generation failed'),
                'task_id': task_id,
                'prompt': prompt
            }
        
        # Still generating, wait and retry
        time.sleep(poll_interval_seconds)
    
    # Timeout
    return {
        'success': False,
        'error': f'Video generation timed out after {max_wait_seconds} seconds',
        'task_id': task_id,
        'prompt': prompt
    }


# For testing
if __name__ == "__main__":
    test_brand = {
        'brand_name': 'TestBrand',
        'company_vibe': 'Creative, innovative, empowering',
        'industry': 'Technology',
        'target_audience': 'Young professionals',
        'product_service': 'Smart devices',
        'colors': [{'hex': '#FF6B00', 'name': 'Orange'}]
    }
    
    prompt = generate_video_prompt(test_brand)
    print("Generated Video Prompt:")
    print("=" * 80)
    print(prompt)
    print("=" * 80)
