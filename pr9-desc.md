## Ringkasan
Merombak tipografi hasil Itinerary (markdown) dan merapikan tampilan Tabel Anggaran, Widget Cuaca, serta Peta Rute agar terlihat semakin rapi dan konsisten dengan keseluruhan UI.

Closes #9

## Perubahan
- Menambahkan styling \.result-body\ yang lebih clean, dengan jarak margin dan font-weight headers yang pas.
- Menerapkan fitur \	abular-nums\ dan \	ext-align: right\ pada kolom angka di dalam \.budget-table\.
- Mengoptimalkan gaya bayangan (shadow) dan tata letak Widget Cuaca dan Panel Peta Rute (\.route-map-container\, \.map-legend\).

## Cara menguji
1. Buka halaman Beranda dan coba fitur Generate Itinerary.
2. Setelah selesai, cek tab Itinerary (teks markdown), Anggaran, dan Peta Rute.
3. Pastikan kolom angka di tabel anggaran sejajar ke kanan.

## Checklist
- [x] \
pm run build\ lolos
- [x] Semua kriteria selesai pada issue terpenuhi
- [x] Tidak ada perubahan di luar lingkup issue
