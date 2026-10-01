# Contributing to Jelajah Nusantara AI

Panduan ini ditujukan bagi siapa saja yang ingin berkontribusi pada pengembangan repositori Jelajah Nusantara AI. Kami mengedepankan kualitas kode, riwayat Git yang rapi, serta konsistensi arsitektur. 

Bacalah dokumen ini dengan saksama sebelum Anda mulai membuat perubahan.

---

## 1. Alur Kerja Git (Git Workflow)

Repositori ini menggunakan model **Pull Request (PR)** dengan riwayat yang linear. Dilarang melakukan *push* langsung ke *branch* `main`.

1. **Sinkronisasi Repo Lokal**
   Pastikan *branch* lokal `main` Anda sejajar dengan *remote* sebelum memulai pekerjaan baru.
   ```bash
   git switch main
   git pull --ff-only
   ```

2. **Pembuatan Branch**
   Buat *branch* baru dari `main` dengan format penamaan `<type>/<nomor-issue>-<deskripsi-singkat>`.
   Contoh: 
   - `feat/12-pencarian-rute`
   - `fix/15-kalkulasi-cuaca`

3. **Komit Perubahan**
   Kami menggunakan standar [Conventional Commits](https://www.conventionalcommits.org/). Setiap pesan komit harus bermakna dan menggambarkan satu unit perubahan yang utuh.
   
   Format:
   ```
   <type>(<scope>): <subject>
   
   <body>
   ```
   
   Tipe komit yang diizinkan: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
   Pastikan proyek tetap bisa di-*build* pada setiap titik komit.

4. **Pull Request (PR)**
   - Buat PR dari *branch* Anda ke `main`.
   - Pastikan deskripsi PR menjelaskan perubahan secara komprehensif dan merujuk ke nomor *issue* terkait (contoh: `Closes #12`).
   - Lakukan pengujian secara lokal sebelum menandai PR siap untuk ditinjau (*ready for review*).

---

## 2. Standar Kode (Code Standards)

### JavaScript (ES6+)
- Gunakan `const` untuk deklarasi variabel tetap, dan `let` hanya jika nilai akan berubah. Hindari penggunaan `var`.
- Manfaatkan *arrow functions*, *template literals*, serta *destructuring* untuk kode yang lebih ringkas.
- Gunakan `async/await` alih-alih *callback* untuk penanganan operasi asinkron.
- Pisahkan logika *business/API* dari logika presentasi (UI).

### CSS & HTML
- Hindari penggunaan *inline styles* dan `!important`.
- Gunakan variabel CSS (`:root`) untuk warna, *spacing*, dan tipografi guna menjaga konsistensi *design system*.
- Terapkan struktur HTML semantik. Pastikan semua elemen interaktif mendukung aksesibilitas (contoh: *focus state* untuk navigasi *keyboard*).

---

## 3. Setup Lingkungan Pengembangan (Local Setup)

Prasyarat sistem:
- Node.js (versi 18 LTS atau lebih baru disarankan)
- Git

Langkah instalasi:

```bash
# 1. Kloning repositori
git clone https://github.com/Renohidayat/Jelajah-Nusantara-AI.git
cd Jelajah-Nusantara-AI

# 2. Instalasi dependensi Backend
cd backend
npm install
npm run dev

# 3. Instalasi dependensi Frontend (di terminal terpisah)
cd ../frontend
npm install
npm run dev
```

---

## 4. Pengujian (Testing)

Sebelum membuat PR, Anda diwajibkan untuk memastikan stabilitas kode:
1. Pastikan perintah `npm run build` berhasil dijalankan tanpa galat.
2. Periksa konsol *browser* (*DevTools*) untuk memastikan tidak ada *error* atau peringatan baru.
3. Untuk perubahan antarmuka pengguna (UI), verifikasi tata letak pada dimensi layar standar: Desktop (1440px), Tablet (768px), dan Mobile (390px).
4. Verifikasi bahwa logika aplikasi tetap berjalan normal untuk kasus umum (*happy path*) maupun saat menangani *error*.

---

## 5. Bantuan dan Laporan Masalah

- Untuk melaporkan *bug* atau mengajukan fitur baru, gunakan tab [Issues](https://github.com/Renohidayat/Jelajah-Nusantara-AI/issues). Sertakan deskripsi terperinci, langkah reproduksi, dan *environment* sistem Anda.
- Pertanyaan teknis atau saran perbaikan tingkat lanjut dapat diajukan ke *email*: hidayatreno085@gmail.com.

Terima kasih atas dedikasi dan profesionalitas Anda dalam berkontribusi pada pengembangan Jelajah Nusantara AI.
