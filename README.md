# 🗺️ Jelajah Nusantara — AI Travel Planner

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Admin%20SDK-orange?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Google Generative AI](https://img.shields.io/badge/Google%20Generative%20AI-Gemini-blue?style=flat-square&logo=google)](https://ai.google.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.3-purple?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

> Rencanakan perjalanan impianmu di Indonesia dengan kecerdasan buatan. Temukan destinasi terbaik, buat itinerary, kelola budget, dan bagikan pengalaman dengan komunitas traveler Indonesia.

**English Version** | [Versi Indonesia](#-versi-indonesia)

## 🎯 Overview

**Jelajah Nusantara** adalah platform web yang menggunakan AI (Google Gemini) untuk membantu traveler merencanakan perjalanan mereka di Indonesia. Platform ini menyediakan:

- ✅ **Perencanaan Itinerary Cerdas** - AI menghasilkan rencana perjalanan berdasarkan preferensi pengguna
- ✅ **Visualisasi Peta Interaktif** - Tampilkan destinasi di peta real-time
- ✅ **Manajemen Budget** - Analisis biaya perjalanan dengan breakdown detail
- ✅ **Autentikasi Google** - Login aman dengan Firebase Authentication
- ✅ **Penyimpanan Cloud** - Simpan perjalanan di Firestore
- ✅ **Komunitas Traveler** - Bagikan dan lihat pengalaman pengguna lain
- ✅ **Responsive Design** - Mobile-friendly dan dioptimalkan untuk semua perangkat

---

## 📋 Tech Stack

### Frontend
- **Vanilla ES6** - Pure JavaScript, tanpa framework overhead
- **Vite 5.3** - Build tool ultra-cepat
- **Firebase SDK v10** - Authentication & Realtime Database
- **Leaflet.js** - Interactive mapping
- **Chart.js** - Budget visualization
- **marked.js** - Markdown parsing
- **CSS3** - Modern styling dengan CSS variables

### Backend
- **Node.js 18+** - JavaScript runtime
- **Express.js 4.19** - Web framework
- **Firebase Admin SDK** - Server-side Firebase management
- **Google Generative AI** - Gemini AI integration
- **Multer** - File upload handling
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

### Deployment & DevOps
- **Docker** - Containerization
- **Google Cloud Run** - Serverless deployment
- **Cloud Firestore** - NoSQL database
- **Firebase Authentication** - User authentication

---

## 🚀 Quick Start

### Prerequisites

Pastikan sudah menginstall:
- **Node.js 18+** ([Download](https://nodejs.org/))
- **npm 9+** atau **yarn**
- **Docker** (opsional, untuk deployment)
- **Git**

### Installation

1. **Clone repository:**
   ```bash
   git clone https://github.com/yourusername/Jelajah-Nusantara-AI.git
   cd Jelajah-Nusantara-AI
   ```

2. **Install dependencies (Backend & Frontend):**
   ```bash
   # Install backend dependencies
   cd backend
   npm install
   cd ..

   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

3. **Setup Firebase & Gemini API (lihat bagian berikutnya)**

---

## 🔧 Configuration

### 1. Firebase Setup

1. **Buat project di [Firebase Console](https://console.firebase.google.com/)**
2. **Enable Authentication:**
   - Pilih Authentication → Sign-in method
   - Aktifkan Google sebagai provider
3. **Create Firestore Database:**
   - Pilih Firestore Database
   - Buat di region terdekat
   - Start in test mode (untuk development)
4. **Generate Service Account Key:**
   - Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Download file JSON

### 2. Google Generative AI (Gemini) Setup

1. **Buka [Google AI Studio](https://aistudio.google.com/)**
2. **Get API Key:**
   - Click "Get API Key"
   - Create new API key
   - Copy key tersebut

### 3. Environment Variables

**Backend** - Buat file `.env` di folder `backend/`:
```bash
# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your_client_email@project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_CLIENT_CERT_URL=your_cert_url

# Google Generative AI
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=8080
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173
```

**Frontend** - Buat file `.env` di folder `frontend/`:
```bash
VITE_API_BASE=http://localhost:8080
```

### Firebase Web Config

Konfigurasi Firebase akan di-fetch dari endpoint `/api/config`. Pastikan backend menyediakan config yang sesuai.

---

## 💻 Running Locally

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server berjalan di http://localhost:8080
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Client berjalan di http://localhost:5173
```

Buka browser ke `http://localhost:5173`

### Production Build

**Build frontend:**
```bash
cd frontend
npm run build
# Output: frontend/dist/
```

**Run backend dengan produksi:**
```bash
cd backend
npm start
# Server berjalan di http://localhost:8080
# Melayani static files dari backend/public/
```

---

## 🐳 Docker Deployment

### Build Docker Image

```bash
docker build -t jelajah-nusantara:latest .
```

### Run Container Locally

```bash
docker run -p 8080:8080 \
  -e FIREBASE_PROJECT_ID=your_project_id \
  -e FIREBASE_PRIVATE_KEY="your_key" \
  -e FIREBASE_CLIENT_EMAIL=your_email \
  -e FIREBASE_CLIENT_ID=your_id \
  -e FIREBASE_CLIENT_CERT_URL=your_url \
  -e GEMINI_API_KEY=your_api_key \
  jelajah-nusantara:latest
```

### Deploy ke Google Cloud Run

```bash
# 1. Tag image
docker tag jelajah-nusantara:latest gcr.io/PROJECT_ID/jelajah-nusantara:latest

# 2. Push ke Container Registry
docker push gcr.io/PROJECT_ID/jelajah-nusantara:latest

# 3. Deploy ke Cloud Run
gcloud run deploy jelajah-nusantara \
  --image gcr.io/PROJECT_ID/jelajah-nusantara:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars "FIREBASE_PROJECT_ID=...,GEMINI_API_KEY=..."
```

Atau gunakan file `cloudrun.yaml` untuk deployment lebih mudah.

---

## 📁 Project Structure

```
Jelajah-Nusantara-AI/
├── backend/                          # Backend Express.js server
│   ├── server.js                     # Main server entry point
│   ├── package.json                  # Backend dependencies
│   ├── public/                       # Static files (frontend build)
│   │   ├── index.html
│   │   ├── kontak.html              # Contact page
│   │   ├── privasi.html             # Privacy policy
│   │   ├── tentang.html             # About page
│   │   └── assets/                  # CSS & JS bundles
│   └── .env.example                 # Environment variables template
│
├── frontend/                         # Frontend Vite project
│   ├── index.html                   # Main HTML
│   ├── vite.config.js               # Vite configuration
│   ├── package.json                 # Frontend dependencies
│   ├── src/
│   │   ├── main.js                  # Entry point
│   │   ├── style.css                # Global styles
│   │   └── pages/                   # (opsional) Page components
│   ├── public/                      # Static assets
│   └── dist/                        # Build output (generated)
│
├── Dockerfile                        # Multi-stage Docker build
├── cloudrun.yaml                     # Google Cloud Run config
├── README.md                         # This file
└── .gitignore                        # Git ignore rules
```

---

## 🔌 API Endpoints

### Public Endpoints
```
GET  /api/config                      # Firebase config
GET  /health                          # Health check
```

### Authenticated Endpoints
```
POST /api/generate-itinerary          # Generate travel itinerary with AI
POST /api/save-trip                   # Save trip to Firestore
GET  /api/trips                       # Get user's saved trips
GET  /api/trips/:id                   # Get specific trip
DELETE /api/trips/:id                 # Delete trip
GET  /api/community                   # Get community trips
POST /api/budget-analysis             # Analyze trip budget with AI
```

---

## 🛡️ Environment & Security

### Important Security Notes

1. **Firebase Private Key:**
   - Jangan commit `.env` ke repository
   - Gunakan environment variables di production
   - CRITICAL: Private key di `.env` harus memiliki escaped newlines (`\n`)
   - Backend akan otomatis parse dan fix newlines

2. **API Keys:**
   - Selalu gunakan server-side untuk API calls sensitif
   - Frontend hanya boleh access melalui backend proxy
   - Rate limit pada production

3. **CORS Configuration:**
   - Sesuaikan `CORS_ORIGIN` dengan frontend URL
   - Jangan gunakan `*` di production

---

## 📝 Features & Usage

### 1. Perencanaan Itinerary
- Masukkan destinasi, durasi, budget, dan preferensi
- AI menghasilkan itinerary detail dengan rekomendasi tempat
- Visualisasi destinasi di peta interaktif

### 2. Manajemen Budget
- Upload file budget atau input manual
- AI menganalisis dan memberikan breakdown biaya
- Visualisasi chart untuk kategori pengeluaran

### 3. Simpan Perjalanan
- Login dengan Google
- Simpan itinerary ke profile
- Edit dan share dengan teman

### 4. Komunitas
- Lihat perjalanan pengguna lain
- Inspirasi dari community trips
- Share pengalaman Anda sendiri

---

## 🧪 Testing

### Manual Testing
```bash
# Test backend
curl http://localhost:8080/health

# Test Firebase config fetch
curl http://localhost:8080/api/config

# Test AI endpoint
curl -X POST http://localhost:8080/api/generate-itinerary \
  -H "Content-Type: application/json" \
  -d '{"destination":"Bali","days":3,"budget":5000000}'
```

### Frontend Testing
- Buka DevTools Console untuk debugging
- Check Network tab untuk API calls
- Test responsiveness dengan Device Emulation

---

## 🐛 Troubleshooting

### Firebase Connection Error
```
❌ Firebase Admin initialization failed: INVALID_ARGUMENT
```
**Solusi:**
- Pastikan `.env` memiliki valid credentials
- Check private key format (harus escaped newlines)
- Verify di Firebase Console

### Gemini API Error
```
401 UNAUTHENTICATED: API Key not valid
```
**Solusi:**
- Verify `GEMINI_API_KEY` di `.env`
- Check API key di [Google AI Studio](https://aistudio.google.com/)
- Ensure Generative AI API is enabled

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solusi:**
- Check `CORS_ORIGIN` matches frontend URL
- Verify backend adalah source of truth
- Check browser console untuk exact error

### Vite Build Error
```
error during build: [vite:vue] Unexpected token }
```
**Solusi:**
- Clear `node_modules` dan `dist`
- Run `npm install` ulang
- Check JavaScript syntax di `.js` files

---

## 📚 Documentation

- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Generative AI](https://ai.google.dev/docs)
- [Express.js Guide](https://expressjs.com/)
- [Vite Documentation](https://vitejs.dev/)
- [Leaflet.js Documentation](https://leafletjs.com/)

---

## 🤝 Contributing

Kontribusi sangat diterima! Untuk berkontribusi:

1. Fork repository
2. Buat branch feature: `git checkout -b feature/AmazingFeature`
3. Commit perubahan: `git commit -m 'Add some AmazingFeature'`
4. Push ke branch: `git push origin feature/AmazingFeature`
5. Buka Pull Request

---

## 📄 License

Project ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

---

## 👥 Authors

- **Project Creator** - [Your Name]
- **Contributors** - Silakan tambahkan nama Anda di sini

---

## 🎓 Learning Resources

Jika ingin belajar dari project ini:

1. **Frontend Development**: Vanilla ES6 + Vite + Firebase SDK
2. **Backend Development**: Express.js + Firebase Admin + AI Integration
3. **DevOps**: Docker containerization & Cloud Run deployment
4. **AI Integration**: Google Gemini API untuk travel planning

---

## 📞 Support & Contact

- **Issues**: Buka [GitHub Issues](https://github.com/yourusername/Jelajah-Nusantara-AI/issues)
- **Email**: your.email@example.com
- **Discord**: [Join Community](https://discord.gg/yourserver)

---

<div align="center">

Made with ❤️ for Indonesian Travelers

⭐ Jika project ini membantu, beri star di GitHub!

</div>

---

# 📖 Versi Indonesia

Dokumentasi lengkap tersedia di atas dalam bahasa Indonesia. Untuk menambahkan secara otomatis:

- Jalankan `npm run docs:i18n` untuk generate dokumentasi multi-bahasa
- Terjemahan akan tersedia di folder `docs/i18n/`

---

## ⚡ Quick Commands

```bash
# Development
npm run dev:backend        # Terminal 1: Backend dev server
npm run dev:frontend       # Terminal 2: Frontend dev server

# Production
npm run build:frontend     # Build frontend
npm run start:backend      # Start backend production

# Docker
npm run docker:build       # Build Docker image
npm run docker:run         # Run Docker container

# Deployment
npm run deploy:cloudrun    # Deploy ke Google Cloud Run
```

---

## 🌍 Roadmap

- [ ] Mobile app (React Native)
- [ ] Real-time collaboration untuk planning
- [ ] Social features (comments, likes, sharing)
- [ ] Payment integration untuk booking
- [ ] Offline support dengan Service Workers
- [ ] Multi-language support (English, Mandarin, Japanese)
- [ ] AI chatbot untuk customer support
- [ ] Advanced analytics dashboard

---

**Last Updated**: June 2024  
**Version**: 1.0.0
