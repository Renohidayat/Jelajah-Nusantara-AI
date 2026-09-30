const fs = require('fs');

let content = fs.readFileSync('frontend/tentang.html', 'utf8');

const replacements = [
    [/<p class="hero-subtitle">Platform perencana perjalanan pintar berbasis AI yang mendukung wisatawan\s*Indonesia merancang petualangan lokal secara mudah dan personal\.<\/p>/g, '<p class="hero-subtitle">Aplikasi perencana perjalanan yang membantumu merancang itinerary keliling Indonesia dengan lebih cepat dan personal.</p>'],
    [/<p>Jelajah Nusantara hadir untuk membantu pengguna menemukan destinasi terbaik di Indonesia dengan\s*dukungan kecerdasan buatan\. Kami merancang pengalaman perjalanan yang dipersonalisasi, hemat\s*waktu, dan mudah diakses\.<\/p>/g, '<p>Kami ingin membantumu merencanakan liburan tanpa pusing. Jelajah Nusantara menyusun itinerary yang disesuaikan dengan preferensi dan anggaranmu, sehingga kamu bisa lebih fokus menikmati perjalanan.</p>'],
    [/<p>Kami berkomitmen untuk menjadikan perjalanan Nusantara lebih mudah direncanakan dan lebih\s*menginspirasi, mulai dari solo trip, liburan keluarga, hingga petualangan budaya untuk membuka\s*kesempatan berkeliling Indonesia dengan cara yang lebih cerdas\.<\/p>/g, '<p>Kami percaya setiap sudut Indonesia punya cerita. Misi kami adalah membuat penjelajahan Nusantara lebih mudah diakses oleh siapa saja—mulai dari solo trip santai hingga liburan keluarga yang seru.</p>'],
    [/<p class="developer-bio">Pengembang utama dan penanggung jawab produk\. Fokus pada desain antarmuka,\s*pengalaman pengguna, dan integrasi AI untuk menciptakan solusi perjalanan Nusantara yang\s*bermakna\.<\/p>/g, '<p class="developer-bio">Pengembang dan desainer di balik Jelajah Nusantara. Berangkat dari rasa frustrasi saat menyusun itinerary manual, Reno membangun platform ini agar merencanakan liburan terasa sama menyenangkannya dengan liburan itu sendiri.</p>']
];

for (const [oldRegex, newStr] of replacements) {
    content = content.replace(oldRegex, newStr);
}

fs.writeFileSync('frontend/tentang.html', content);
console.log('tentang.html updated');
