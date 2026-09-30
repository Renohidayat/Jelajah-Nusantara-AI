const fs = require('fs');

function updateFile(file, replacements) {
    let content = fs.readFileSync(file, 'utf8');
    for (const [oldRegex, newStr] of replacements) {
        content = content.replace(oldRegex, newStr);
    }
    fs.writeFileSync(file, content);
}

// 1. index.html
updateFile('frontend/index.html', [
    [/<title>.*?<\/title>/g, '<title>Jelajah Nusantara — Rencanakan Perjalananmu</title>'],
    [/<meta name="description" content="Rencanakan perjalanan impianmu di Indonesia dengan kecerdasan buatan." \/>/g, '<meta name="description" content="Rencanakan perjalanan impianmu di Indonesia dengan mudah." />'],
    [/<p class="hero-subtitle">AI membantu menyusun itinerary personal di seluruh Nusantara.<\/p>/g, '<p class="hero-subtitle">Susun itinerary personal ke seluruh Nusantara hanya dalam hitungan detik.</p>'],
    [/Buat Itinerary AI/g, 'Buat Itinerary'],
    [/<p>Unggah foto tempat wisata.*?membuat rencana perjalanan\.<\/p>/g, '<p>Unggah foto tempat wisata dan biarkan kami mengenali lokasinya untukmu.</p>'],
    [/<span class="weather-ai-badge">.*?Rekomendasi Cuaca AI<\/span>/g, '<span class="weather-ai-badge"><span class="material-symbols-outlined">auto_awesome</span> Saran Pakaian & Cuaca</span>'],
    [/<p class="map-loading-text">AI sedang mengekstrak lokasi dari itinerary.*?<\/p>/g, '<p class="map-loading-text">Sedang menyiapkan peta perjalananmu...</p>']
]);

console.log('index.html Copywriting updated');
