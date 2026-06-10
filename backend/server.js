// ============================================================
//  Jelajah Nusantara — Backend Server
//  Stack : Express + Firebase Admin + Gemini AI + Multer
//  Port  : 8080
// ============================================================

import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

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
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
};

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
    process.exit(1);
}

// ─────────────────────────────────────────────
//  2. GEMINI AI INITIALIZATION + Multi-key rotation
//     Supports multiple GEMINI API keys via `GEMINI_API_KEYS`
//     (comma-separated) with automatic rotation and cooldown.
// ─────────────────────────────────────────────
const RAW_GEMINI_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "").split(",").map(k => k.trim()).filter(Boolean);
if (RAW_GEMINI_KEYS.length === 0) {
    console.error("❌ No Gemini API keys found. Set GEMINI_API_KEYS or GEMINI_API_KEY in .env");
    process.exit(1);
}

const GEMINI_KEY_COOLDOWN_MS = parseInt(process.env.GEMINI_KEY_COOLDOWN_MS || "60000", 10); // default 60s

const genAIClients = new Map();
const keyStates = RAW_GEMINI_KEYS.map(k => ({ key: k, disabledUntil: 0 }));
let roundRobinIndex = 0;

function getClientForKey(key) {
    if (!genAIClients.has(key)) genAIClients.set(key, new GoogleGenerativeAI(key));
    return genAIClients.get(key);
}

function findNextKeyIndex() {
    const now = Date.now();
    const n = keyStates.length;
    for (let i = 0; i < n; i++) {
        const idx = (roundRobinIndex + i) % n;
        if (keyStates[idx].disabledUntil <= now) {
            roundRobinIndex = (idx + 1) % n;
            return idx;
        }
    }
    // If all keys are in cooldown, still return the next index (best-effort)
    const idx = roundRobinIndex % n;
    roundRobinIndex = (idx + 1) % n;
    return idx;
}

/**
 * Generate content using modelName and rotate across keys when encountering 429/503.
 * Returns the same result object as `model.generateContent`.
 */
async function generateContentWithRotation(modelName, generationConfig, prompt) {
    let lastErr;
    const attempts = keyStates.length;
    for (let a = 0; a < attempts; a++) {
        const idx = findNextKeyIndex();
        const key = keyStates[idx].key;
        const client = getClientForKey(key);
        const model = client.getGenerativeModel({ model: modelName, safetySettings, generationConfig });
        try {
            const result = await withGeminiRetry(() => model.generateContent(prompt));
            return result;
        } catch (err) {
            lastErr = err;
            const status = err?.status ?? err?.statusCode;
            if (status === 429 || status === 503) {
                keyStates[idx].disabledUntil = Date.now() + GEMINI_KEY_COOLDOWN_MS;
                console.warn(`⚠️ Gemini key at index ${idx} temporarily disabled until ${new Date(keyStates[idx].disabledUntil).toISOString()} (status=${status})`);
                continue; // try next key
            }
            throw err; // non-retryable error
        }
    }
    throw lastErr || new Error("All Gemini keys exhausted or failed.");
}

/**
 * Try primary model first; if it fails due to rate/overload, fallback to other model.
 */
async function generateWithFallback(primaryModel, fallbackModel, generationConfig, prompt) {
    try {
        return await generateContentWithRotation(primaryModel, generationConfig, prompt);
    } catch (err) {
        const status = err?.status ?? err?.statusCode;
        if (status === 503 || status === 429) {
            console.warn(`⚠️ ${primaryModel} unavailable (${status}), falling back to ${fallbackModel}…`);
            return await generateContentWithRotation(fallbackModel, generationConfig, prompt);
        }
        throw err;
    }
}

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// ─────────────────────────────────────────────
//  3. EXPRESS APP & MIDDLEWARE
// ─────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 8080;

// ✅ CORS: Baca dari .env (ALLOWED_ORIGINS), dengan fallback localhost untuk dev
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:8080',
    ...(process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
        : []),
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, curl, Postman)
            if (!origin) return callback(null, true);
            if (ALLOWED_ORIGINS.includes(origin)) {
                return callback(null, true);
            }
            callback(new Error(`CORS policy: Origin ${origin} not allowed.`));
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─────────────────────────────────────────────
//  4. MULTER — In-Memory Storage for Images
// ─────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (_req, file, cb) => {
        const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
        if (ALLOWED_MIME.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only image files (JPEG, PNG, WEBP, GIF, HEIC) are allowed."));
        }
    },
});

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

async function loadKeysFromFirestore() {
    try {
        const snapshot = await db.collection('gemini_keys').orderBy('createdAt', 'asc').get();
        if (!snapshot.empty) {
            // replace in-memory keys with persisted ones
            keyStates.length = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.key) {
                    keyStates.push({ key: data.key, disabledUntil: data.disabledUntil || 0, id: doc.id });
                    // ensure client instance exists
                    getClientForKey(data.key);
                }
            });
            console.log(`✅ Loaded ${keyStates.length} Gemini keys from Firestore.`);
        } else {
            console.log('ℹ️ No Gemini keys found in Firestore; using environment keys.');
        }
    } catch (err) {
        console.error('❌ Failed to load Gemini keys from Firestore:', err.message);
    }
}

async function persistKeyToFirestore(key) {
    try {
        const docRef = await db.collection('gemini_keys').add({ key, disabledUntil: 0, createdAt: FieldValue.serverTimestamp() });
        await loadKeysFromFirestore();
        return docRef.id;
    } catch (err) {
        throw err;
    }
}

async function removeKeyFromFirestore(id) {
    try {
        await db.collection('gemini_keys').doc(id).delete();
        await loadKeysFromFirestore();
    } catch (err) {
        throw err;
    }
}

async function updateKeyInFirestore(id, updates) {
    try {
        await db.collection('gemini_keys').doc(id).update(updates);
        await loadKeysFromFirestore();
    } catch (err) {
        throw err;
    }
}

// ─────────────────────────────────────────────
//  6. HELPER — Build Gemini Prompt
// ─────────────────────────────────────────────
const buildItineraryPrompt = ({ origin, destination, duration, budget, style }) => `
Kamu adalah "Jelajah AI", asisten perjalanan terbaik di Indonesia yang ahli dalam merencanakan
wisata domestik. Buatkan itinerary perjalanan yang detail, menarik, dan realistis berdasarkan
informasi berikut:

- **Asal Keberangkatan:** ${origin || "Tidak ditentukan"}
- **Destinasi Utama:** ${destination}
- **Durasi Perjalanan:** ${duration} hari
- **Estimasi Anggaran:** ${budget}
- **Gaya Wisata:** ${style}

**FORMAT OUTPUT YANG WAJIB KAMU IKUTI (Markdown):**

# ✈️ Itinerary: ${destination} (${duration} Hari)

## 📋 Ringkasan Perjalanan
[Tulis paragraf singkat 2-3 kalimat tentang perjalanan ini]

## 💰 Estimasi Anggaran Total
| Kategori | Estimasi Biaya |
|---|---|
| Transportasi | Rp. ... |
| Akomodasi | Rp. ... |
| Makan & Minum | Rp. ... |
| Tiket Wisata | Rp. ... |
| Oleh-oleh & Lain-lain | Rp. ... |
| **TOTAL** | **Rp. ...** |

---

[Untuk setiap hari dari Hari 1 hingga Hari ${duration}, gunakan format berikut:]

## 📅 Hari [N]: [Tema Hari Ini]

### 🌅 Pagi (07.00 - 12.00)
- **[Nama Tempat/Aktivitas]:** [Deskripsi singkat, tips, estimasi biaya masuk, waktu yang dihabiskan]

### ☀️ Siang (12.00 - 17.00)
- **[Nama Tempat/Aktivitas]:** [Deskripsi singkat, tips, estimasi biaya masuk, waktu yang dihabiskan]
- **🍽️ Rekomendasi Makan Siang:** [Nama restoran/warung, lokasi, estimasi harga per orang]

### 🌙 Malam (17.00 - 21.00)
- **[Nama Tempat/Aktivitas]:** [Deskripsi singkat, tips]
- **🍽️ Rekomendasi Makan Malam:** [Nama restoran/warung, lokasi, estimasi harga per orang]

---

## 💡 Tips Penting
- [Minimal 3-5 tips spesifik untuk destinasi ini]

## 🏨 Rekomendasi Akomodasi
| Nama Hotel/Penginapan | Tipe | Estimasi Harga/Malam |
|---|---|---|
| ... | Budget/Mid/Luxury | Rp. ... |

Pastikan semua rekomendasi tempat wisata, restoran, dan akomodasi adalah nyata dan ada di ${destination}.
Gunakan Bahasa Indonesia yang ramah, informatif, dan mengajak.

**PENTING — DATA ANGGARAN TERSTRUKTUR:**
Di bagian PALING AKHIR output, setelah semua konten Markdown, kamu WAJIB menambahkan blok data anggaran
dalam format berikut (persis seperti ini, tanpa modifikasi format):

<!--BUDGET_JSON
{"categories":[{"name":"Transportasi","amount":ANGKA},{"name":"Akomodasi","amount":ANGKA},{"name":"Makan & Minum","amount":ANGKA},{"name":"Tiket Wisata","amount":ANGKA},{"name":"Oleh-oleh & Lain-lain","amount":ANGKA}],"total":ANGKA_TOTAL,"currency":"IDR"}
BUDGET_JSON-->

ATURAN untuk blok BUDGET_JSON:
- Ganti ANGKA dengan estimasi biaya dalam Rupiah (angka bulat, TANPA titik/koma/Rp)
- "total" adalah jumlah semua amount
- Angka harus realistis dan sesuai dengan anggaran "${budget}" untuk ${duration} hari di ${destination}
- JANGAN menambahkan teks apapun setelah blok BUDGET_JSON
`;

const buildVisionPrompt = (destination) => `
Kamu adalah "Jelajah AI", asisten perjalanan terbaik di Indonesia.
Pengguna mengunggah sebuah foto ${destination ? `dari ${destination}` : "sebuah tempat wisata"}.

Lakukan hal berikut:
1. **Identifikasi** tempat wisata pada foto tersebut (nama tempat, kota/provinsi, Indonesia).
2. **Jika foto bukan tempat wisata di Indonesia**, sampaikan dengan sopan bahwa aplikasi ini
   fokus pada wisata Nusantara, lalu sarankan 3 destinasi Indonesia yang mirip.
3. **Jika foto adalah tempat wisata Indonesia**, buatkan itinerary 3 hari singkat untuk
   mengunjungi tempat tersebut dan sekitarnya, dengan format Markdown yang sama seperti
   panduan di bawah ini.

**FORMAT OUTPUT (Markdown):**

## 📸 Identifikasi Tempat
**Nama Tempat:** [Nama Tempat]
**Lokasi:** [Kota, Provinsi, Indonesia]
**Deskripsi Singkat:** [2-3 kalimat tentang tempat ini]

---

# ✈️ Itinerary: [Nama Tempat] (3 Hari)

[Lanjutkan dengan format itinerary lengkap per hari seperti yang sudah dijelaskan]

## 💡 Tips Berkunjung
- [3-5 tips spesifik]

Gunakan Bahasa Indonesia yang ramah dan informatif.

**PENTING — DATA ANGGARAN TERSTRUKTUR:**
Di bagian PALING AKHIR output, setelah semua konten Markdown, kamu WAJIB menambahkan blok data anggaran
dalam format berikut (persis seperti ini, tanpa modifikasi format):

<!--BUDGET_JSON
{"categories":[{"name":"Transportasi","amount":ANGKA},{"name":"Akomodasi","amount":ANGKA},{"name":"Makan & Minum","amount":ANGKA},{"name":"Tiket Wisata","amount":ANGKA},{"name":"Oleh-oleh & Lain-lain","amount":ANGKA}],"total":ANGKA_TOTAL,"currency":"IDR"}
BUDGET_JSON-->

ATURAN untuk blok BUDGET_JSON:
- Ganti ANGKA dengan estimasi biaya dalam Rupiah (angka bulat, TANPA titik/koma/Rp)
- "total" adalah jumlah semua amount
- Angka harus realistis untuk perjalanan 3 hari di destinasi foto tersebut dengan budget mid-range
- JANGAN menambahkan teks apapun setelah blok BUDGET_JSON
`;

// ─────────────────────────────────────────────
//  6b. HELPER — Extract Budget Data from AI Response
// ─────────────────────────────────────────────
function extractBudgetData(text) {
    try {
        const match = text.match(/<!--BUDGET_JSON\s*([\s\S]*?)\s*BUDGET_JSON-->/)
        if (!match) return null

        const json = match[1].trim()
        const data = JSON.parse(json)

        // Validate structure
        if (!data.categories || !Array.isArray(data.categories) || data.categories.length === 0) {
            return null
        }

        // Sanitize: ensure all amounts are positive numbers
        data.categories = data.categories
            .filter(c => c.name && typeof c.amount === 'number' && c.amount >= 0)
            .map(c => ({ name: String(c.name), amount: Math.round(c.amount) }))

        if (data.categories.length === 0) return null

        // Recalculate total from categories to avoid inconsistency
        data.total = data.categories.reduce((sum, c) => sum + c.amount, 0)
        data.currency = data.currency || 'IDR'

        console.log(`✅ Budget extracted: ${data.categories.length} categories, total Rp ${data.total.toLocaleString('id-ID')}`)
        return data
    } catch (err) {
        console.warn('⚠️  Budget JSON parse failed:', err.message)
        return null
    }
}

/** Strip the hidden BUDGET_JSON block from itinerary text before sending to client */
function stripBudgetBlock(text) {
    return text.replace(/<!--BUDGET_JSON[\s\S]*?BUDGET_JSON-->/g, '').trim()
}

// ─────────────────────────────────────────────
//  6c. HELPER — Build Location Extraction Prompt
// ─────────────────────────────────────────────
const buildLocationExtractionPrompt = (itineraryText, duration) => `
Ekstrak tempat wisata dari itinerary berikut. Kembalikan HANYA JSON valid, tanpa teks lain.

Format WAJIB:
{"days":[{"day":1,"theme":"Tema maks 4 kata","locations":[{"name":"Nama Tempat","lat":-8.4095,"lng":115.1889,"desc":"1 kalimat","time":"Pagi"}]}]}

ATURAN:
- Nilai "time" HANYA: "Pagi", "Siang", atau "Malam"
- Koordinat lat/lng HARUS akurat untuk lokasi nyata di Indonesia
- Sertakan 2-4 lokasi wisata utama per hari (bukan hotel/restoran biasa)
- Itinerary ini ${duration} hari — JSON HARUS berisi tepat ${duration} objek day
- Pastikan semua tanda kurung kurawal dan siku DITUTUP dengan benar

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
        timestamp: new Date().toISOString(),
    });
});

// ── 7.1b EXTRACT LOCATIONS FOR MAP ─────────────
/**
 * Retry a Gemini API call with exponential backoff.
 * Retries on 503 (overloaded) and 429 (rate limit) only.
 * @param {() => Promise} fn      - Async function to retry
 * @param {number}        maxTries - Max attempts (default 4)
 */
async function withGeminiRetry(fn, maxTries = 4) {
    const RETRYABLE = new Set([429, 503]);
    let lastErr;
    for (let attempt = 1; attempt <= maxTries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            const status = err?.status ?? err?.statusCode;
            if (!RETRYABLE.has(status)) throw err;           // Non-retryable → bail immediately

            if (attempt === maxTries) break;
            const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000); // 1s, 2s, 4s, 8s cap
            console.warn(`⚠️  Gemini ${status} on attempt ${attempt}/${maxTries} — retrying in ${delayMs}ms…`);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    throw lastErr;
}



app.post("/api/extract-locations", async (req, res) => {
    const { itineraryText, duration } = req.body;

    if (!itineraryText || itineraryText.length < 100) {
        return res.status(400).json({ error: "itineraryText wajib ada dan minimal 100 karakter." });
    }

    // Estimate expected days from itinerary text as a fallback
    const estimatedDays = duration
        ? parseInt(duration)
        : (itineraryText.match(/##\s*📅\s*Hari\s*\d+/gi) || []).length || 3;

    try {
        const generationConfig = {
            temperature: 0.1,
            responseMimeType: "application/json",
            // Naikkan limit: itinerary 7 hari butuh ~150 token/lokasi × 4 lokasi × 7 hari ≈ 4200 token minimum
            // Set 16384 agar tidak pernah terpotong untuk itinerary hingga 14 hari
            maxOutputTokens: 16384,
        };

        const prompt = buildLocationExtractionPrompt(itineraryText, estimatedDays);

        // ── Call Gemini dengan fallback otomatis ke model lebih stabil ──
        const result = await generateWithFallback(
            "gemini-2.5-flash",   // primary: lebih pintar
            "gemini-1.5-flash",   // fallback: lebih stabil saat demand tinggi
            generationConfig,
            prompt
        );
        const response = await result.response;
        const rawText = response.text().trim();

        // Log finish reason to diagnose truncation
        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
            console.warn(`⚠️  Gemini finished with reason: ${finishReason} (possible truncation)`);
        }

        // Strip markdown code fences if Gemini wraps it anyway
        const jsonText = rawText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let locationData;
        try {
            locationData = JSON.parse(jsonText);
        } catch (parseErr) {
            console.error("❌ JSON parse error. Raw snippet:", jsonText.substring(0, 500));
            const salvaged = attemptJSONSalvage(jsonText);
            if (salvaged) {
                console.warn(`⚠️  Salvaged ${salvaged.days.length} days from truncated JSON`);
                locationData = salvaged;
            } else {
                return res.status(500).json({ error: "AI mengembalikan format yang tidak valid." });
            }
        }

        if (!locationData.days || !Array.isArray(locationData.days)) {
            return res.status(500).json({ error: "Struktur data lokasi tidak valid." });
        }

        // Sanitize: ensure lat/lng are numbers and within Indonesia bounds
        // Normalize field: prompt baru pakai "desc", lama pakai "description" — unify ke "description"
        const INDONESIA_BOUNDS = { latMin: -11, latMax: 6, lngMin: 95, lngMax: 141 };
        locationData.days = locationData.days.map(day => ({
            ...day,
            locations: (day.locations || []).filter(loc => {
                const lat = parseFloat(loc.lat);
                const lng = parseFloat(loc.lng);
                const valid = (
                    !isNaN(lat) && !isNaN(lng) &&
                    lat >= INDONESIA_BOUNDS.latMin && lat <= INDONESIA_BOUNDS.latMax &&
                    lng >= INDONESIA_BOUNDS.lngMin && lng <= INDONESIA_BOUNDS.lngMax
                );
                if (!valid) console.warn(`⚠️  Filtered invalid coord: ${loc.name} (${lat}, ${lng})`);
                return valid;
            }).map(loc => ({
                name: loc.name,
                lat: parseFloat(loc.lat),
                lng: parseFloat(loc.lng),
                description: loc.description || loc.desc || "",
                time: loc.time || "Siang",
            }))
        })).filter(day => day.locations.length > 0);

        const totalLocs = locationData.days.reduce((sum, d) => sum + d.locations.length, 0);
        console.log(`✅ Extracted ${locationData.days.length}/${estimatedDays} days, ${totalLocs} total locations`);

        return res.json({ success: true, days: locationData.days });

    } catch (err) {
        const status = err?.status ?? err?.statusCode;
        const isOverloaded = status === 503;
        const isRateLimit = status === 429;

        console.error(`❌ Location extraction error [${status ?? 'unknown'}]:`, err.message);
        return res.status(isOverloaded || isRateLimit ? 503 : 500).json({
            error: isOverloaded
                ? "Server AI sedang sibuk, coba lagi dalam beberapa detik."
                : isRateLimit
                    ? "Terlalu banyak permintaan, coba lagi sebentar."
                    : "Gagal mengekstrak lokasi dari itinerary.",
            retryable: isOverloaded || isRateLimit,
            details: err.message,
        });
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
    };

    // Validate all keys are present before sending
    const missing = Object.entries(config)
        .filter(([, v]) => !v)
        .map(([k]) => k);

    if (missing.length > 0) {
        console.error("❌ Missing Firebase config env vars:", missing);
        return res.status(500).json({ error: "Server misconfiguration: missing Firebase keys." });
    }

    res.json(config);
});

// ── 7.3  AI GENERATE — Text Input ──────────────
app.post("/api/generate", async (req, res) => {
    const { origin, destination, duration, budget, style } = req.body;

    if (!destination || !duration || !budget || !style) {
        return res.status(400).json({
            error: "Field 'destination', 'duration', 'budget', dan 'style' wajib diisi.",
        });
    }

    try {
        const prompt = buildItineraryPrompt({ origin, destination, duration, budget, style });
        const generationConfig = { temperature: 0.7 };
        const result = await generateWithFallback(
            "gemini-2.5-flash",
            "gemini-1.5-flash",
            generationConfig,
            prompt
        );
        const response = await result.response;
        const rawText = response.text();

        if (!rawText) {
            return res.status(500).json({ error: "AI tidak menghasilkan konten. Coba lagi." });
        }

        // Extract budget breakdown before stripping the hidden block
        const budgetBreakdown = extractBudgetData(rawText);
        const itineraryText = stripBudgetBlock(rawText);

        return res.json({
            success: true,
            itineraryText,
            budgetBreakdown,
            tripData: { origin, destination, duration, budget, style },
        });
    } catch (err) {
        console.error("❌ Gemini text generation error:", err);
        return res.status(500).json({
            error: "Gagal menghubungi AI. Pastikan GEMINI_API_KEY valid.",
            details: err.message,
        });
    }
});

// ── 7.4  AI GENERATE — Vision / Image Upload ───
app.post("/api/generate-vision", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Tidak ada file gambar yang diupload." });
    }

    const destination = req.body.destination || "";

    try {
        // Gemini Vision requires base64-encoded image data
        const imageBase64 = req.file.buffer.toString("base64");
        const mimeType = req.file.mimetype;

        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType,
            },
        };

        const textPart = { text: buildVisionPrompt(destination) };

        const generationConfig = { temperature: 0.3, maxOutputTokens: 8192 };
        const result = await generateWithFallback(
            "gemini-2.5-flash",
            "gemini-1.5-flash",
            generationConfig,
            [textPart, imagePart]
        );
        const response = await result.response;
        const rawText = response.text();

        if (!rawText) {
            return res.status(500).json({ error: "AI tidak menghasilkan konten dari gambar ini." });
        }

        // Extract budget breakdown before stripping the hidden block
        const budgetBreakdown = extractBudgetData(rawText);
        const itineraryText = stripBudgetBlock(rawText);

        // Try to extract destination name from AI response for tripData
        const destMatch = itineraryText.match(/\*\*Nama Tempat:\*\*\s*(.+)/);
        const locMatch = itineraryText.match(/\*\*Lokasi:\*\*\s*(.+)/);
        const aiDestination = destMatch ? destMatch[1].trim() : destination || "Dari Foto";
        const aiLocation = locMatch ? locMatch[1].trim() : "Indonesia";

        return res.json({
            success: true,
            itineraryText,
            budgetBreakdown,
            tripData: {
                origin: "Dari Foto",
                destination: `${aiDestination} — ${aiLocation}`,
                duration: "3",
                budget: "Fleksibel",
                style: "Vision AI",
            },
        });
    } catch (err) {
        console.error("❌ Gemini vision generation error:", err);
        return res.status(500).json({
            error: "Gagal memproses gambar dengan AI.",
            details: err.message,
        });
    }
});

// ── 7.5  SAVE ITINERARY ────────────────────────
app.post("/api/itineraries", verifyToken, async (req, res) => {
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
                style: tripData.style || "",
            },
            itineraryText,
            likes: 0,
            rating: 0,
        });

        console.log(`✅ Itinerary saved: ${docRef.id} by ${req.user.uid}`);
        return res.status(201).json({ success: true, id: docRef.id });
    } catch (err) {
        console.error("❌ Firestore save error:", err);
        return res.status(500).json({ error: "Gagal menyimpan itinerary.", details: err.message });
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
            createdAt: doc.data().createdAt?.toDate().toISOString() || null,
        }));

        return res.json({ success: true, trips });
    } catch (err) {
        console.error("❌ Firestore fetch (my trips) error:", err);
        return res.status(500).json({ error: "Gagal mengambil itinerary.", details: err.message });
    }
});

// ── 7.7  GET PUBLIC / COMMUNITY ITINERARIES ────
app.get("/api/itineraries/public", async (req, res) => {
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
                rating: data.rating || 0,
            };
        });

        return res.json({ success: true, trips });
    } catch (err) {
        console.error("❌ Firestore fetch (public) error:", err);
        return res.status(500).json({ error: "Gagal mengambil itinerary publik.", details: err.message });
    }
});

// ── 7.8  GET SINGLE ITINERARY BY ID ───────────
app.get("/api/itineraries/:id", async (req, res) => {
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
                createdAt: data.createdAt?.toDate().toISOString() || null,
            },
        });
    } catch (err) {
        console.error("❌ Firestore fetch (single) error:", err);
        return res.status(500).json({ error: "Gagal mengambil itinerary.", details: err.message });
    }
});

// ── 7.9  UPDATE ITINERARY (toggle public, etc.) ─
app.patch("/api/itineraries/:id", verifyToken, async (req, res) => {
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
        return res.status(500).json({ error: "Gagal memperbarui itinerary.", details: err.message });
    }
});

// ── 7.10 DELETE ITINERARY ─────────────────────
app.delete("/api/itineraries/:id", verifyToken, async (req, res) => {
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
        return res.status(500).json({ error: "Gagal menghapus itinerary.", details: err.message });
    }
});

// ── 7.11 LIKE AN ITINERARY ────────────────────
app.post("/api/itineraries/:id/like", verifyToken, async (req, res) => {
    try {
        const ref = db.collection("itineraries").doc(req.params.id);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).json({ error: "Itinerary tidak ditemukan." });
        }

        await ref.update({ likes: FieldValue.increment(1) });
        return res.json({ success: true, message: "Itinerary disukai!" });
    } catch (err) {
        console.error("❌ Firestore like error:", err);
        return res.status(500).json({ error: "Gagal menyukai itinerary.", details: err.message });
    }
});

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
        return res.status(413).json({ error: "File terlalu besar. Maksimum 10 MB." });
    }
    if (err.message && err.message.includes("Only image files")) {
        return res.status(415).json({ error: err.message });
    }
    console.error("❌ Unhandled error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server.", details: err.message });
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

// Load persisted Gemini keys from Firestore (best-effort)
loadKeysFromFirestore().catch(err => console.warn('Failed initial Gemini key load:', err.message));

// ── Admin: Manage Gemini Keys (Firestore-backed) ─────────────────
app.get('/api/gemini-keys', verifyToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only.' });
    try {
        const snapshot = await db.collection('gemini_keys').orderBy('createdAt', 'asc').get();
        const keys = snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                keyMasked: data.key ? ('****' + data.key.slice(-6)) : null,
                disabledUntil: data.disabledUntil || 0,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
            };
        });
        return res.json({ success: true, keys });
    } catch (err) {
        console.error('❌ Fetch gemini keys error:', err.message);
        return res.status(500).json({ error: 'Gagal mengambil kunci.', details: err.message });
    }
});

app.post('/api/gemini-keys', verifyToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only.' });
    const { key } = req.body;
    if (!key || typeof key !== 'string' || key.length < 10) return res.status(400).json({ error: 'Invalid key.' });
    try {
        const id = await persistKeyToFirestore(key);
        return res.status(201).json({ success: true, id });
    } catch (err) {
        console.error('❌ Persist gemini key error:', err.message);
        return res.status(500).json({ error: 'Gagal menyimpan kunci.', details: err.message });
    }
});

app.patch('/api/gemini-keys/:id', verifyToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only.' });
    const { id } = req.params;
    const { disabledUntil } = req.body;
    if (disabledUntil !== undefined && typeof disabledUntil !== 'number') return res.status(400).json({ error: 'disabledUntil must be a number (timestamp ms).' });
    try {
        await updateKeyInFirestore(id, { ...(disabledUntil !== undefined ? { disabledUntil } : {}) });
        return res.json({ success: true });
    } catch (err) {
        console.error('❌ Update gemini key error:', err.message);
        return res.status(500).json({ error: 'Gagal memperbarui kunci.', details: err.message });
    }
});

app.delete('/api/gemini-keys/:id', verifyToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only.' });
    const { id } = req.params;
    try {
        await removeKeyFromFirestore(id);
        return res.json({ success: true });
    } catch (err) {
        console.error('❌ Delete gemini key error:', err.message);
        return res.status(500).json({ error: 'Gagal menghapus kunci.', details: err.message });
    }
});