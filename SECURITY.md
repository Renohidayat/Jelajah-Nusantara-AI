# Kebijakan Keamanan (Security Policy)

## Versi yang Didukung

Pembaruan keamanan (security updates) hanya diberikan untuk versi mayor terbaru dari aplikasi ini.

| Versi | Didukung |
|-------|----------|
| v1.0.x| ✅ Ya    |
| < 1.0 | ❌ Tidak  |

## Pelaporan Kerentanan (Vulnerability Reporting)

Jika Anda menemukan kerentanan keamanan atau masalah privasi di dalam proyek ini, **jangan membuat laporan publik** melalui *GitHub Issues*. Laporan publik dapat dimanfaatkan oleh pihak yang tidak bertanggung jawab sebelum perbaikan dirilis.

Silakan hubungi kami secara langsung melalui:
**Email:** security@jelajah-nusantara-ai.id *(contoh email fiktif, ganti dengan email asli pemelihara)*

Sertakan detail berikut dalam laporan Anda:
- Jenis kerentanan (misalnya: XSS, CSRF, kebocoran kunci, dll).
- Langkah-langkah untuk mereproduksi (PoC).
- Potensi dampak dari kerentanan tersebut.

Kami akan merespons laporan Anda dalam waktu maksimal 3x24 jam kerja.

## Runbook Mitigasi (Incident Runbook)

Berikut adalah panduan tindakan darurat jika terjadi insiden keamanan di *production* Vercel/Firebase:

### 1. Kebocoran Kunci API (API Key Leak)
Jika kunci Firebase Admin atau kunci vendor AI (OpenAgentic/Gemini) bocor ke publik:
- **Langkah 1:** Masuk ke Google Cloud Console / Dasbor Vendor.
- **Langkah 2:** Putar (Rotate) atau cabut kunci yang bocor segera.
- **Langkah 3:** Hasilkan kunci baru.
- **Langkah 4:** Masuk ke Dashboard Vercel > Settings > Environment Variables.
- **Langkah 5:** Perbarui nilai variabel dan lakukan *Redeploy* tanpa *build cache*.
- **Langkah 6:** Tinjau *log* Firebase atau AI untuk memastikan tidak ada eksploitasi ekstrem yang membebani kuota, jika ada, blokir IP atau laporkan ke *support*.

### 2. Bypass Limitasi AI (Abuse / DoS)
Jika batas `express-rate-limit` berhasil di-*bypass* oleh penyerang menggunakan banyak IP (DDoS/Botnet) atau celah batas global:
- **Langkah 1:** Turunkan env `OPENAGENTIC_GLOBAL_LIMIT` ke angka 0 di Vercel sementara waktu untuk mematikan layanan AI *(circuit breaker diaktifkan paksa)*.
- **Langkah 2:** Tinjau *logs* untuk mencari pola penyerangan (misalnya: origin aneh, User-Agent spesifik).
- **Langkah 3:** Aktifkan Vercel Firewall / WAF (opsional) atau ubah algoritma rate limiting menggunakan Redis/Firestore yang lebih ketat berdasarkan akun Google (UID).
- **Langkah 4:** Setelah perbaikan diluncurkan, naikkan kembali limit global.

### 3. Kegagalan Inisialisasi Firebase (Service Outage)
Jika `/api/health` menampilkan `firebaseInitialized: false` padahal env seharusnya ada:
- **Langkah 1:** Cek tipe env di Vercel (Production vs Preview). Pastikan env kunci Firebase (terutama `FIREBASE_PRIVATE_KEY` berbentuk multiline/base64) tidak rusak karakter `\n` saat disimpan.
- **Langkah 2:** Periksa status layanan Google Cloud Platform (GCP) di dasbor kesehatan mereka.
- **Langkah 3:** Lakukan *redeployment* untuk me-reset instance *serverless*.

## Komponen Keamanan
Aplikasi ini dilindungi oleh beberapa lapisan:
- **CORS Allowlist Ekplisit:** Endpoint `/api/*` menolak domain tak terdaftar.
- **Vercel Edge CSP & Permissions-Policy:** Mencegah XSS (via unpkg tak sah) dan mengekang fitur peramban.
- **Firestore Deny-All Rules:** Melindungi injeksi *client-side* DB secara mutlak.
- **DOMPurify & Express Validator:** Memotong payload Markdown jahat sebelum disimpan atau dirender di klien.
