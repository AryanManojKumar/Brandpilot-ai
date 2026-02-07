import os
from dotenv import load_dotenv
import requests

load_dotenv()

# Get API key
api_key = os.getenv("KIE_API_KEY")
print(f"Kie.ai API Key loaded: {api_key[:10] if api_key and api_key != 'your_kie_api_key_here' else 'NOT SET'}...")

if not api_key or api_key == "your_kie_api_key_here":
    print("\n❌ Please set your KIE_API_KEY in .env file")
    print("🔗 Get your key at: https://kie.ai/api-key")
    exit(1)

print("\n🧪 Testing Kie.ai API with gemini-2.5-pro...\n")

url = "https://api.kie.ai/gemini-2.5-pro/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

data = {
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Hello! Just testing if you're working. Reply with a short greeting."
                }
            ]
        }
    ],
    "stream": False,
    "include_thoughts": False,
    "reasoning_effort": "low"
}

try:
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    
    result = response.json()
    
    print("✅ SUCCESS!")
    print(f"\nModel: {result['model']}")
    print(f"Response: {result['choices'][0]['message']['content']}")
    
    if 'usage' in result:
        print(f"\nUsage:")
        print(f"  - Prompt tokens: {result['usage']['prompt_tokens']}")
        print(f"  - Completion tokens: {result['usage']['completion_tokens']}")
        print(f"  - Total tokens: {result['usage']['total_tokens']}")
    
    print(f"\nFinish reason: {result['choices'][0]['finish_reason']}")
    
except requests.exceptions.HTTPError as e:
    print(f"❌ HTTP Error: {e}")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 401:
        print("\n💡 Your API key is invalid or expired")
        print("🔗 Get a new key at: https://kie.ai/api-key")
    elif response.status_code == 429:
        print("\n💡 Rate limit exceeded")
        print("Wait a moment and try again")
        
except Exception as e:
    print(f"❌ Error: {e}")
