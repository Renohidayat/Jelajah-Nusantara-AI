## Penyelesaian
**PR:** #19 · **Branch:** \style/8-planner-redesign\`n
### Yang dikerjakan
- Menambahkan sectioning (.form-section) dan memisahkan form input manual dalam tiga langkah (Rute Perjalanan, Durasi & Anggaran, dan Gaya Wisata).
- Mengubah native dropdown element untuk Durasi dan Anggaran menjadi Segmented Grid (\.segmented-grid\) dan Radio Cards (\.budget-grid\).
- Merapikan .upload-area pada form Vision dengan rounded edges yang lebih luwes dan efek shadow halus pada icon hover.
- Memangkas ukuran pahlawan (hero image tinggi) agar panel planner terlihat lebih terpusat dan rapi di semua ukuran layer.
- Menyesuaikan \main.js\ untuk menangkap \alue\ dari input type radio yang baru.

### Commit
- style(planner): redesign fitur Generate Input Manual dan Upload Foto

### Verifikasi
- [x] \
pm run build\ lolos
- [x] Kriteria selesai pada issue terpenuhi (Form dikelompokkan, dropzone bersih, load interaktif bawaan dipertahankan)
- [x] Tested parsing di JS works as expected.

### Catatan dan tindak lanjut
Semua sudah terselesaikan tanpa merusak fungsi yang sudah ada.
