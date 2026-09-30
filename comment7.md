## Penyelesaian
**PR:** #18 · **Branch:** \eat/7-komponen-ui\`n
### Yang dikerjakan
- Menambahkan file ui.css untuk menyediakan komponen UI reusable (Button, Input, Badge, Dialog, Toast, Skeleton, Empty State) dan menyertakannya di \style.css\.
- Mengganti class tombol dan input usang di index.html dan 
avbar.html untuk menggunakan desain komponen baru.
- Menghapus definisi komponen individual seperti .btn-login, .btn-generate, dan .form-group dari style.css.

### Commit
- feat(ui): buat komponen dasar UI seperti button, input, badge, dialog, toast, skeleton, empty state

### Verifikasi
- [x] \
pm run build\ lolos
- [x] Kriteria selesai pada issue terpenuhi (komponen memiliki state dan kontras/AA focus ring lolos)
- [ ] UI diperiksa secara menyeluruh (akan dilakukan pada fase berikutnya)

### Catatan dan tindak lanjut
Implementasi Toast dan Modal Dialog javascript logic kemungkinan memerlukan sedikit penyesuaian kelas di DOM, ini dapat diselesaikan pada issue modal.
