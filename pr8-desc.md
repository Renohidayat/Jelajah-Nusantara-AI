## Ringkasan
Merombak tampilan UI form input planner dan area upload foto (vision) agar terlihat profesional dan bersih.

Closes #8

## Perubahan
- Memangkas height bagian hero (mengurangi dominasinya) pada semua breakpoint.
- Mengelompokkan input form manual menjadi 3 bagian (.form-section): Rute Perjalanan, Durasi & Anggaran, dan Gaya Wisata.
- Mengganti native dropdown (<select>) untuk Durasi dan Anggaran menjadi Segmented Control dan sistem kartu pilihan.
- Merapikan .upload-area menjadi lebih clean dan round (tanpa outline mencolok yang default).
- Menyesuaikan pembacaan input (durasi dan anggaran) di \main.js\ dari .value menjadi querySelector untuk input radio yang di-check.

## Cara menguji
1. Buka halaman Beranda.
2. Cek form input manual, pilih rute, durasi, anggaran, dan gaya, lalu coba Generate Itinerary.
3. Ubah tab ke Upload Foto dan pastikan tampilannya tidak kotak kaku dan interaksinya bekerja.

## Checklist
- [x] \
pm run build\ lolos
- [x] Semua kriteria selesai pada issue terpenuhi
- [x] Tidak ada perubahan di luar lingkup issue
