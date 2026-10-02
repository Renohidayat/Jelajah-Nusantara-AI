// ============================================================
//  Jelajah Nusantara — Backend Server
//  Stack : Express + Firebase Admin + Gemini AI + Multer
//  Port  : 8080
// ============================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { generateContent, generateContentStream } from "./ai/openagentic.js";
import { rateLimit } from "express-rate-limit";
import { fileTypeFromBuffer } from "file-type";

dotenv.config();

// ─────────────────────────────────────────────
//  1. FIREBASE ADMIN INITIALIZATION
//     CRITICAL: Replace \\n → \n in private key
// ─────────────────────────────────────────────
const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    // ✅ CRITICAL BUG FIX: Parse escaped newlines from .env
    private_key: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '')
        : undefined,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL };

let adminApp;
let db;
let adminAuth;

try {
    adminApp = initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
    console.log("✅ Firebase Admin initialized successfully.");
} catch (err) {
    console.error("❌ Firebase Admin initialization failed:", err.message);
    // Don't process.exit on serverless environments to avoid generic 500 errors
}

// OpenAgentic AI Initialization is handled in backend/ai/openagentic.js

// ─────────────────────────────────────────────
//  3. EXPRESS APP & MIDDLEWARE
// ─────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 8080;

// ✅ CORS: Baca dari .env (ALLOWED_ORIGINS)
let ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];

if (process.env.NODE_ENV !== 'production') {
    ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:8080');
} else if (ALLOWED_ORIGINS.length === 0) {
    console.warn('⚠️ WARNING: ALLOWED_ORIGINS is empty in production. No external origins will be able to access the API.');
}

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, curl, Postman)
            if (!origin) return callback(null, true);
            
            // Allow if origin is explicitly in ALLOWED_ORIGINS
            if (ALLOWED_ORIGINS.includes(origin)) {
                return callback(null, true);
            }
            
            // Allow specific project deployments (production and preview)
            if (/^https:\/\/jelajah-nusantara-ai(?:-[\w-]+)?\.vercel\.app$/.test(origin)) {
                return callback(null, true);
            }
            
            console.warn(`⚠️ CORS blocked for origin: ${origin}`);
            // Don't throw Error to avoid triggering 500 Global Error Handler
            // Instead, pass false to reject CORS gracefully
            callback(null, false);
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true })
);

if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}


app.use(
    helmet({
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        contentSecurityPolicy: {
            reportOnly: true,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://lh3.googleusercontent.com"],
                connectSrc: ["'self'", "https://firebasestorage.googleapis.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com"]
            }
        }
    })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Optional token verification for rate limiter
const optionalVerifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
            const idToken = authHeader.split("Bearer ")[1];
            req.user = await adminAuth.verifyIdToken(idToken);
        } catch (err) {}
    }
    next();
};

const aiRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: (req, res) => {
        return req.user 
            ? parseInt(process.env.RATE_LIMIT_UID_MAX || "5", 10) 
            : parseInt(process.env.RATE_LIMIT_IP_MAX || "10", 10);
    },
    keyGenerator: (req) => req.user ? req.user.uid : (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().replace(/::ffff:/, ''),
    message: { error: "Terlalu banyak permintaan. Silakan coba lagi beberapa saat kemudian." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false }
});

const apiRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: parseInt(process.env.RATE_LIMIT_GENERAL_MAX || "100", 10),
    keyGenerator: (req) => req.user ? req.user.uid : (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().replace(/::ffff:/, ''),
    message: { error: "Terlalu banyak permintaan API. Silakan coba lagi nanti." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false }
});

const aiVisionRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: (req, res) => {
        return req.user 
            ? parseInt(process.env.RATE_LIMIT_VISION_UID_MAX || "3", 10) 
            : parseInt(process.env.RATE_LIMIT_VISION_IP_MAX || "5", 10);
    },
    keyGenerator: (req) => req.user ? req.user.uid : (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().replace(/::ffff:/, ''),
    message: { error: "Terlalu banyak permintaan analisis gambar. Silakan coba lagi nanti." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false }
});

// ─────────────────────────────────────────────
//  4. MULTER — In-Memory Storage for Images
// ─────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5 MB max, 1 file
    fileFilter: (_req, file, cb) => {
        const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
        if (ALLOWED_MIME.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only image files (JPEG, PNG, WEBP, GIF, HEIC) are allowed."));
        }
    } });

// ─────────────────────────────────────────────
//  5. AUTH MIDDLEWARE — Verify Firebase ID Token
// ─────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or malformed token." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        req.user = decodedToken; // { uid, email, name, picture, ... }
        next();
    } catch (err) {
        console.error("Token verification failed:", err.message);
        return res.status(403).json({ error: "Forbidden: Invalid or expired token." });
    }
};

// ─────────────────────────────────────────────
//  Admin helpers + Gemini key persistence (Firestore)
// ─────────────────────────────────────────────
const ADMIN_UIDS = (process.env.ADMIN_UIDS || "").split(",").map(s => s.trim()).filter(Boolean);
function isAdmin(req) {
    if (!req.user) return false;
    if (req.user.admin) return true; // custom claim
    return ADMIN_UIDS.includes(req.user.uid);
}


// ─────────────────────────────────────────────
//  6. HELPER — Build Prompts
// ─────────────────────────────────────────────
const buildItinerarySystemPrompt = () => `Kamu adalah "Jelajah AI", asisten perjalanan terbaik di Indonesia yang ahli dalam merencanakan wisata domestik.
BALAS HANYA DENGAN JSON VALID, TANPA TEKS LAIN.
FORMAT JSON YANG WAJIB DIIKUTI:
{
  "itinerary_markdown": "# ✈️ Itinerary: ...

## 📋 Ringkasan Perjalanan
...

## 📅 Hari 1: Tema...
...",
  "budget": [
    {"name": "Transportasi", "amount": 100000},
    {"name": "Akomodasi", "amount": 200000},
    {"name": "Makan & Minum", "amount": 50000},
    {"name": "Tiket Wisata", "amount": 50000},
    {"name": "Oleh-oleh & Lain-lain", "amount": 50000}
  ]
}

ATURAN:
- "itinerary_markdown": Berisi itinerary lengkap dalam format Markdown, mirip contoh tapi tanpa tabel budget.
- "budget": Array objek biaya dengan "name" dan "amount" dalam angka bulat (tanpa Rp/titik).
- PENTING: TOTAL BIAYA (penjumlahan seluruh "amount") ADALAH UNTUK KESELURUHAN GRUP/KELUARGA (BUKAN per orang). Total akhirnya wajib di bawah atau sama dengan: ("Estimasi Anggaran" harian * "Durasi Perjalanan"). Jangan membuat budget yang menggelembung!
`;

const buildItinerarySystemPromptStream = () => `Kamu adalah "Jelajah AI", asisten perjalanan terbaik di Indonesia yang ahli dalam merencanakan wisata domestik.
TULISKAN ITINERARY LANGSUNG DALAM FORMAT MARKDOWN (tanpa blok JSON).
Setelah seluruh teks itinerary selesai (termasuk penutup jika ada), KETIKKAN PERSIS BARIS BERIKUT SEBAGAI PEMISAH:
---BUDGET---
Di baris berikutnya, tuliskan HANYA JSON array berisi rincian budget, TANPA TEKS LAIN, TANPA MARKDOWN CODE BLOCKS.
Contoh JSON budget di bagian akhir:
[
  {"name": "Transportasi", "amount": 100000},
  {"name": "Akomodasi", "amount": 200000}
]

ATURAN PENTING SOAL ANGGARAN:
- Format itinerary bebas asalkan rapi, menarik, dan detail per hari. Jangan buat tabel budget di dalam teks.
- Bagian JSON di akhir harus berupa array objek murni. Biaya dalam angka bulat (tanpa Rp/titik).
- TOTAL KESELURUHAN BIAYA (penjumlahan seluruh "amount") ADALAH UNTUK KESELURUHAN GRUP/KELUARGA.
- BATAS MAKSIMAL ANGGARAN: Jika Estimasi Anggaran adalah "Rp 1-3 juta/hari" dan Durasi "3 hari", batas maksimal total adalah 3 juta x 3 hari = 9 juta. Total dari JSON kamu TIDAK BOLEH lebih dari batas maksimal yang didapat dari perkalian tersebut! Sesuaikan fasilitas dengan budget.
`;

const buildItineraryPrompt = ({ origin, destination, duration, budget, style }) => `
Buatkan itinerary perjalanan yang detail, menarik, dan realistis berdasarkan informasi berikut:
- **Asal Keberangkatan:** ${origin || "Tidak ditentukan"}
- **Destinasi Utama:** ${destination}
- **Durasi Perjalanan:** ${duration} hari
- **Estimasi Anggaran Harian:** ${budget} (KALIKAN estimasi ini dengan ${duration} hari untuk mendapat batas maksimal. BIAYA TOTAL KESELURUHAN HARUS DI BAWAH ATAU SAMA DENGAN BATAS MAKSIMAL TERSEBUT)
- **Gaya Wisata:** ${style}
`;

const buildVisionSystemPrompt = () => `Kamu adalah "Jelajah AI", asisten perjalanan terbaik di Indonesia.
BALAS HANYA DENGAN JSON VALID, TANPA TEKS LAIN.
FORMAT JSON YANG WAJIB DIIKUTI:
{
  "itinerary_markdown": "## 📸 Identifikasi Tempat
...

# ✈️ Itinerary: ...",
  "budget": [
    {"name": "Transportasi", "amount": 100000}
  ]
}
`;

const buildVisionSystemPromptStream = () => `Kamu adalah "Jelajah AI", asisten perjalanan terbaik di Indonesia.
TULISKAN ITINERARY LANGSUNG DALAM FORMAT MARKDOWN (tanpa blok JSON).
Awali dengan "## 📸 Identifikasi Tempat", lalu ikuti dengan itinerary.
Setelah seluruh teks itinerary selesai (termasuk penutup jika ada), KETIKKAN PERSIS BARIS BERIKUT SEBAGAI PEMISAH:
---BUDGET---
Di baris berikutnya, tuliskan HANYA JSON array berisi rincian budget, TANPA TEKS LAIN.
Contoh:
[
  {"name": "Transportasi", "amount": 100000}
]
`;

const buildVisionPrompt = (destination) => `
Pengguna mengunggah sebuah foto ${destination ? `dari ${destination}` : "sebuah tempat wisata"}.
1. Identifikasi tempat wisata pada foto. Jika bukan di Indonesia, sarankan 3 destinasi mirip.
2. Jika di Indonesia, buatkan itinerary 3 hari.
`;

const buildLocationExtractionPrompt = (itineraryText, duration) => `
Ekstrak tempat wisata dari itinerary berikut. Kembalikan HANYA JSON valid, tanpa teks lain.

Format WAJIB:
{"days":[{"day":"Hari 1","theme":"Tema maks 4 kata","locations":[{"name":"Nama Tempat","lat":-8.4095,"lng":115.1889,"desc":"1 kalimat","time":"Pagi"}]}]}

ATURAN:
- Nilai "time" HANYA: "Pagi", "Siang", atau "Malam"
- Koordinat lat/lng HARUS akurat untuk lokasi nyata di Indonesia
- "day" bisa berupa angka atau string (misalnya "Hari 1").
- Sertakan 2-4 lokasi wisata utama per hari (bukan hotel/restoran biasa)

Itinerary:
${itineraryText}
`;


// ─────────────────────────────────────────────
//  7. ROUTES
// ─────────────────────────────────────────────

// ── 7.1  Health Check ──────────────────────────
app.get("/api/health", (_req, res) => {
    res.json({
        status: "✅ Jelajah Nusantara API is running",
        version: "1.0.0",
        timestamp: new Date().toISOString() });
});

// ── 7.1b EXTRACT LOCATIONS FOR MAP ─────────────




app.post("/api/extract-locations", verifyToken, aiRateLimiter, async (req, res) => {
    const { itineraryText, duration } = req.body;
    if (!itineraryText || itineraryText.length < 100) return res.status(400).json({ error: "itineraryText terlalu pendek." });
    
    const estimatedDays = duration ? parseInt(duration) : 3;
    const prompt = buildLocationExtractionPrompt(itineraryText, estimatedDays);
    
    try {
        const data = await generateContent("Anda adalah ekstraktor JSON.", prompt, false);
        return res.json(data);
    } catch (err) {
        console.error("❌ Extract locations error:", err);
        return res.status(err.status || 500).json({ error: err.publicMessage || "Gagal mengekstrak lokasi." });
    }
});

/**
 * Attempt to recover complete day objects from a truncated JSON string.
 * Finds all fully-formed { "day": N, ... } objects even if the outer array is cut off.
 */
function attemptJSONSalvage(brokenJson) {
    try {
        // Try to find all complete day objects using a greedy regex
        const dayPattern = /\{\s*"day"\s*:\s*\d+[\s\S]*?"locations"\s*:\s*\[[\s\S]*?\]\s*\}/g;
        const matches = brokenJson.match(dayPattern) || [];
        const days = matches
            .map(m => { try { return JSON.parse(m); } catch { return null; } })
            .filter(Boolean);

        return days.length > 0 ? { days } : null;
    } catch {
        return null;
    }
}

// ── 7.2  PUBLIC FIREBASE CONFIG ────────────────
// ✅ SECURITY: Frontend fetches keys from here, NOT hardcoded in HTML
app.get("/api/config", (_req, res) => {
    const config = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
        visionEnabled: process.env.AI_VISION_ENABLED !== 'false' };

    // Validate mandatory keys before sending
    const mandatoryKeys = ['apiKey', 'projectId', 'appId'];
    const missing = mandatoryKeys.filter(k => !config[k]);

    if (missing.length > 0) {
        console.error("❌ Missing mandatory Firebase config env vars:", missing);
        return res.status(500).json({ error: "Server misconfiguration: missing mandatory Firebase keys: " + missing.join(", ") });
    }
    
    // Log warning for optional keys but don't crash
    const missingOptional = Object.entries(config).filter(([k, v]) => !v && !mandatoryKeys.includes(k)).map(([k]) => k);
    if (missingOptional.length > 0) {
        console.warn("⚠️ Missing optional Firebase config env vars:", missingOptional);
    }

    res.json(config);
});

// ── 7.3  AI GENERATE — Text Input ──────────────
app.post("/api/generate", verifyToken, aiRateLimiter, async (req, res) => {
    const { origin, destination, duration, budget, style } = req.body;
    
    if (!destination || !duration || !budget || !style) {
        return res.status(400).json({ error: "Data destinasi, durasi, anggaran, dan gaya wisata wajib diisi." });
    }

    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    // Flush headers to ensure the client connects immediately
    res.flushHeaders();

    const tripData = { origin, destination, duration, budget, style };
    res.write(`data: ${JSON.stringify({ type: 'meta', tripData })}\n\n`);

    try {
        const systemPrompt = buildItinerarySystemPromptStream();
        const userPrompt = buildItineraryPrompt({ origin, destination, duration, budget, style });
        
        await generateContentStream(systemPrompt, userPrompt, false, null, null, (chunk) => {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        });
        
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (err) {
        console.error("❌ Generate stream error:", err);
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.publicMessage || "Gagal membuat itinerary." })}\n\n`);
    }
    res.end();
});

// ── 7.4  AI GENERATE — Vision / Image Upload ───
app.post("/api/generate-vision", verifyToken, aiVisionRateLimiter, upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Gambar wajib diunggah." });
    }
    const ft = await fileTypeFromBuffer(req.file.buffer);
    if (!ft || !ft.mime.startsWith("image/")) {
        return res.status(400).json({ error: "File bukan gambar yang valid." });
    }
    const mimeType = ft.mime;
    const base64Image = req.file.buffer.toString("base64");
    const { destination } = req.body;
    
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    
    const tripData = { origin: "", destination: destination || "Berdasarkan Foto", duration: 3, budget: "Mid-Range", style: "Eksplorasi" };
    res.write(`data: ${JSON.stringify({ type: 'meta', tripData })}\n\n`);

    try {
        const systemPrompt = buildVisionSystemPromptStream();
        const userPrompt = buildVisionPrompt(destination);
        
        await generateContentStream(systemPrompt, userPrompt, true, base64Image, mimeType, (chunk) => {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        });
        
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (err) {
        console.error("❌ Generate vision error:", err);
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.publicMessage || "Gagal menganalisis gambar." })}\n\n`);
    }
    res.end();
});

// ── 7.5  SAVE ITINERARY ────────────────────────
app.post("/api/itineraries", verifyToken, apiRateLimiter, async (req, res) => {
    const { tripData, itineraryText, isPublic = false } = req.body;

    if (!tripData || !itineraryText) {
        return res.status(400).json({ error: "Data 'tripData' dan 'itineraryText' wajib ada." });
    }

    try {
        const docRef = await db.collection("itineraries").add({
            userId: req.user.uid,
            userName: req.user.name || req.user.email || "Traveler",
            userPhoto: req.user.picture || "",
            isPublic: Boolean(isPublic),
            createdAt: FieldValue.serverTimestamp(),
            tripData: {
                origin: tripData.origin || "",
                destination: tripData.destination || "",
                duration: tripData.duration || "",
                budget: tripData.budget || "",
                style: tripData.style || "" },
            itineraryText,
            likes: 0,
            rating: 0 });

        console.log(`✅ Itinerary saved: ${docRef.id} by ${req.user.uid}`);
        return res.status(201).json({ success: true, id: docRef.id });
    } catch (err) {
        console.error("❌ Firestore save error:", err);
        return res.status(500).json({ error: "Gagal menyimpan itinerary." });
    }
});

// ── 7.6  GET MY TRIPS ──────────────────────────
app.get("/api/itineraries/my", verifyToken, async (req, res) => {
    try {
        const snapshot = await db
            .collection("itineraries")
            .where("userId", "==", req.user.uid)
            .orderBy("createdAt", "desc")
            .get();

        const trips = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore Timestamp → ISO string for JSON
            createdAt: doc.data().createdAt?.toDate().toISOString() || null }));

        return res.json({ success: true, trips });
    } catch (err) {
        console.error("❌ Firestore fetch (my trips) error:", err);
        return res.status(500).json({ error: "Gagal mengambil itinerary." });
    }
});

// ── 7.7  GET PUBLIC / COMMUNITY ITINERARIES ────
app.get("/api/itineraries/public", apiRateLimiter, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const snapshot = await db
            .collection("itineraries")
            .where("isPublic", "==", true)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();

        const trips = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                userId: data.userId,
                userName: data.userName,
                userPhoto: data.userPhoto,
                isPublic: data.isPublic,
                createdAt: data.createdAt?.toDate().toISOString() || null,
                tripData: data.tripData,
                // Omit full itineraryText for list view (send only a preview)
                itineraryPreview: data.itineraryText
                    ? data.itineraryText.substring(0, 300) + "..."
                    : "",
                likes: data.likes || 0,
                rating: data.rating || 0 };
        });

        return res.json({ success: true, trips });
    } catch (err) {
        console.error("❌ Firestore fetch (public) error:", err);
        return res.status(500).json({ error: "Gagal mengambil itinerary publik." });
    }
});

// ── 7.8  GET SINGLE ITINERARY BY ID ───────────
app.get("/api/itineraries/:id", apiRateLimiter, async (req, res) => {
    try {
        const doc = await db.collection("itineraries").doc(req.params.id).get();

        if (!doc.exists) {
            return res.status(404).json({ error: "Itinerary tidak ditemukan." });
        }

        const data = doc.data();

        // Private itinerary: only owner can access (check token if provided)
        if (!data.isPublic) {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(403).json({ error: "Itinerary ini bersifat privat." });
            }
            try {
                const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
                if (decoded.uid !== data.userId) {
                    return res.status(403).json({ error: "Akses ditolak." });
                }
            } catch {
                return res.status(403).json({ error: "Token tidak valid." });
            }
        }

        return res.json({
            success: true,
            trip: {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate().toISOString() || null } });
    } catch (err) {
        console.error("❌ Firestore fetch (single) error:", err);
        return res.status(500).json({ error: "Gagal mengambil itinerary." });
    }
});

// ── 7.9  UPDATE ITINERARY (toggle public, etc.) ─
app.patch("/api/itineraries/:id", verifyToken, apiRateLimiter, async (req, res) => {
    const { isPublic } = req.body;

    try {
        const ref = db.collection("itineraries").doc(req.params.id);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).json({ error: "Itinerary tidak ditemukan." });
        }
        if (doc.data().userId !== req.user.uid) {
            return res.status(403).json({ error: "Akses ditolak." });
        }

        const updates = {};
        if (typeof isPublic === "boolean") updates.isPublic = isPublic;

        await ref.update(updates);
        return res.json({ success: true, message: "Itinerary diperbarui." });
    } catch (err) {
        console.error("❌ Firestore update error:", err);
        return res.status(500).json({ error: "Gagal memperbarui itinerary." });
    }
});

// ── 7.10 DELETE ITINERARY ─────────────────────
app.delete("/api/itineraries/:id", verifyToken, apiRateLimiter, async (req, res) => {
    try {
        const ref = db.collection("itineraries").doc(req.params.id);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).json({ error: "Itinerary tidak ditemukan." });
        }
        if (doc.data().userId !== req.user.uid) {
            return res.status(403).json({ error: "Akses ditolak." });
        }

        await ref.delete();
        return res.json({ success: true, message: "Itinerary berhasil dihapus." });
    } catch (err) {
        console.error("❌ Firestore delete error:", err);
        return res.status(500).json({ error: "Gagal menghapus itinerary." });
    }
});

// ── 7.11 LIKE AN ITINERARY ────────────────────
app.post("/api/itineraries/:id/like", verifyToken, apiRateLimiter, async (req, res) => {
    const uid = req.user.uid;
    const ref = db.collection("itineraries").doc(req.params.id);
    
    try {
        const result = await db.runTransaction(async (t) => {
            const doc = await t.get(ref);
            if (!doc.exists) throw { status: 404, message: "Itinerary tidak ditemukan." };
            
            const data = doc.data();
            const likedBy = data.likedBy || [];
            let newLikes = data.likes || 0;
            let isLiked = false;
            
            if (likedBy.includes(uid)) {
                // Unlike
                t.update(ref, { 
                    likedBy: FieldValue.arrayRemove(uid),
                    likes: FieldValue.increment(-1)
                });
                isLiked = false;
                newLikes = Math.max(0, newLikes - 1);
            } else {
                // Like
                t.update(ref, {
                    likedBy: FieldValue.arrayUnion(uid),
                    likes: FieldValue.increment(1)
                });
                isLiked = true;
                newLikes++;
            }
            return { isLiked, newLikes };
        });
        
        return res.json({ 
            success: true, 
            message: result.isLiked ? "Itinerary disukai!" : "Batal menyukai itinerary.",
            likes: result.newLikes,
            isLiked: result.isLiked
        });
    } catch (err) {
        console.error("❌ Firestore like transaction error:", err);
        if (err.status) return res.status(err.status).json({ error: err.message });
        return res.status(500).json({ error: "Gagal memproses like." });
    }
});
;

// ─────────────────────────────────────────────
//  7.12 SERVING STATIC FILES (FRONTEND)
// ─────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));



// Handler cadangan untuk mengarahkan rute non-API ke index.html (SPA routing support)
app.get("*", (req, res, next) => {
    // Jika request mengarah ke rute API tetapi tidak terdaftar, lanjutkan ke error/404
    if (req.path.startsWith("/api")) {
        return next();
    }
    res.sendFile(path.join(publicPath, "index.html"));
});

// ─────────────────────────────────────────────
//  8. GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    // Multer-specific errors
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File terlalu besar. Maksimum 5 MB." });
    }
    if (err.message && err.message.includes("Only image files")) {
        return res.status(415).json({ error: err.message });
    }
    
    const reqId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    console.error(`❌ [${reqId}] Unhandled error:`, err);
    return res.status(500).json({ error: "Terjadi kesalahan server.", reqId });
});

// ─────────────────────────────────────────────
//  9. START SERVER
// ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Jelajah Nusantara API running on http://localhost:${PORT}`);
    console.log(`   ├─ Health  : GET  /`);
    console.log(`   ├─ Config  : GET  /api/config`);
    console.log(`   ├─ Generate: POST /api/generate`);
    console.log(`   ├─ Vision  : POST /api/generate-vision`);
    console.log(`   └─ Trips   : CRUD /api/itineraries\n`);
});

// ✅ Wajib untuk deploy Vercel Serverless
export default app;
