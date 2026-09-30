const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');
html = html.replace(/<title>Jelajah Nusantara.*?<\/title>/, '<title>Jelajah Nusantara — Rencanakan Perjalananmu</title>');
fs.writeFileSync('frontend/index.html', html, 'utf8');
