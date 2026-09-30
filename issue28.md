## Latar belakang
Ditemukan error `Uncaught ReferenceError: getDestImage is not defined` pada halaman Perjalananku/Komunitas. Selain itu, ikon `lock` pada *empty state* login masih tampil sebagai teks mentah karena *font-family* belum ter-*enforce*.

## Solusi yang diusulkan
- Definisikan fungsi `getDestImage(dest)` di `main.js`.
- Tambahkan `font-family: 'Material Symbols Outlined' !important;` ke class `.material-symbols-outlined` di `style.css`.

## Lingkup
- `main.js` dan `style.css`

## Kriteria selesai
- [x] Fungsi `getDestImage` ada dan tidak menyebabkan error JS
- [x] Ikon tidak muncul sebagai teks mentah
