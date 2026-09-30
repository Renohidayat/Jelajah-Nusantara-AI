const fs = require('fs');
let js = fs.readFileSync('frontend/src/main.js', 'utf8');

js = js.replace('let currentItinerary = null', 'let currentItinerary = null;\nlet myTripsCache = [];\nlet communityTripsCache = [];');

js = js.replace(/if \(!data\.trips \|\| data\.trips\.length === 0\) \{\s*empty\.classList\.remove\('hidden'\)\s*return\s*\}/g, 
`if (!data.trips || data.trips.length === 0) {
            empty.classList.remove('hidden');
            let ctl = document.getElementById(empty.id.replace('empty', 'controls'));
            if(ctl) ctl.style.display = 'none';
            return;
        }
        if(empty.id.includes('mytrips')) {
            myTripsCache = data.trips;
            document.getElementById('mytrips-controls').style.display = 'flex';
        } else {
            communityTripsCache = data.trips;
            document.getElementById('community-controls').style.display = 'flex';
        }`);

const filters = `
window.filterMyTrips = function() {
    const term = document.getElementById('mytrips-search').value.toLowerCase();
    const sort = document.getElementById('mytrips-sort').value;
    let filtered = myTripsCache.filter(t => {
        const dest = (t.tripData?.destination || '').toLowerCase();
        const prev = (t.itineraryPreview || t.itineraryText || '').toLowerCase();
        return dest.includes(term) || prev.includes(term);
    });
    if (sort === 'oldest') {
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    const grid = document.getElementById('mytrips-grid');
    grid.innerHTML = '';
    filtered.forEach((trip, i) => {
        grid.appendChild(createTripCard(trip, { showActions: true, delay: i * 0.05 }));
    });
};

window.filterCommunity = function() {
    const term = document.getElementById('community-search').value.toLowerCase();
    const sort = document.getElementById('community-sort').value;
    let filtered = communityTripsCache.filter(t => {
        const dest = (t.tripData?.destination || '').toLowerCase();
        const prev = (t.itineraryPreview || t.itineraryText || '').toLowerCase();
        return dest.includes(term) || prev.includes(term);
    });
    if (sort === 'popular') {
        filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    const grid = document.getElementById('community-grid');
    grid.innerHTML = '';
    filtered.forEach((trip, i) => {
        grid.appendChild(createTripCard(trip, { showActions: false, delay: i * 0.05 }));
    });
};
`;

js = js + "\n" + filters;
fs.writeFileSync('frontend/src/main.js', js);
console.log('Filter functions added');
