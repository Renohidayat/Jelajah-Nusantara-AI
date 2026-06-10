# 🚀 Quick Start Guide

Panduan cepat untuk memulai development Jelajah Nusantara.

## ⚡ 5 Menit Setup

### 1. Prerequisites
```bash
# Check Node.js version (harus 18+)
node --version

# Check npm version (harus 9+)
npm --version
```

### 2. Clone & Install
```bash
git clone https://github.com/yourusername/Jelajah-Nusantara-AI.git
cd Jelajah-Nusantara-AI

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies  
cd frontend && npm install && cd ..
```

### 3. Setup Environment Variables
```bash
# Backend
cd backend
cp .env.example .env
# Edit .env dengan Firebase & Gemini API keys Anda
code .env

# Frontend (opsional)
cd ../frontend
cp .env.example .env
```

### 4. Run Development Servers
```bash
# Terminal 1: Backend
cd backend
npm run dev
# Output: Server running on http://localhost:8080

# Terminal 2: Frontend
cd frontend
npm run dev
# Output: Local: http://localhost:5173
```

### 5. Open Browser
- Navigate ke **http://localhost:5173**
- Selesai! 🎉

---

## 📋 Common Commands

### Backend

```bash
# Start development server dengan auto-reload
npm run dev

# Start production server
npm start

# Install dependencies
npm install

# Check for updates
npm outdated

# Update dependencies
npm update
```

### Frontend

```bash
# Start Vite dev server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Check dependencies
npm list
```

### Docker

```bash
# Build image
docker build -t jelajah-nusantara:latest .

# Run container
docker run -p 8080:8080 \
  -e FIREBASE_PROJECT_ID=xxx \
  -e GEMINI_API_KEY=xxx \
  jelajah-nusantara:latest

# Stop container
docker stop <container_id>
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'express'"
```bash
# Solution: Install dependencies
cd backend && npm install
```

### Issue: "CORS error on API calls"
```bash
# Solution: Check .env CORS_ORIGIN
# Should match your frontend URL (http://localhost:5173)
cat backend/.env | grep CORS_ORIGIN
```

### Issue: "Firebase initialization failed"
```bash
# Solution 1: Check .env file exists and has valid credentials
ls -la backend/.env

# Solution 2: Verify FIREBASE_PRIVATE_KEY has proper newlines
# The key should have \n between BEGIN and END

# Solution 3: Check Firebase console for service account
# https://console.firebase.google.com/ → Project Settings → Service Accounts
```

### Issue: "GEMINI_API_KEY not valid"
```bash
# Solution: Get new API key from Google AI Studio
# https://aistudio.google.com/ → Get API Key
```

### Issue: "Port 8080 already in use"
```bash
# Solution 1: Kill process using port 8080
lsof -ti:8080 | xargs kill -9

# Solution 2: Use different port
# Edit backend/.env → PORT=3000
```

---

## 📁 Project Structure Explained

```
backend/                  # Express.js server
├── server.js            # Main entry point
├── package.json         # Dependencies
├── .env                 # Environment variables (create from .env.example)
├── .env.example         # Template for .env
└── public/              # Serve frontend build here
    ├── index.html
    └── assets/

frontend/               # Vite frontend
├── index.html         # Main HTML
├── src/
│   ├── main.js        # Entry point
│   └── style.css      # Global styles
├── package.json       # Dependencies
├── .env               # Frontend env vars (opsional)
├── .env.example       # Template
└── vite.config.js     # Vite configuration

.gitignore            # Files to ignore in git
README.md             # Documentation lengkap
CONTRIBUTING.md       # Contributing guide
LICENSE               # MIT License
```

---

## 🔑 Environment Variables

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project or select existing
3. Settings → Service Accounts
4. Generate Private Key (download JSON)
5. Copy values ke `.env`

**Important:** PRIVATE_KEY harus memiliki literal `\n` newlines, bukan `\\n`

### Gemini API

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API Key"
3. Create new key
4. Copy ke `GEMINI_API_KEY`

---

## 🎓 Learning Path

### Beginner
- [ ] Run project locally
- [ ] Understand folder structure
- [ ] Make a simple style change
- [ ] View in different browsers

### Intermediate
- [ ] Add a new page/route
- [ ] Modify an API endpoint
- [ ] Update UI component
- [ ] Test with different data

### Advanced
- [ ] Add new API endpoint
- [ ] Integrate new AI feature
- [ ] Optimize performance
- [ ] Deploy to production

---

## 📚 Useful Links

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [Vite Documentation](https://vitejs.dev/)
- [Firebase Docs](https://firebase.google.com/docs)
- [Google Generative AI](https://ai.google.dev/)
- [MDN Web Docs](https://developer.mozilla.org/)

---

## 🆘 Need Help?

1. Check [README.md](README.md)
2. Search [GitHub Issues](https://github.com/yourusername/Jelajah-Nusantara-AI/issues)
3. Create new issue with details
4. Email: your.email@example.com

---

## ✅ Pre-Deployment Checklist

- [ ] Test all features locally
- [ ] No console errors
- [ ] Environment variables set
- [ ] Frontend builds without errors
- [ ] Backend server starts properly
- [ ] Firebase connection works
- [ ] Gemini API working
- [ ] CORS configured
- [ ] .env added to .gitignore

---

## 🚀 Deployment

See [README.md](README.md#-docker-deployment) untuk deployment instructions.

---

**Happy Coding! 💻**

Last Updated: June 2024
