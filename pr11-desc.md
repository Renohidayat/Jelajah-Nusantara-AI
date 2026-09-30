## Ringkasan
Mengganti sistem modal kotak popup tradisional menjadi Side Sheet (panel kanan) pada layar desktop dan Bottom Sheet (panel bawah) pada layar mobile, memberikan interaksi yang lebih modern.

Closes #11

## Perubahan
- Modifikasi CSS \.modal-box\ dan \.modal-overlay\ sehingga kotak popup sekarang muncul dari sisi samping (desktop) atau melayang ke atas dari bawah (mobile) dengan animasi transisi 250ms (cubic-bezier).
- Menambahkan logika Scroll Lock (menambah kelas \.modal-open\ ke \<body>\) agar latar belakang halaman tidak ter-scroll saat sheet terbuka.
- Menambahkan fungsionalitas Focus Trap dan pendeteksian tombol Esc (Escape) untuk menutup sheet.

## Cara menguji
1. Buka halaman Perjalananku atau Komunitas.
2. Klik salah satu kartu perjalanan.
3. Sheet akan terbuka (dari samping kanan untuk layar lebar, atau bawah untuk layar kecil).
4. Coba scroll (background tidak boleh bergerak).
5. Tekan tombol \Esc\ di keyboard untuk menutup sheet.

## Checklist
- [x] \
pm run build\ lolos
- [x] Semua kriteria selesai pada issue terpenuhi
- [x] Tidak ada perubahan di luar lingkup issue
