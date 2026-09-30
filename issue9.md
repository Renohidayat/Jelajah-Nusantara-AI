## Latar belakang
Halaman statis (Tentang, Kontak, Privasi) masing-masing memiliki ratusan baris CSS inline yang menduplikasi gaya. Hal ini menyulitkan pemeliharaan dan menyebabkan konflik gaya, contohnya definisi class .hero yang bentrok.

## Solusi yang diusulkan
Pindahkan semua CSS inline dari 	entang.html, kontak.html, dan privasi.html ke dalam style.css. Hapus deklarasi duplikat seperti .hero.

## Lingkup
- Termasuk: Memindahkan blok <style> di ketiga halaman statis ke style.css.
- Tidak termasuk: Mengubah gaya komponen lain di luar halaman statis.

## Kriteria selesai
- [ ] Semua CSS inline di 	entang.html, kontak.html, dan privasi.html telah dihapus.
- [ ] CSS yang dipindahkan ke style.css tidak merusak halaman lain.
- [ ] 
pm run build lolos
