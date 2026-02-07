# Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites Check

```bash
# Check Python version (need 3.8+)
python --version

# Check Node.js version (need 18+)
node --version

# Check PostgreSQL
psql --version
```

## 1. Setup Database (2 minutes)

```bash
# Start PostgreSQL (if not running)
# Windows: Start PostgreSQL service
# Mac: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Create database
python database.py
```

## 2. Get API Keys (3 minutes)

### Required APIs:
1. **Kie.ai** - https://kie.ai/api-key
2. **Brandfetch** - https://brandfetch.com/api
3. **Twitter Developer** - https://developer.twitter.com

### Add to `.env`:
```env
KIE_API_KEY=your_key_here
BRANDFETCH_API_KEY=your_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/iitgn
```

## 3. Start Backend (30 seconds)

```bash
pip install -r requirements.txt
python server.py
```

✅ Backend running on http://localhost:8000

## 4. Start Frontend (1 minute)

```bash
cd frontend
npm install
npm run dev
```

✅ Frontend running on http://localhost:3000

## 5. Test the System (2 minutes)

1. Open http://localhost:3000
2. Type "nike.com" in chat
3. Wait for brand analysis
4. Click "Content Creation Dashboard"
5. Upload a product image
6. Generate marketing content!

## Common Issues

### "Database connection failed"
```bash
# Update DATABASE_URL in .env with your PostgreSQL password
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iitgn
```

### "Module not found"
```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

### "Port already in use"
```bash
# Kill process on port 8000
# Windows: netstat -ano | findstr :8000
# Mac/Linux: lsof -ti:8000 | xargs kill
```

## Next Steps

- Read full [README.md](README.md) for detailed documentation
- Check [API Documentation](#) for endpoint details
- Join our community for support

## Need Help?

- Check troubleshooting section in README.md
- Open an issue on GitHub
- Contact: support@example.com

---

**Happy Creating! 🎨✨**
