## Ringkasan
Ekstrak navbar dan footer ke komponen partial yang dibagikan oleh semua halaman untuk menjaga konsistensi. Juga menambahkan dukungan routing hash sederhana (/#planner, dll) agar tombol tab di navbar berfungsi dengan baik antar halaman.

Closes #6

## Perubahan
- Membuat 
avbar.html dan ooter.html di dalam folder src/partials/.
- Mengonfigurasi plugin Vite khusus di ite.config.js untuk merender sintaks <!--#include virtual=... -->.
- Mengganti kode nav dan footer statis di index.html, tentang.html, kontak.html, dan privasi.html dengan partial includes.
- Memperbarui fungsi initUI() di main.js untuk memantau event hashchange dan menangani routing antar tab/page.

## Cara menguji
1. Buka halaman Beranda, klik tab-tab di navbar. Akan mengubah view seperti SPA.
2. Buka halaman Tentang/Kontak, dan klik tab Planner di navbar, pastikan pindah ke halaman Beranda dan membuka tab Planner.

## Checklist
- [x] 
pm run build lolos
- [x] Semua kriteria selesai pada issue terpenuhi
- [x] Tidak ada perubahan di luar lingkup issue
- [x] Tidak ada emoji, warna hex di luar token, atau style inline yang baru
