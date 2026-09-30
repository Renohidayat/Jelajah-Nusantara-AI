## Latar belakang
1. URL gambar dari Pollinations AI mengembalikan status HTTP 402 (Payment Required) karena kuota terlampaui atau API diubah, sehingga gambar kartu perjalanan kosong dan rusak. Selain itu, gambar dari AI generatif sering tidak realistis.
2. Saat tombol "Buat Itinerary" di-*hover*, warnanya menghilang dan menjadi putih (warna teks juga putih) sehingga tidak terlihat. Ini karena variabel CSS `--primary-dark` belum didefinisikan.

## Solusi yang diusulkan
- Hapus penggunaan Pollinations AI. Ganti dengan daftar URL gambar nyata resolusi tinggi dari Unsplash (tema pemandangan/Indonesia). Terapkan algoritma *hashing* pada nama destinasi untuk mengambil satu gambar secara konsisten dari daftar tersebut, sehingga tujuan yang sama akan selalu menampilkan gambar yang sama dan indah tanpa perlu *request* API pihak ketiga.
- Ganti referensi `var(--primary-dark)` pada *hover* `.btn-primary` dengan kode warna *hex* langsung (`#b84a28`).

## Kriteria selesai
- [x] Kartu perjalanan memiliki gambar yang konsisten dan indah
- [x] Tombol "Buat Itinerary" tidak memutih saat di-hover
