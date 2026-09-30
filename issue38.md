## Latar belakang
1. Saat elemen `card` dan `body` di modal disanitasi menggunakan `DOMPurify.sanitize(...)`, fungsi ini menghapus seluruh atribut event inline (seperti `onclick`), sehingga tombol *Like*, *Toggle Public*, dan *Delete* menjadi mati (tidak bisa diklik).
2. Di `openTripModal`, ada bug referensi variabel yang mana `destIcon` tidak terdefinisi (ReferenceError), menyebabkan modal gagal dirender saat *card* diklik.

## Solusi yang diusulkan
- Hapus *wrapper* `DOMPurify.sanitize` dari string HTML pembungkus utama di `createTripCard` dan `openTripModal`. Bagian konten berbahaya yang berasal dari AI (itinerary) sudah tersanitasi tersendiri menggunakan `DOMPurify` setelah di-*parse* oleh *marked*, sehingga struktur di luar itu aman dari XSS dan tidak perlu disanitasi.
- Definisikan ulang variabel `destIcon` di fungsi `openTripModal` memanggil `getDestIcon(dest)` agar *header* modal dapat dirender dengan baik.

## Kriteria selesai
- [x] Tombol *Like* berfungsi kembali
- [x] Modal berhasil dibuka saat kartu diklik
- [x] Aman dari celah injeksi HTML/XSS karena *body itinerary* tetap disanitasi
