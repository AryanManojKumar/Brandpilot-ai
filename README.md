# IIT Gandhinagar Social Media Agent

AI-powered platform for automated brand research, content creation, and social media management.

## 🚀 Features

### 1. Brand Research Agent
- Fetches comprehensive brand data using Brandfetch API
- Analyzes brand identity, colors, vibe, and target audience
- Stores brand information in PostgreSQL database
- Supports multiple brands per conversation

### 2. Content Creator Dashboard
- Generates UGC marketing images using AI (Nano Banana Edit)
- Template-based prompt generation (no LLM overhead)
- Automatic brand name and styling integration
- Upload product images and transform them into marketing graphics

### 3. Social Media Manager
- View all generated marketing content
- AI-powered caption generation using Kie.ai LLM
- Twitter/X OAuth integration
- Schedule and post directly to social media

## 🛠️ Tech Stack

### Backend
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL
- **LLM:** Kie.ai (Gemini 2.5 Flash)
- **Image Generation:** Nano Banana Edit (Google)
- **Agent Framework:** CrewAI
- **APIs:** Brandfetch, Kie.ai, Twitter

### Frontend
- **Framework:** Next.js 14
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Authentication:** NextAuth.js
- **State Management:** React Hooks

## 📋 Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL 12+
- API Keys:
  - Kie.ai API Key
  - Brandfetch API Key
  - Twitter Developer API Keys

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd iitgn
```

### 2. Backend Setup

#### Install Python Dependencies
```bash
pip install -r requirements.txt
```

#### Configure Environment Variables
Create a `.env` file in the root directory:
```env
# API Keys
BRANDFETCH_API_KEY=your_brandfetch_key
KIE_API_KEY=your_kie_api_key
GEMINI_API_KEY=your_gemini_key

# Database
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/iitgn

# Twitter API
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
```

#### Setup Database
```bash
python database.py
```

#### Start Backend Server
```bash
python server.py
```
Server runs on: `http://localhost:8000`

### 3. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install
```

#### Configure Environment Variables
Create `frontend/.env.local`:
```env
# NextAuth
NEXTAUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Twitter OAuth
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

# API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### Start Frontend
```bash
npm run dev
```
Frontend runs on: `http://localhost:3000`

## 📖 Usage Guide

### Step 1: Brand Research
1. Open the chat interface at `http://localhost:3000`
2. Enter a conversation ID (optional)
3. Provide a website URL (e.g., "nike.com")
4. Agent fetches and analyzes brand data
5. Brand information saved to database

### Step 2: Content Creation
1. Click "Content Creation Dashboard" in sidebar
2. Select a synced brand
3. Upload a product image
4. Click "Generate UGC Content"
5. AI creates a marketing image with brand styling

### Step 3: Social Media Management
1. Click "Social Media Manager" in sidebar
2. View all generated marketing assets
3. Click "Post to X" on any image
4. Generate AI caption
5. Login with Twitter
6. Post directly to X (Twitter)

## 🗂️ Project Structure

```
iitgn/
├── backend/
│   ├── server.py              # FastAPI server
│   ├── database.py            # Database functions
│   ├── agent.py               # CrewAI agent
│   ├── image_generator.py     # Image generation utilities
│   ├── twitter_utils.py       # Twitter integration
│   └── brandfetch_tool.py     # Brandfetch integration
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Home/Chat page
│   │   ├── content-creator/   # Content creation dashboard
│   │   ├── social-media-manager/ # Social media manager
│   │   └── post-to-x/         # Twitter posting page
│   └── components/
│       ├── ChatInterface.tsx
│       ├── ContentCreatorDashboard.tsx
│       └── SocialMediaManagerDashboard.tsx
├── uploads/                   # Uploaded product images
├── requirements.txt           # Python dependencies
└── README.md
```

## 🔑 API Endpoints

### Brand Research
- `POST /chat` - Chat with brand research agent
- `GET /brands` - List all brands
- `GET /brands/conversation/{id}` - Get brands by conversation

### Content Creation
- `POST /generate-ugc` - Generate marketing image
- `GET /brands/{id}/details` - Get brand details

### Social Media
- `POST /generate-caption` - Generate AI caption
- `POST /schedule-post` - Schedule social media post
- `GET /generated-content/conversation/{id}` - Get all generated content

## 🎨 Features in Detail

### AI Caption Generation
- Uses Kie.ai LLM (Gemini 2.5 Flash)
- Analyzes brand vibe and target audience
- Generates engaging, platform-optimized captions
- 280 character limit for Twitter
- Editable before posting

### Image Generation
- Uses Nano Banana Edit (Google)
- Transforms product images into marketing graphics
- Adds brand styling and context
- Creates UGC-style lifestyle images
- 2K resolution output

### Brand Analysis
- Fetches logo, colors, fonts
- Analyzes company vibe and positioning
- Identifies target audience
- Extracts social media links
- Stores for future use

## 🔒 Security Notes

- Never commit `.env` files
- Keep API keys secure
- Use environment variables for sensitive data
- Implement rate limiting in production
- Add authentication for API endpoints

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Recreate database
python database.py
```

### Image Generation Fails
- Check Kie.ai API credits
- Verify image URL is publicly accessible
- Ensure tmpfiles.org is not blocked

### Twitter OAuth Issues
- Verify callback URL in Twitter Developer Portal
- Check NEXTAUTH_URL matches exactly
- Ensure Twitter API keys are correct

## 📝 License

MIT License

## 👥 Contributors

IIT Gandhinagar Team

## 🙏 Acknowledgments

- Kie.ai for LLM and image generation APIs
- Brandfetch for brand data API
- CrewAI for agent framework
- Next.js and FastAPI communities
