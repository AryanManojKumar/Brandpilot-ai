import os
import requests
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()


def generate_caption_with_ai(brand_data: dict, image_context: str = ""):
    """Generate social media caption using Kie.ai LLM"""
    api_key = os.getenv("KIE_API_KEY")
    if not api_key:
        raise ValueError("KIE_API_KEY not found")
    
    brand_name = brand_data.get('brand_name', 'Brand')
    company_vibe = brand_data.get('company_vibe', 'Professional')
    target_audience = brand_data.get('target_audience', 'General audience')
    
    prompt = f"""Generate an engaging social media caption for Twitter/X for {brand_name}.

Brand Context:
- Brand: {brand_name}
- Vibe: {company_vibe}
- Target Audience: {target_audience}
- Image: Marketing image showing product in lifestyle setting

Requirements:
- Keep it under 280 characters (Twitter limit)
- Engaging and authentic tone matching {company_vibe}
- Include relevant emojis (2-3 max)
- Call-to-action if appropriate
- NO hashtags (we'll add those separately)
- Make it conversational and relatable

Generate ONLY the caption text, nothing else."""
    
    url = "https://api.kie.ai/gemini-2.5-flash/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    
    result = response.json()
    caption = result['choices'][0]['message']['content'].strip()
    
    # Remove quotes if AI added them
    caption = caption.strip('"').strip("'")
    
    return caption


def post_to_twitter(image_url: str, caption: str):
    """Post image and caption to Twitter/X"""
    # Note: Twitter API v2 requires OAuth 1.0a and is complex
    # For now, this is a placeholder that would need proper implementation
    # You'll need to use tweepy library for actual posting
    
    print(f"📤 Would post to Twitter:")
    print(f"Caption: {caption}")
    print(f"Image: {image_url}")
    
    # TODO: Implement actual Twitter posting with tweepy
    # This requires:
    # 1. pip install tweepy
    # 2. Proper OAuth setup
    # 3. Image download and upload to Twitter
    
    return {
        'success': True,
        'post_url': 'https://twitter.com/placeholder',
        'message': 'Posted successfully (placeholder)'
    }


# For testing
if __name__ == "__main__":
    test_brand = {
        'brand_name': 'Nike',
        'company_vibe': 'Energetic, motivational, athletic',
        'target_audience': 'Athletes and fitness enthusiasts'
    }
    
    caption = generate_caption_with_ai(test_brand)
    print("Generated Caption:")
    print(caption)
