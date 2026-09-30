## Penyelesaian
**PR:** #21 · **Branch:** \style/10-trips-redesign\`n
### Yang dikerjakan
- Mengganti banner abu-abu bawaan pada Kartu Trip dengan desain \Cover\ dinamis (rasio 4:3) yang mengambil foto relevan berdasarkan nama destinasi.
- Menambahkan kontrol Filter dan Pencarian (\Search\ text & \Sort\ select) pada grid Perjalananku dan Komunitas.
- Mengimplementasikan logika JavaScript untuk penyaringan \rray.filter()\ di client-side (agar cepat tanpa perlu request ulang).
- Membersihkan ikon besar yang menyita ruang pada tampilan \empty-state\ bila pengguna belum memiliki itinerary tersimpan.

### Commit
- style(trips): redesign tata letak kartu Perjalananku dan Komunitas

### Verifikasi
- [x] \
pm run build\ lolos
- [x] Kriteria selesai pada issue terpenuhi (Desain kartu baru dengan cover gambar statis, filter dan sortir instan berfungsi, empty-state terlihat lebih bersih)

### Catatan dan tindak lanjut
Penambahan fitur pencarian statis ini membuat akses trip lama menjadi jauh lebih efisien untuk pengguna.
