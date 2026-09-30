## Latar belakang
1. Pengguna bosan dengan placeholder destinasi di Komunitas/Perjalananku yang statis dan sama semua (hanya Bali/Lombok).
2. Teks putih di Hero Banner dan Trip Card sering tidak terlihat karena background fallback sebelumnya berwarna putih/abu terang jika gambar gagal dimuat.
3. AI memberikan anggaran yang sangat berlebih atau tidak masuk akal jika dibandingkan dengan pilihan "Estimasi Anggaran" dari pengguna.

## Solusi yang diusulkan
- Ubah `getDestImage` menggunakan Pollinations AI (API bebas kunci) yang menerima parameter nama destinasi untuk menghasilkan gambar yang relevan secara on-the-fly.
- Ubah `background` dari `.hero` dan `.trip-card-cover` menjadi `var(--ink)` (hitam/gelap) agar teks putih selalu memiliki kontras yang baik.
- Modifikasi *System Prompt* di backend untuk menambahkan ATURAN PENTING agar total dari komponen anggaran wajib dijumlahkan dan disesuaikan mendekati Budget Harian x Durasi.

## Kriteria selesai
- [x] Fungsi `getDestImage` menghasilkan URL Pollinations yang unik per tujuan
- [x] Fallback CSS untuk penampung hero dan trip card berwarna gelap
- [x] Backend Prompt lebih ketat terhadap limit budget
