## Latar belakang
1. Fallback Unsplash menggunakan gambar acak yang terkadang tidak relevan dengan lokasi sebenarnya, yang membuat pengalaman pengguna kurang optimal.
2. Pengguna menyarankan penggunaan Wikipedia untuk mendapatkan gambar yang persis dengan nama lokasi dengan mudah dan tanpa AI.

## Solusi yang diusulkan
- Tetap gunakan placeholder Unsplash dengan algoritma hash secara *synchronous* saat membangun string HTML, agar tata letak (layout) kartu perjalanan tidak hancur atau terlihat kosong.
- Berikan atribut `data-wiki-dest` pada setiap elemen gambar (`<img>`).
- Buat dan panggil fungsi asinkron (`fetchWikiImages()`) tepat setelah kartu-kartu dimuat di DOM, yang akan secara otomatis mengambil foto Wikipedia sesungguhnya menggunakan *Wikipedia Action API* dan menimpa *placeholder* yang ada.

## Kriteria selesai
- [x] Kartu memuat foto Unsplash instan, lalu menukar perlahan ke gambar asli dari Wikipedia
- [x] Pencarian dilakukan pada kata kunci pertama dari destinasi agar lebih relevan
