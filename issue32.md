## Latar belakang
1. Kotak *toast* hijau "Itinerary berhasil dibuat" nyangkut dan tidak mau hilang. Hal ini karena ada konflik animasi `toast-slide-up` yang mempertahankan `opacity: 1` di berkas `ui.css` terbaru, menimpa fungsionalitas aslinya.
2. AI menggunakan asumsi matematika berdasarkan jumlah orang (keluarga = 4 orang) sehingga melipatgandakan total *budget*, membuat pengguna awam merasa angka akhirnya tidak wajar/menggelembung ("nggak ngotak").
3. Vercel Toolbar (kotak hitam kecil) mengganggu pandangan developer, tapi ini di luar kode aplikasi (Vercel injected).

## Solusi yang diusulkan
- Hapus definisi kelas `.toast` yang berkonflik dari `ui.css` agar aplikasi kembali menggunakan fungsionalitas *toast* bawaan yang ada di `style.css` (yang bisa pudar dengan sendirinya).
- Ubah prompt sistem AI di backend agar menginstruksikan AI menghitung total untuk *keseluruhan grup*, sehingga tidak dikalikan jumlah anggota, memastikan hasil mendekati *Budget Harian x Durasi*.

## Kriteria selesai
- [x] Toast hijau tidak nyangkut selamanya.
- [x] Backend *prompt* membatasi total tanpa mengalikan dengan jumlah partisipan.
