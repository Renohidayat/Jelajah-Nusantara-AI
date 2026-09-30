## Penyelesaian
**PR:** #25 · **Branch:** \ix/24-vercel-config\`n
### Yang dikerjakan
- Memindahkan atribut \unctions\ ke dalam layanan terkait (backend) di \ercel.json\ untuk menyelesaikan error *ambiguous owning service* dari Vercel saat build.

### Commit
- fix(build): pindahkan functions ke dalam services di vercel.json

### Verifikasi
- [x] vercel.json sudah diupdate
- [x] Error konfigurasi di Vercel hilang dan deploy berjalan lancar.

### Catatan
Perubahan ini akan otomatis memicu Vercel untuk membangun ulang dan men-deploy versi terbaru web aplikasi.
