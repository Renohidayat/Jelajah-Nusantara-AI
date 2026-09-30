## Penyelesaian
**PR:** #27 · **Branch:** `fix/26-ui-bugs`

### Yang dikerjakan
- Mengembalikan *font link* Material Symbols Outlined ke semua file HTML agar ikon kembali tampil (sebelumnya terhapus secara tidak sengaja).
- Menambahkan deklarasi variabel `myTripsCache` dan `communityTripsCache` di file `main.js` untuk mencegah error 'is not defined' saat memuat halaman.
- Memperbaiki karakter (encoding) teks pada kartu budget yang rusak (dari `Rp 13` menjadi `1-3`).

### Verifikasi
- [x] Ikon tampil normal
- [x] Error JS hilang
- [x] Teks budget menjadi `1-3`
