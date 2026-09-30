## Ringkasan
Merombak tata letak daftar kartu perjalanan untuk area My Trips (Perjalananku) dan Komunitas agar memiliki cover gambar asli dan fitur filter pencarian yang berguna.

Closes #10

## Perubahan
- Mengganti elemen banner abu-abu kaku dengan \.trip-card-cover\ berukuran 4:3 yang menampilkan foto pemandangan sesuai dengan kata kunci lokasi (mapping kota).
- Membersihkan tata letak meta chip (menghilangkan emoji yang berlebihan dari iterasi awal).
- Menambahkan input kolom \search\ (pencarian instan berdasar destinasi/snippet tulisan) dan \sort\ (berdasarkan waktu atau likes) yang merender secara dinamis tanpa loading lama.
- Merapikan \.empty-state\ agar tidak memakai font-size icon yang menutupi keseluruhan layar.

## Cara menguji
1. Buka tab Komunitas atau Perjalananku.
2. Cari lokasi yang spesifik (misal: 'Bali' atau 'Bandung') melalui field pencarian.
3. Ubah filter sortir dan pastikan urutan kartu berganti.

## Checklist
- [x] \
pm run build\ lolos
- [x] Semua kriteria selesai pada issue terpenuhi
- [x] Tidak ada perubahan di luar lingkup issue
