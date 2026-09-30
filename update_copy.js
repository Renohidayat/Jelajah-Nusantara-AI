const fs = require('fs');

function updateFile(file, replacements) {
    let content = fs.readFileSync(file, 'utf8');
    for (const [oldStr, newStr] of replacements) {
        content = content.replace(oldStr, newStr);
    }
    fs.writeFileSync(file, content);
}

// 1. index.html
updateFile('frontend/index.html', [
    ['Jelajah Nusantara - AI Travel Planner', 'Jelajah Nusantara — Rencanakan Perjalananmu'],
    ['Rencanakan perjalanan impianmu di Indonesia dengan kecerdasan buatan.', 'Rencanakan perjalanan impianmu di Indonesia dengan mudah.'],
    ['AI membantu menyusun itinerary personal di seluruh Nusantara.', 'Susun itinerary personal ke seluruh Nusantara hanya dalam hitungan detik.'],
    ['Buat Itinerary AI', 'Buat Itinerary'],
    ['Unggah foto tempat wisata - AI akan mengenali lokasinya dan membuat rencana perjalanan.', 'Unggah foto tempat wisata dan biarkan sistem mengenali lokasinya untukmu.'],
    ['Rekomendasi Cuaca AI', 'Saran Pakaian & Cuaca'],
    ['AI sedang mengekstrak lokasi dari itinerary...', 'Sedang menyiapkan peta perjalananmu...']
]);

// 2. tentang.html
updateFile('frontend/tentang.html', [
    ['Platform perencana perjalanan pintar berbasis AI yang mendukung wisatawan\n                    Indonesia merancang petualangan lokal secara mudah dan personal.', 'Aplikasi perencana perjalanan yang membantumu merancang itinerary keliling Indonesia dengan lebih cepat dan personal.'],
    ['Jelajah Nusantara hadir untuk membantu pengguna menemukan destinasi terbaik di Indonesia dengan\n                        dukungan kecerdasan buatan. Kami merancang pengalaman perjalanan yang dipersonalisasi, hemat\n                        waktu, dan mudah diakses.', 'Kami ingin membantumu merencanakan liburan tanpa pusing. Jelajah Nusantara menyusun itinerary yang disesuaikan dengan preferensi dan anggaranmu, sehingga kamu bisa lebih fokus menikmati perjalanan.'],
    ['Kami berkomitmen untuk menjadikan perjalanan Nusantara lebih mudah direncanakan dan lebih\n                        menginspirasi, mulai dari solo trip, liburan keluarga, hingga petualangan budaya untuk membuka\n                        kesempatan berkeliling Indonesia dengan cara yang lebih cerdas.', 'Kami percaya setiap sudut Indonesia punya cerita. Misi kami adalah membuat penjelajahan Nusantara lebih mudah diakses oleh siapa saja—mulai dari solo trip santai hingga liburan keluarga yang seru.'],
    ['Pengembang utama dan penanggung jawab produk. Fokus pada desain antarmuka,\n                        pengalaman pengguna, dan integrasi AI untuk menciptakan solusi perjalanan Nusantara yang\n                        bermakna.', 'Pengembang dan desainer di balik Jelajah Nusantara. Berangkat dari rasa frustrasi saat menyusun itinerary manual, Reno membangun platform ini agar merencanakan liburan terasa sama menyenangkannya dengan liburan itu sendiri.']
]);

// 3. kontak.html
updateFile('frontend/kontak.html', [
    ['Hubungi tim Jelajah Nusantara untuk dukungan, masukan, atau kerja sama pengembangan wisata digital.', 'Punya pertanyaan, masukan, atau ajakan kerja sama? Jangan ragu untuk menghubungi kami.'],
    ['Untuk bantuan atau pertanyaan mengenai fitur, silakan gunakan informasi kontak di bawah ini. Kami akan merespons secepatnya.', 'Kami selalu senang mendengar dari pengguna. Pilih jalur komunikasi yang paling nyaman buatmu.'],
    ['Jika Anda menemukan bug, fitur yang tidak berfungsi, atau ingin mengirim masukan produk, gunakan email di atas dan sertakan informasi berikut:', 'Jika kamu menemukan bug atau fitur yang bermasalah, tolong kirimkan email dengan menyertakan:'],
    ['Sistem Manajemen internal', 'Jam Operasional'],
    ['Walaupun pengembangan inti dikelola oleh satu orang, M Reno Hidayat, kami selalu berkomitmen tinggi dalam menjaga ekosistem layanan agar tetap lancar, aman, dan selalu responsif untuk seluruh pengguna.', 'Jelajah Nusantara saat ini dikembangkan secara independen oleh Reno. Pesanmu pasti dibaca, tapi mohon dimaklumi jika balasan butuh waktu sedikit lebih lama di akhir pekan.']
]);

// 4. privasi.html
updateFile('frontend/privasi.html', [
    ['Ketentuan dan kebijakan privasi di Jelajah Nusantara untuk keamanan data pengguna.', 'Kami menghargai privasimu. Berikut ini cara kami mengelola dan melindungi datamu saat menggunakan Jelajah Nusantara.'],
    ['Kami mengumpulkan data yang diperlukan untuk memberikan pengalaman perjalanan yang lebih relevan, termasuk preferensi tujuan, durasi, dan gaya wisata. Data hanya digunakan untuk meningkatkan fungsionalitas aplikasi dan tidak dibagikan tanpa persetujuan.', 'Kami hanya menyimpan data yang benar-benar dibutuhkan, seperti riwayat pencarian destinasi dan preferensi perjalanan, agar itinerary yang dibuat semakin pas buatmu. Datamu aman dan tidak akan kami jual ke pihak ketiga.'],
    ['Informasi Anda digunakan secara spesifik untuk memproses pemodelan kecerdasan buatan demi kenyamanan Anda, diantaranya untuk:', 'Data yang kami simpan akan kami gunakan untuk:'],
    ['Dengan menggunakan Jelajah Nusantara, Anda setuju bahwa platform ini disediakan untuk membantu perencanaan perjalanan dan bukan sebagai jaminan perjalanan lengkap. Kami tidak bertanggung jawab atas perubahan rencana, pembatalan, atau biaya pihak ketiga yang berlaku pada layanan eksternal.', 'Itinerary yang dibuat oleh Jelajah Nusantara ditujukan sebagai panduan awal, bukan jadwal pasti. Harap selalu cek ulang harga, cuaca, dan ketersediaan tiket pada sumber resmi sebelum berangkat.'],
    ['Anda juga setuju untuk menggunakan platform ini secara bertanggung jawab dan tidak menyalahgunakan sistem untuk tujuan yang melanggar hukum atau merugikan pihak lain.', 'Gunakanlah platform ini sewajarnya dan bantu kami menjaga komunitas agar tetap asyik untuk saling berbagi pengalaman liburan.']
]);

console.log('Copywriting updated');
