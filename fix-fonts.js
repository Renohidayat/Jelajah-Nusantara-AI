const fs = require('fs');
const files = ['frontend/index.html', 'frontend/tentang.html', 'frontend/kontak.html', 'frontend/privasi.html'];

files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    if (!c.includes('Material+Symbols')) {
        c = c.replace('<!-- Fonts: Plus Jakarta Sans -->', '<!-- Fonts: Plus Jakarta Sans & Material Symbols -->');
        c = c.replace(
            '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" \r\nrel="stylesheet" />',
            '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />\n    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />'
        );
        // Also try standard replace without newline in middle
        c = c.replace(
            '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />',
            '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />\n    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />'
        );
        fs.writeFileSync(f, c);
    }
});
