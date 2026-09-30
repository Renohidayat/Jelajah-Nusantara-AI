## Ringkasan
Mengekstraksi CSS inline dari halaman statis ke style.css.

Closes #16

## Perubahan
- Memindahkan styling dari tentang.html, kontak.html, privasi.html ke style.css
- Menghapus tag style dari dokumen HTML terkait

## Cara menguji
1. Buka halaman tentang, kontak, dan privasi.
2. Pastikan tampilannya tetap sama dan tidak hancur.

## Checklist
- [x] 
pm run build lolos
- [x] Semua kriteria selesai pada issue terpenuhi
- [x] Tidak ada perubahan di luar lingkup issue
- [x] Tidak ada emoji, warna hex di luar token, atau style inline yang baru
