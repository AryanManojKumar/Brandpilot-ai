from crewai import Agent, Task, Crew, LLM
from brandfetch_tool import BrandfetchTool
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


# Configure OpenAI LLM (most efficient and reliable)
llm = LLM(
    model="openai/gemini-2.5-flash",
    api_key=os.getenv("KIE_API_KEY"),
    base_url="https://api.kie.ai/gemini-2.5-flash/v1"
)

# Initialize the Brandfetch tool with your API key
brandfetch_tool_instance = BrandfetchTool(api_key=os.getenv("BRANDFETCH_API_KEY", "your_api_key_here"))
brandfetch_tool = brandfetch_tool_instance.get_tool()

# Create the agent
brand_researcher = Agent(
    role="Brand Research Specialist",
    goal="Help users discover and retrieve comprehensive brand information for any company",
    backstory="You are an expert at finding and analyzing brand data. You help users by asking for the company's website, stock ticker, ISIN, or crypto symbol, then retrieve detailed brand information including logos, colors, fonts, and other brand assets.",
    tools=[brandfetch_tool],
    llm=llm,
    verbose=True,
    allow_delegation=False
)

# Create a task
def create_brand_research_task(user_query: str) -> Task:
    return Task(
        description=f"""
        User query: {user_query}
        
        Your task:
        1. If the user hasn't provided a website/identifier, ask them for the company's website domain, stock ticker, ISIN, or crypto symbol
        2. Once you have the identifier, use the Brandfetch tool to retrieve the brand data
        3. Present the key findings in a clear, organized manner
        
        Examples of valid identifiers:
        - Domain: nike.com, brandfetch.com
        - Stock ticker: NKE, AAPL
        - ISIN: US6541061031
        - Crypto: BTC, ETH
        """,
        agent=brand_researcher,
        expected_output="Brand information including logos, colors, fonts, and other brand assets, or a request for the company identifier if not provided."
    )

# Function to run the agent
def chat_with_agent(user_message: str):
    task = create_brand_research_task(user_message)
    crew = Crew(
        agents=[brand_researcher],
        tasks=[task],
        verbose=True
    )
    result = crew.kickoff()
    return result


if __name__ == "__main__":
    print("Brand Research Agent - Powered by Brandfetch")
    print("=" * 50)
    print("Ask me to fetch brand information for any company!")
    print("You can provide: website domain, stock ticker, ISIN, or crypto symbol")
    print("=" * 50)
    
    while True:
        user_input = input("\nYou: ").strip()
        if user_input.lower() in ['exit', 'quit', 'bye']:
            print("Goodbye!")
            break
        
        if not user_input:
            continue
            
        result = chat_with_agent(user_input)
        print(f"\nAgent: {result}")
