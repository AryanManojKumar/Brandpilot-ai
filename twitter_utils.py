import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

# Kie.ai Gemini 2.5 Flash (https://docs.kie.ai/market/gemini/gemini-2.5-flash)
KIE_CHAT_URL = "https://api.kie.ai/gemini-2.5-flash/v1/chat/completions"
MAX_RETRIES = 3
RETRY_BACKOFF_SEC = [1, 2, 4]  # exponential backoff


def generate_caption_with_ai(brand_data: dict, image_context: str = ""):
    """Generate social media caption using Kie.ai Gemini 2.5 Flash (per docs.kie.ai)."""
    api_key = os.getenv("KIE_API_KEY")
    if not api_key:
        raise ValueError("KIE_API_KEY not found")

    brand_name = brand_data.get("brand_name", "Brand")
    company_vibe = brand_data.get("company_vibe", "Professional")
    target_audience = brand_data.get("target_audience", "General audience")

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

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # Documented format: messages[].content is array of parts (Unified Media File Format)
    # https://docs.kie.ai/market/gemini/gemini-2.5-flash
    data = {
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt}],
            }
        ],
        "stream": False,
        "include_thoughts": False,
    }

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(KIE_CHAT_URL, headers=headers, json=data, timeout=60)
            response.raise_for_status()
            result = response.json()
        except requests.RequestException as e:
            last_error = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_BACKOFF_SEC[attempt])
            continue

        # Kie.ai error format: {"code": 401, "msg": "..."} or 500 maintenance
        if "code" in result and "msg" in result:
            code = result["code"]
            msg = result["msg"]
            is_retryable = code == 500 or "maintained" in msg.lower() or "try again" in msg.lower()
            if is_retryable and attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_BACKOFF_SEC[attempt])
                continue
            raise ValueError(
                f"Kie.ai API error (code {code}): {msg}. "
                "Check KIE_API_KEY at https://kie.ai/api-key and ensure the key has access to chat models."
            )

        if "error" in result:
            err = result["error"]
            err_msg = err.get("message", err) if isinstance(err, dict) else str(err)
            raise ValueError(f"Kie.ai API error: {err_msg}")

        if "choices" not in result or not result["choices"]:
            raise ValueError(
                f"Unexpected API response (no 'choices'): {list(result.keys())}. "
                "Check KIE_API_KEY and Kie.ai API docs for the correct response format."
            )

        content = result["choices"][0].get("message", {}).get("content")
        if not content:
            raise ValueError("Kie.ai returned empty message content.")
        caption = content.strip().strip('"').strip("'")
        return caption

    raise ValueError(f"Caption generation failed after {MAX_RETRIES} attempts: {last_error}")


def post_to_twitter(image_url: str, caption: str):
    """Post image and caption to Twitter/X. Uses v1.1 for media upload and API v2 for creating the tweet (avoids 403 on limited access)."""
    import tweepy
    import tempfile

    api_key = os.getenv("TWITTER_API_KEY")
    api_secret = os.getenv("TWITTER_API_SECRET")
    access_token = os.getenv("TWITTER_ACCESS_TOKEN")
    access_token_secret = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")

    if not all([api_key, api_secret, access_token, access_token_secret]):
        return {
            "success": False,
            "post_url": None,
            "message": "Twitter credentials not configured (TWITTER_* in .env)",
        }

    caption = (caption or "").strip()[:280]

    try:
        auth = tweepy.OAuth1UserHandler(
            api_key, api_secret, access_token, access_token_secret
        )
        api = tweepy.API(auth)
        # Use v2 Client for creating the tweet (required for Free/Basic tier; v1.1 statuses/update returns 403)
        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )

        # 1) Download image and upload via v1.1 (media upload is allowed on limited access)
        resp = requests.get(image_url, timeout=30)
        resp.raise_for_status()
        suffix = ".jpg"
        if "png" in (image_url or "").lower():
            suffix = ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        try:
            media = api.media_upload(filename=tmp_path)
            # 2) Create tweet via API v2 (avoids 453/403 on v1.1 statuses/update)
            response = client.create_tweet(text=caption, media_ids=[media.media_id])
            tweet_id = response.data.get("id") if response and response.data else None
            if not tweet_id:
                return {
                    "success": False,
                    "post_url": None,
                    "message": "X API did not return a tweet id",
                }
            post_url = f"https://twitter.com/i/status/{tweet_id}"
            print(f"📤 Posted to X: {post_url}")
            return {
                "success": True,
                "post_url": post_url,
                "tweet_id": str(tweet_id),
                "message": "Posted successfully",
            }
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    except Exception as e:
        err_msg = str(e)
        print(f"❌ Twitter post failed: {err_msg}")
        return {
            "success": False,
            "post_url": None,
            "message": err_msg,
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
