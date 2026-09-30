## Latar belakang
Ikon rusak menjadi teks karena font material terhapus. Ada variabel JS tidak terdeklarasi (`communityTripsCache`) dan masalah encoding pada rentang budget (`Rp 13 juta`).

## Solusi yang diusulkan
- Kembalikan link CDN Google Material Icons ke HTML.
- Deklarasikan variabel cache di `main.js`.
- Ganti karakter aneh dengan tanda hubung (`-`) pada budget.

## Lingkup
- HTML files dan `main.js`.

## Kriteria selesai
- [x] Ikon tampil normal
- [x] Error JS hilang
- [x] Teks budget menjadi `1-3`
