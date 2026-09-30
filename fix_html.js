
const fs = require("fs");
let html = fs.readFileSync("frontend/index.html", "utf8");

const myTripsControls = `
                <div class="trips-controls" id="mytrips-controls" style="display:none;">
                    <div class="search-box">
                        <span class="material-symbols-outlined">search</span>
                        <input type="text" id="mytrips-search" class="input" placeholder="Cari destinasi atau catatan..." oninput="filterMyTrips()" />
                    </div>
                    <div class="sort-box">
                        <select id="mytrips-sort" class="input" onchange="filterMyTrips()">
                            <option value="newest">Terbaru</option>
                            <option value="oldest">Terlama</option>
                        </select>
                    </div>
                </div>
`;

const commControls = `
                <div class="trips-controls" id="community-controls" style="display:none;">
                    <div class="search-box">
                        <span class="material-symbols-outlined">search</span>
                        <input type="text" id="community-search" class="input" placeholder="Cari destinasi atau cerita..." oninput="filterCommunity()" />
                    </div>
                    <div class="sort-box">
                        <select id="community-sort" class="input" onchange="filterCommunity()">
                            <option value="newest">Terbaru</option>
                            <option value="popular">Terpopuler</option>
                        </select>
                    </div>
                </div>
`;

html = html.replace(/<div class="trips-grid" id="mytrips-grid"><\/div>/, myTripsControls + `\n                <div class="trips-grid" id="mytrips-grid"></div>`);
html = html.replace(/<div class="trips-grid" id="community-grid"><\/div>/, commControls + `\n                <div class="trips-grid" id="community-grid"></div>`);

fs.writeFileSync("frontend/index.html", html);
console.log("Controls injected");

