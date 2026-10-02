// test_firebase_init.js
// Skrip ini mensimulasikan berbagai kondisi environment (kosong dan format kunci salah)
// untuk memastikan server.js tidak crash (melempar error) saat di-load.

async function runTests() {
    // 1. Uji Env Kosong
    try {
        console.log("=== Menguji Env Kosong ===");
        process.env = {}; // Kosongkan env
        await import('./server.js?t=1');
        console.log("✅ Berhasil memuat server.js tanpa crash.");
    } catch (e) {
        if (e.code !== 'EADDRINUSE') {
            console.error("❌ Gagal: server.js crash pada env kosong!", e);
            process.exit(1);
        }
    }

    // 2. Uji Format Kunci Salah
    try {
        console.log("\\n=== Menguji Format Kunci Salah ===");
        process.env = {
            FIREBASE_PROJECT_ID: "test-id",
            FIREBASE_CLIENT_EMAIL: "test@example.com",
            FIREBASE_PRIVATE_KEY: "kunci-salah-tanpa-begin" // Salah format
        };
        await import('./server.js?t=2');
        console.log("✅ Berhasil memuat server.js tanpa crash meski format kunci salah.");
    } catch (e) {
        if (e.code !== 'EADDRINUSE') {
            console.error("❌ Gagal: server.js crash pada format kunci salah!", e);
            process.exit(1);
        }
    }

    console.log("\\n✅ Semua pengujian selesai. server.js tangguh terhadap error environment.");
    process.exit(0);
}

runTests();
