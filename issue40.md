## Latar belakang
1. Saat tombol *Like* pada kartu perjalananku ditekan, ikon "hati" menghilang dan terganti dengan angka "1".
2. Hal ini dikarenakan struktur HTML pada angka *like* tidak dibungkus oleh elemen `<span>` sehingga fungsi JavaScript yang mencoba mencari rentang angka dengan `span:last-child` secara keliru malah menemukan dan menimpa *span* ikon tersebut.

## Solusi yang diusulkan
- Bungkus variabel angka `${likes}` di dalam elemen `<span>${likes}</span>` pada `createTripCard` sehingga elemen tersebut dapat disasar secara tepat dan tidak mengganggu elemen ikon hati di atasnya.

## Kriteria selesai
- [x] Ikon hati tidak hilang saat di-klik
- [x] Angka like tetap terbarui secara fungsional
