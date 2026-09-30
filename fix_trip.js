
const fs = require("fs");
let file = fs.readFileSync("frontend/src/main.js", "utf8");

file = file.replace(/<div class="trip-card-banner">[\s\S]*?<div class="trip-card-dest">\$\{dest\}<\/div>\s*<\/div>/,
`<div class="trip-card-cover">
      <img src="\${destImage}" alt="\${dest}" loading="lazy" />
      <div class="trip-card-cover-overlay"></div>
      <div class="trip-card-dest">\${dest}</div>
    </div>`);

fs.writeFileSync("frontend/src/main.js", file);
console.log("Replaced successfully");

