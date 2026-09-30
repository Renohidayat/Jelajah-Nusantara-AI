## Ringkasan
Membuat komponen dasar UI seperti button, input, badge, dialog, toast, skeleton, dan empty state.

Closes #7

## Perubahan
- Membuat ui.css berisi kelas dasar (.btn, .input, .badge, dll.)
- Mengimpor ui.css di style.css`n- Menghapus styling form-group dan .btn-* kustom lama dari style.css
- Menerapkan kelas dasar tersebut di index.html dan navbar.html.

## Cara menguji
1. Buka halaman Beranda.
2. Cek semua tombol (Masuk, Mulai Rencanakan, Generate).
3. Cek form input.
4. Pastikan memiliki state hover/active dan focus ring (outline).

## Checklist
- [x] 
pm run build lolos
- [x] Semua kriteria selesai pada issue terpenuhi
- [x] Tidak ada perubahan di luar lingkup issue
- [x] Lolos WCAG AA (kontras, focus ring)
