## Penyelesaian
**PR:** #22 · **Branch:** \eat/11-modal-sidesheet\`n
### Yang dikerjakan
- Merombak komponen pop-up modal biasa menjadi tipe Side Sheet (geser dari kanan untuk Desktop) dan Bottom Sheet (geser dari bawah untuk Mobile).
- Menggunakan cubic-bezier animasi mulus 250ms saat muncul dan tertutup.
- Mengimplementasikan fitur Trap Focus (\	abindex\) ke dalam area modal dan penguncian scroll layar belakang via \ody.modal-open\ saat terbuka.
- Menambahkan listener \window\ untuk membaca tombol \Escape\ agar modal dapat langsung tertutup secara intuitif bagi pengguna keyboard.

### Commit
- feat(modal): rombak dialog detail menjadi side sheet / bottom sheet

### Verifikasi
- [x] \
pm run build\ lolos
- [x] Kriteria selesai pada issue terpenuhi (Side sheet desktop, bottom sheet mobile, scroll terkunci, bisa ditutup pakai Esc)

### Catatan dan tindak lanjut
Penyesuaian animasi ini sangat meningkatkan fungsionalitas UI secara signifikan.
