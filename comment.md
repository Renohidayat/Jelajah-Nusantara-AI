## Penyelesaian
**PR:** #15 · **Branch:** \efactor/6-navbar-bersama\`n
### Yang dikerjakan
- Mengekstrak navbar dan footer ke komponen partial yang dapat di-include oleh Vite (via html-partials plugin).
- Menerapkan partial include ke index.html, tentang.html, kontak.html, dan privasi.html.
- Mengimplementasikan routing SPA sederhana menggunakan hashchange pada main.js.

### Commit
- feat(nav): ekstrak navbar dan footer ke partial bersama
- refactor(static-pages): terapkan partial pada tentang, kontak, dan privasi
- feat(nav): tambahkan routing hash pada main.js

### Verifikasi
- [x] \
pm run build\ lolos
- [x] Kriteria selesai pada issue terpenuhi
- [ ] UI sudah dicek secara manual

### Catatan dan tindak lanjut
Refactor style dari halaman statis (CSS inline ke style.css) akan dikerjakan pada issue terpisah agar tetap 1 branch 1 tujuan (misal Issue #13/14 baru).
