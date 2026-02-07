import requests
from crewai.tools import tool


class BrandfetchTool:
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    def get_tool(self):
        api_key = self.api_key
        
        @tool("Brandfetch")
        def brandfetch_tool(website: str) -> str:
            """Fetches brand data including logos, colors, fonts, and firmographic information for any company using their website domain, stock ticker, ISIN, or crypto symbol. Examples: 'nike.com', 'NKE', 'BTC'"""
            url = f"https://api.brandfetch.io/v2/brands/{website}"
            headers = {
                "Authorization": f"Bearer {api_key}"
            }
            
            try:
                response = requests.get(url, headers=headers)
                response.raise_for_status()
                return response.text
            except requests.exceptions.RequestException as e:
                return f"Error fetching brand data: {str(e)}"
        
        return brandfetch_tool
