// ════════════════════════════════════════════════════════════════
//  Jelajah Nusantara — Frontend Application
//  Stack  : Vanilla ES6 + Firebase SDK v10 (modular) + marked.js
//  Pattern: Config-first init → Auth → UI → API calls
// ════════════════════════════════════════════════════════════════

import { createIcons, Map as LucideMap, Menu, LogOut } from 'lucide'

let myTripsCache = [];
let communityTripsCache = [];

// Helper untuk menampilkan gambar destinasi (Fallback ke Unsplash IDs terpilih)
window.getDestImage = function(dest) {
    if (!dest) return 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&q=80&w=800';
    
    // Daftar foto-foto alam/landmark Indonesia terbaik di Unsplash
    const ids = [
        '1537996194471-e657df975ab4', // Bali temple
        '1576426863848-c21f53c60b19', // Rinjani / Lombok
        '1584814526543-157ad30cb855', // Borobudur / Jogja
        '1518548419970-58e3b4079ab2', // Bromo
        '1555899434-94d1368aa7af', // Jakarta landscape
        '1604928141064-207cea6f560f', // Raja Ampat style
        '1592398565158-b3d9d306b9b3', // Waterfall
        '1505993597083-3b43ea98d2dc'  // Komodo island
    ];
    
    // Simple hash function for consistent image per destination
    let hash = 0;
    for (let i = 0; i < dest.length; i++) {
        hash = dest.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % ids.length;
    
    return `https://images.unsplash.com/photo-${ids[idx]}?auto=format&fit=crop&q=80&w=800`;
}

// Fetch images from Wikipedia for elements with data-wiki-dest
window.fetchWikiImages = async function() {
    const imgs = document.querySelectorAll('img[data-wiki-dest]');
    for (const img of imgs) {
        if (img.dataset.wikiLoading) continue;
        img.dataset.wikiLoading = 'true';
        const dest = img.getAttribute('data-wiki-dest');
        try {
            // Get first keyword of destination for broader search
            const query = dest.split(',')[0].trim();
            const url = `https://id.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&format=json&pithumbsize=800&origin=*`;
            const res = await fetch(url);
            const data = await res.json();
            if (data && data.query && data.query.pages) {
                const pageId = Object.keys(data.query.pages)[0];
                if (data.query.pages[pageId].thumbnail) {
                    img.src = data.query.pages[pageId].thumbnail.source;
                }
            }
        } catch(e) {}
    }
}

import { initializeApp } from 'firebase/app'
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    browserLocalPersistence,
    setPersistence,
} from 'firebase/auth'

// ──────────────────────────────────────────────────────────────
//  CONFIG & GLOBALS
// ──────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || '' // Vite proxies /api → localhost:8080

let firebaseApp = null
let auth = null
let currentUser = null
let lastResult = null   // { itineraryText, tripData }

// ── MAP STATE ──────────────────────────────────
let leafletMap = null          // Leaflet map instance
let mapDays = null             // Extracted location data
let mapExtractAborted = false  // Flag to cancel stale requests
let discoveryLayerGroup = null // Nearby search markers

// ── BUDGET STATE ───────────────────────────────
let budgetData = null          // AI budget breakdown data
let budgetChartInstance = null // Chart.js instance to avoid memory leaks / redraw bugs

// ── LEAFLET LOADER ─────────────────────────────
// Garantikan window.L tersedia sebelum render peta, tanpa peduli kecepatan CDN
let _leafletLoadPromise = null
async function loadLeaflet() {
    if (_leafletLoadPromise) return _leafletLoadPromise;
    _leafletLoadPromise = (async () => {
        if (window.L) return window.L;
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');
        
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: (await import('leaflet/dist/images/marker-icon-2x.png')).default,
            iconUrl: (await import('leaflet/dist/images/marker-icon.png')).default,
            shadowUrl: (await import('leaflet/dist/images/marker-shadow.png')).default,
        });
        
        window.L = L;
        return L;
    })();
    return _leafletLoadPromise;
}

// Markdown renderer config


// ══════════════════════════════════════════════════════════════
//  BOOT: Fetch Firebase config → Init Firebase
// ══════════════════════════════════════════════════════════════
async function boot() {
    try {
        const resp = await fetch(`${API_BASE}/api/config`)
        if (!resp.ok) throw new Error(`Config fetch failed: ${resp.status}`)
        const firebaseConfig = await resp.json()

        firebaseApp = initializeApp(firebaseConfig)
        auth = getAuth(firebaseApp)

        // Set persistence sekali di sini
        await setPersistence(auth, browserLocalPersistence)

        onAuthStateChanged(auth, (user) => {
            currentUser = user
            updateAuthUI(user)
        })

        // Init UI dasar (bisa berjalan di semua halaman)
        initUI()
        
        // Render lucide icons
        if (typeof createIcons !== 'undefined') {
            createIcons({
    icons: {
        Map: LucideMap,
        Menu,
        LogOut
    }
})
        }

        // FIX: Hanya panggil loadCommunity jika elemennya memang ada di halaman ini!
        if (document.getElementById('community-grid')) {
            await loadCommunity()
        }

        // Hide vision feature if disabled
        if (firebaseConfig.visionEnabled === false) {
            const visionTabBtn = document.querySelector('[data-tab="vision"]');
            if (visionTabBtn) {
                visionTabBtn.style.display = 'none';
                if (visionTabBtn.classList.contains('active')) {
                    switchTab('text');
                }
            }
        }

    } catch (err) {
        console.warn('Boot warning (bisa diabaikan jika server sedang cold-start):', err)
        showToast('Gagal terhubung ke server. Coba refresh halaman.', 'error')
    }
}

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════

window.handleLogin = function () {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if(!overlay || !body) return;

    body.innerHTML = `
        <div class="auth-modal">
            <div class="auth-modal-header">
                <span class="material-symbols-outlined auth-modal-icon">explore</span>
                <h2>Masuk ke Jelajah Nusantara</h2>
            </div>
            <p class="auth-modal-desc">Simpan itinerary perjalananmu dan bagikan pengalamanmu dengan komunitas traveler lainnya.</p>
            <button class="btn btn-primary auth-btn-google" onclick="executeLogin()">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" class="auth-google-logo">
                Lanjutkan dengan Google
            </button>
        </div>
    `;
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

window.executeLogin = async function () {
    if (!auth) return showToast('Aplikasi belum siap. Coba refresh.', 'error')
    try {
        const provider = new GoogleAuthProvider()
        provider.addScope('profile')
        provider.addScope('email')
        const result = await signInWithPopup(auth, provider)
        if(typeof closeModal === 'function') closeModal();
        showToast(`Selamat datang, ${result.user.displayName?.split(' ')[0] || 'Traveler'}!`, 'success')
    } catch (err) {
        console.error('Login error:', err)
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
            if (err.code === 'auth/unauthorized-domain') {
                showToast('Domain Vercel belum diizinkan di Firebase Console (Authorized Domains).', 'error')
            } else {
                showToast('Gagal masuk: ' + (err.message || 'Coba lagi.'), 'error')
            }
        }
    }
}

async function getAuthToken() {
    if (!currentUser) return null
    try {
        return await currentUser.getIdToken()
    } catch (err) {
        console.error('getAuthToken error:', err)
        return null
    }
}

window.handleLogout = function () {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if(!overlay || !body) return;

    body.innerHTML = `
        <div class="auth-modal auth-modal--danger">
            <div class="auth-modal-header">
                <span class="material-symbols-outlined auth-modal-icon text-danger">logout</span>
                <h2>Keluar Akun</h2>
            </div>
            <p class="auth-modal-desc">Apakah kamu yakin ingin keluar? Kamu perlu masuk lagi untuk menyimpan itinerary baru.</p>
            <div class="auth-modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Batal</button>
                <button class="btn btn-danger" onclick="executeLogout()">Ya, Keluar</button>
            </div>
        </div>
    `;
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

window.executeLogout = async function () {
    try {
        await signOut(auth)
        currentUser = null
        updateAuthUI(null)
        if(typeof closeModal === 'function') closeModal();
        showToast('Kamu berhasil keluar. Sampai jumpa!')
    } catch (err) {
        showToast('Gagal keluar. Coba lagi.', 'error')
    }
}
function updateAuthUI(user) {
    const btnLogin = document.getElementById('btn-login')
    const userInfo = document.getElementById('user-info')
    const userAvatar = document.getElementById('user-avatar')
    const userName = document.getElementById('user-name')
    const dropdownFullName = document.getElementById('user-dropdown-fullname')
    const dropdownEmail = document.getElementById('user-dropdown-email')

    // Elemen Tambahan: Target UI di dalam Hamburger/Mobile Menu
    const mobileBtnLogin = document.getElementById('mobile-btn-login')
    const mobileUserProfile = document.getElementById('mobile-user-profile')
    const mobileUserAvatar = document.getElementById('mobile-user-avatar')
    const mobileUserName = document.getElementById('mobile-user-name')

    if (user) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'Traveler'
        // Update UI Desktop
        if (btnLogin) btnLogin.classList.add('hidden')
        if (userInfo) userInfo.classList.remove('hidden')
        if (userAvatar) {
            userAvatar.src = user.photoURL || ''
            userAvatar.onerror = () => { userAvatar.style.display = 'none' }
        }
        if (userName) userName.textContent = displayName
        if (dropdownFullName) dropdownFullName.textContent = user.displayName || 'Traveler'
        if (dropdownEmail) dropdownEmail.textContent = user.email || ''

        // Update UI Mobile Menu
        if (mobileBtnLogin) mobileBtnLogin.classList.add('hidden')
        if (mobileUserProfile) mobileUserProfile.classList.remove('hidden')
        if (mobileUserAvatar) {
            mobileUserAvatar.src = user.photoURL || ''
            mobileUserAvatar.onerror = () => { mobileUserAvatar.style.display = 'none' }
        }
        if (mobileUserName) mobileUserName.textContent = displayName
    } else {
        // Update UI Desktop
        if (btnLogin) btnLogin.classList.remove('hidden')
        if (userInfo) userInfo.classList.add('hidden')
        
        // Hide dropdown if open
        const dropdownContainer = document.getElementById('user-info');
        if (dropdownContainer) dropdownContainer.classList.remove('active');

        // Update UI Mobile Menu
        if (mobileBtnLogin) mobileBtnLogin.classList.remove('hidden')
        if (mobileUserProfile) mobileUserProfile.classList.add('hidden')
    }

    // Refresh data tab saat ini (misalnya Perjalananku) setelah state berubah
    if (window.location.hash === '#mytrips' && typeof loadMyTrips === 'function') {
        loadMyTrips();
    }
}

// ══════════════════════════════════════════════════════════════
//  UI / NAVIGATION
// ══════════════════════════════════════════════════════════════
function initUI() {
    document.querySelectorAll('.chip input').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.chip span').forEach(s => s.style.removeProperty('all'))
        })
    })

    // Logika Dropdown Akun
    const dropdownBtn = document.getElementById('user-dropdown-btn');
    const dropdownContainer = document.getElementById('user-info');
    if (dropdownBtn && dropdownContainer) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContainer.classList.toggle('active');
            const isActive = dropdownContainer.classList.contains('active');
            dropdownBtn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });
        
        // Tutup dropdown saat klik di luar
        document.addEventListener('click', (e) => {
            if (dropdownContainer.classList.contains('active') && !dropdownContainer.contains(e.target)) {
                dropdownContainer.classList.remove('active');
                dropdownBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    window.addEventListener('hashchange', handleHashChange);
    // Jalankan pertama kali saat load
    handleHashChange();
}

function handleHashChange() {
    let hash = window.location.hash.substring(1);
    const validTabs = ['planner', 'mytrips', 'community'];
    const path = window.location.pathname;
    const isIndex = path === '/' || path === '/index.html' || path === '';
    
    if (!validTabs.includes(hash)) {
        if (isIndex) {
            hash = 'planner';
            window.history.replaceState(null, null, '#' + hash);
        } else {
            // Kita berada di halaman statis
            updateActiveNav();
            return;
        }
    } else {
        if (!isIndex) {
            // Jika kita berada di halaman statis tapi ada hash yang valid, 
            // biarkan browser berpindah ke beranda lewat link, atau redirect manual
            window.location.href = '/#' + hash;
            return;
        }
    }

    // SPA Logic untuk index.html
    document.querySelectorAll('.nav-tab, .mobile-menu-tab').forEach(t => {
        t.classList.remove('active');
        t.removeAttribute('aria-current');
        if (t.dataset.hash === hash) {
            t.classList.add('active');
            t.setAttribute('aria-current', 'page');
        }
    });

    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
    });
    
    const page = document.getElementById(`page-${hash}`);
    if (page) {
        page.classList.remove('hidden');
        page.classList.add('active');
    }

    if (hash === 'mytrips' && typeof loadMyTrips === 'function') loadMyTrips();
    if (hash === 'community' && typeof loadCommunity === 'function') loadCommunity();

    // Tutup menu mobile
    const mobileMenu = document.getElementById('mobile-menu');
    const hamburger = document.getElementById('hamburger-menu');
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
        hamburger?.classList.remove('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
}

function updateActiveNav() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-tab, .mobile-menu-tab').forEach(t => {
        t.classList.remove('active');
        t.removeAttribute('aria-current');
        // Jika path halaman statis sesuai dengan href tautan
        if (t.getAttribute('href') === path || t.getAttribute('href') === path.split('/').pop()) {
            t.classList.add('active');
            t.setAttribute('aria-current', 'page');
        }
    });
}

// Fallback untuk tombol-tombol yang masih memanggil showTab secara eksplisit
window.showTab = function (tab) {
    window.location.hash = tab;
}

// Toggle Mobile Menu
window.toggleMobileMenu = function () {
    const mobileMenu = document.getElementById('mobile-menu')
    const hamburger = document.getElementById('hamburger-menu')

    if (mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.remove('hidden')
        hamburger.classList.add('active')
    } else {
        mobileMenu.classList.add('hidden')
        hamburger.classList.remove('active')
    }
}

// ══════════════════════════════════════════════════════════════
//  MODE TOGGLE (text vs vision)
// ══════════════════════════════════════════════════════════════
window.switchMode = function (mode) {
    document.getElementById('mode-text').classList.toggle('active', mode === 'text')
    document.getElementById('mode-vision').classList.toggle('active', mode === 'vision')
    document.getElementById('form-text').classList.toggle('hidden', mode !== 'text')
    document.getElementById('form-vision').classList.toggle('hidden', mode !== 'vision')
    hideError()
}

// ══════════════════════════════════════════════════════════════
//  FILE UPLOAD (Vision Mode)
// ══════════════════════════════════════════════════════════════
let selectedFile = null

window.handleDragOver = function (e) {
    e.preventDefault()
    document.getElementById('upload-area').classList.add('drag-over')
}
window.handleDragLeave = function () {
    document.getElementById('upload-area').classList.remove('drag-over')
}
window.handleDrop = function (e) {
    e.preventDefault()
    document.getElementById('upload-area').classList.remove('drag-over')
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
}
window.handleFileSelect = function (e) {
    const file = e.target.files[0]
    if (file) processFile(file)
}

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        return showError('Hanya file gambar yang didukung (JPEG, PNG, WEBP).')
    }
    if (file.size > 10 * 1024 * 1024) {
        return showError('Ukuran file terlalu besar. Maksimum 10 MB.')
    }
    selectedFile = file

    const reader = new FileReader()
    reader.onload = (e) => {
        const previewImg = document.getElementById('preview-img')
        const uploadContent = document.getElementById('upload-content')
        const uploadPreview = document.getElementById('upload-preview')

        previewImg.src = e.target.result
        uploadContent.classList.add('hidden')
        uploadPreview.classList.remove('hidden')
    }
    reader.readAsDataURL(file)
}

// ══════════════════════════════════════════════════════════════
//  AI GENERATION — Text Mode
// ══════════════════════════════════════════════════════════════
let isGenerating = false;

window.generateItinerary = async function () {
    if (isGenerating) return;
    
    const origin = document.getElementById('origin').value.trim()
    const destination = document.getElementById('destination').value.trim()
    const duration = document.querySelector('input[name="duration"]:checked')?.value
    const budget = document.querySelector('input[name="budget"]:checked')?.value
    const styleEl = document.querySelector('input[name="style"]:checked')
    const style = styleEl?.value || ''

    if (!destination) return showError('Destinasi tujuan wajib diisi.')
    if (!duration) return showError('Pilih durasi perjalanan.')
    if (!budget) return showError('Pilih estimasi anggaran.')
    if (!style) return showError('Pilih gaya wisata.')

    hideError()
    setGenerateLoading('text', true)
    hideResult()
    isGenerating = true;

    try {
        const token = await getAuthToken()
        const headers = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const resp = await fetch(`${API_BASE}/api/generate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ origin, destination, duration, budget, style }),
        })
        
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({ error: 'Gagal' }))
            throw new Error(errData.error || `Server error HTTP ${resp.status}`)
        }

        const section = document.getElementById('result-section')
        const body = document.getElementById('result-body')
        
        section.classList.remove('hidden')
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
        body.innerHTML = '<span class="cursor"></span>'
        
        // Sembunyikan tab lain sementara loading stream
        document.getElementById('vtab-budget')?.classList.add('hidden')
        document.getElementById('vtab-map')?.classList.add('hidden')
        document.querySelector('.budget-container')?.classList.add('hidden')
        document.getElementById('route-map')?.classList.add('hidden')

        const reader = resp.body.getReader()
        const decoder = new TextDecoder("utf-8")
        let buffer = ''
        let fullText = ''
        let isBudgetPart = false
        let budgetJsonStr = ''
        let tripData = null

        while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            
            const lines = buffer.split('\n\n')
            buffer = lines.pop()
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6)
                    let data;
                    try { data = JSON.parse(dataStr) } catch(e) { continue }
                    
                    if (data.type === 'meta') {
                        tripData = data.tripData
                    } else if (data.type === 'chunk') {
                        if (!isBudgetPart) {
                            fullText += data.content
                            if (fullText.includes('---BUDGET---')) {
                                isBudgetPart = true
                                const parts = fullText.split('---BUDGET---')
                                fullText = parts[0]
                                budgetJsonStr = parts[1] || ''
                                body.innerHTML = window.DOMPurify.sanitize(window.marked.parse(fullText)) + '<span class="cursor"></span>'
                            } else {
                                body.innerHTML = window.DOMPurify.sanitize(window.marked.parse(fullText)) + '<span class="cursor"></span>'
                            }
                        } else {
                            budgetJsonStr += data.content
                        }
                    } else if (data.type === 'error') {
                        throw new Error(data.error)
                    }
                }
            }
        }
        
        let budgetBreakdown = null
        if (budgetJsonStr.trim()) {
            try {
                // Bersihkan kemungkinan backtick markdown dari JSON response
                let cleanJson = budgetJsonStr.trim()
                if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json/, '')
                if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```/, '')
                if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)
                
                const categories = JSON.parse(cleanJson.trim())
                budgetBreakdown = {
                    categories,
                    total: categories.reduce((s, i) => s + (i.amount || 0), 0),
                    currency: "IDR"
                }
            } catch(e) {
                console.warn('Gagal parse budget JSON dari AI:', e)
            }
        }

        lastResult = { itineraryText: fullText, tripData: tripData || { origin, destination, duration, budget, style }, budgetBreakdown }
        showResult(fullText, lastResult.tripData, budgetBreakdown)
        showToast('Itinerary berhasil dibuat!', 'success')
    } catch (err) {
        showError(err.message)
    } finally {
        isGenerating = false;
        setGenerateLoading('text', false)
    }
}

// ══════════════════════════════════════════════════════════════
//  AI GENERATION — Vision Mode
// ══════════════════════════════════════════════════════════════
window.generateVision = async function () {
    if (!selectedFile) return showError('Pilih atau seret foto destinasi terlebih dahulu.')

    const hint = document.getElementById('vision-hint').value.trim()
    hideError()
    setGenerateLoading('vision', true)
    hideResult()

    try {
        const formData = new FormData()
        formData.append('image', selectedFile)
        if (hint) formData.append('destination', hint)

        const token = await getAuthToken()
        const headers = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        const resp = await fetch(`${API_BASE}/api/generate-vision`, {
            method: 'POST',
            headers,
            body: formData,
        })

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({ error: 'Gagal' }))
            throw new Error(errData.error || `Server error HTTP ${resp.status}`)
        }

        const section = document.getElementById('result-section')
        const body = document.getElementById('result-body')
        
        section.classList.remove('hidden')
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
        body.innerHTML = '<span class="cursor"></span>'
        
        // Sembunyikan tab lain sementara loading stream
        document.getElementById('vtab-budget')?.classList.add('hidden')
        document.getElementById('vtab-map')?.classList.add('hidden')
        document.querySelector('.budget-container')?.classList.add('hidden')
        document.getElementById('route-map')?.classList.add('hidden')

        const reader = resp.body.getReader()
        const decoder = new TextDecoder("utf-8")
        let buffer = ''
        let fullText = ''
        let isBudgetPart = false
        let budgetJsonStr = ''
        let tripData = null

        while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            
            const lines = buffer.split('\n\n')
            buffer = lines.pop()
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6)
                    let data;
                    try { data = JSON.parse(dataStr) } catch(e) { continue }
                    
                    if (data.type === 'meta') {
                        tripData = data.tripData
                    } else if (data.type === 'chunk') {
                        if (!isBudgetPart) {
                            fullText += data.content
                            if (fullText.includes('---BUDGET---')) {
                                isBudgetPart = true
                                const parts = fullText.split('---BUDGET---')
                                fullText = parts[0]
                                budgetJsonStr = parts[1] || ''
                                body.innerHTML = window.DOMPurify.sanitize(window.marked.parse(fullText)) + '<span class="cursor"></span>'
                            } else {
                                body.innerHTML = window.DOMPurify.sanitize(window.marked.parse(fullText)) + '<span class="cursor"></span>'
                            }
                        } else {
                            budgetJsonStr += data.content
                        }
                    } else if (data.type === 'error') {
                        throw new Error(data.error)
                    }
                }
            }
        }
        
        let budgetBreakdown = null
        if (budgetJsonStr.trim()) {
            try {
                let cleanJson = budgetJsonStr.trim()
                if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json/, '')
                if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```/, '')
                if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)
                
                const categories = JSON.parse(cleanJson.trim())
                budgetBreakdown = {
                    categories,
                    total: categories.reduce((s, i) => s + (i.amount || 0), 0),
                    currency: "IDR"
                }
            } catch(e) {
                console.warn('Gagal parse budget JSON dari AI:', e)
            }
        }

        lastResult = { itineraryText: fullText, tripData: tripData || { destination: hint || 'Destinasi dari Gambar' }, budgetBreakdown }
        showResult(fullText, lastResult.tripData, budgetBreakdown)
        showToast('Foto berhasil dianalisis!', 'success')
    } catch (err) {
        showError(err.message)
    } finally {
        setGenerateLoading('vision', false)
    }
}

function setGenerateLoading(mode, loading) {
    const btnId = mode === 'text' ? 'btn-generate-text' : 'btn-generate-vision'
    const btn = document.getElementById(btnId)
    if (!btn) return

    const btnText = btn.querySelector('.btn-text')
    const btnLoading = btn.querySelector('.btn-loading')

    btn.disabled = loading
    btnText.classList.toggle('hidden', loading)
    btnLoading.classList.toggle('hidden', !loading)
}

// ══════════════════════════════════════════════════════════════
//  RESULT RENDERING
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  WEATHER — Open-Meteo real-time forecast
// ══════════════════════════════════════════════════════════════

const WMO_CODES = {
    0: { label: 'Cerah', icon: '☀️' },
    1: { label: 'Sebagian Cerah', icon: '🌤️' },
    2: { label: 'Berawan Sebagian', icon: '⛅' },
    3: { label: 'Mendung', icon: '☁️' },
    45: { label: 'Berkabut', icon: '🌫️' }, 48: { label: 'Berkabut', icon: '🌫️' },
    51: { label: 'Gerimis', icon: '🌦️' }, 53: { label: 'Gerimis', icon: '🌦️' }, 55: { label: 'Gerimis', icon: '🌦️' },
    61: { label: 'Hujan Ringan', icon: '🌧️' }, 63: { label: 'Hujan Sedang', icon: '🌧️' }, 65: { label: 'Hujan Lebat', icon: '🌧️' },
    71: { label: 'Salju Ringan', icon: '🌨️' }, 73: { label: 'Salju Sedang', icon: '🌨️' }, 75: { label: 'Salju Lebat', icon: '🌨️' },
    80: { label: 'Hujan Lokal', icon: '🌦️' }, 81: { label: 'Hujan Deras Lokal', icon: '⛈️' }, 82: { label: 'Hujan Deras', icon: '⛈️' },
    95: { label: 'Badai Petir', icon: '⛈️' }, 96: { label: 'Badai + Hujan Es', icon: '⛈️' }, 99: { label: 'Badai + Hujan Es', icon: '⛈️' },
}
const EXTREME_CODES = new Set([65, 80, 81, 82, 95, 96, 99])

async function fetchAndInjectWeather(lat, lng, duration) {
    try {
        const departureDateEl = document.getElementById('departure-date')
        const departureDate = departureDateEl?.value

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FJakarta&forecast_days=14`
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) return
        const data = await res.json()
        if (!data.daily) return

        const { time, weathercode, temperature_2m_max, temperature_2m_min } = data.daily

        // Find offset from departure date to first available forecast date
        let startIdx = 0
        if (departureDate) {
            const depTs = new Date(departureDate).getTime()
            startIdx = time.findIndex(t => new Date(t).getTime() >= depTs)
            if (startIdx < 0) startIdx = 0
        }

        // Inject weather widget into each day heading in result-body
        const resultBody = document.getElementById('result-body')
        if (!resultBody) return

        const dayHeadings = resultBody.querySelectorAll('h2, h3')
        let dayCount = 0

        for (const heading of dayHeadings) {
            if (!heading.textContent.match(/hari\s*\d+/i)) continue
            const idx = startIdx + dayCount
            if (idx >= time.length) break

            const code = weathercode[idx]
            const wmo = WMO_CODES[code] || { label: 'Variabel', icon: '🌡️' }
            const tmax = Math.round(temperature_2m_max[idx])
            const tmin = Math.round(temperature_2m_min[idx])
            const isExtreme = EXTREME_CODES.has(code)

            const badge = document.createElement('span')
            badge.className = `weather-badge${isExtreme ? ' weather-badge--extreme' : ''}`
            badge.title = `${wmo.label} · ${tmin}°–${tmax}°C`
            badge.innerHTML = `${wmo.icon} <span>${tmin}°–${tmax}°C</span>`
            heading.appendChild(badge)

            if (isExtreme) {
                const warn = document.createElement('div')
                warn.className = 'weather-warning'
                warn.innerHTML = `⚠️ Prakiraan cuaca ekstrem pada hari ini: <strong>${wmo.label}</strong>. Pertimbangkan aktivitas alternatif indoor.`
                heading.after(warn)
            }

            dayCount++
            if (dayCount >= duration) break
        }
    } catch { /* graceful: cuaca gagal tidak merusak apapun */ }
}

function showResult(itineraryText, tripData, budgetBreakdown) {
    const section = document.getElementById('result-section')
    const body = document.getElementById('result-body')
    const meta = document.getElementById('result-meta')

    body.innerHTML = window.DOMPurify.sanitize(window.marked.parse(itineraryText))

    const parts = []
    if (tripData.destination) parts.push(`<span class="material-symbols-outlined">location_on</span> <strong>${tripData.destination}</strong>`)
    if (tripData.duration) parts.push(`<span class="material-symbols-outlined">calendar_month</span> ${tripData.duration} hari`)
    if (tripData.budget) parts.push(`<span class="material-symbols-outlined">payments</span> ${tripData.budget}`)
    if (tripData.style) parts.push(`<span class="material-symbols-outlined">luggage</span> ${tripData.style}`)
    meta.innerHTML = window.DOMPurify.sanitize(parts.join(' &nbsp;·&nbsp; '))

    // Set budget state
    budgetData = budgetBreakdown
    const tabBudget = document.getElementById('vtab-budget')
    const containerBudget = document.querySelector('.budget-container')
    const noDataBudget = document.getElementById('budget-no-data')

    if (budgetData) {
        if (tabBudget) tabBudget.classList.remove('hidden')
        if (containerBudget) containerBudget.classList.remove('hidden')
        if (noDataBudget) noDataBudget.classList.add('hidden')
        if (budgetChartInstance) {
            budgetChartInstance.destroy()
            budgetChartInstance = null
        }
    } else {
        if (tabBudget) tabBudget.classList.add('hidden')
        if (containerBudget) containerBudget.classList.add('hidden')
        if (noDataBudget) noDataBudget.classList.remove('hidden')
    }

    section.classList.remove('hidden')
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    document.getElementById('vtab-map')?.classList.remove('hidden')

    // Reset map view to itinerary tab and kick off background extraction
    switchResultView('itinerary')
    resetMapState()
    fetchAndRenderMap(itineraryText, tripData.duration)
}


function hideResult() {
    document.getElementById('result-section').classList.add('hidden')
}

window.regenerate = function () {
    const activeMode = document.getElementById('form-vision').classList.contains('hidden')
        ? 'text' : 'vision'
    if (activeMode === 'text') {
        generateItinerary()
    } else {
        generateVision()
    }
}

// ══════════════════════════════════════════════════════════════
//  SAVE ITINERARY
// ══════════════════════════════════════════════════════════════
window.saveItinerary = async function () {
    if (!currentUser) {
        showToast('Login dulu untuk menyimpan itinerary!', 'error')
        return handleLogin()
    }
    if (!lastResult) return showToast('Buat itinerary terlebih dahulu.', 'error')

    const isPublic = document.getElementById('toggle-public').checked
    const token = await getAuthToken()
    const btnSave = document.getElementById('btn-save')

    if (!token) return showToast('Token tidak valid. Coba login ulang.', 'error')

    btnSave.disabled = true
    btnSave.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">hourglass_top</span> Menyimpan…'

    try {
        const resp = await fetch(`${API_BASE}/api/itineraries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                tripData: lastResult.tripData,
                itineraryText: lastResult.itineraryText,
                isPublic,
            }),
        })

        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error || 'Gagal menyimpan.')

        showToast('Itinerary berhasil disimpan!', 'success')
        btnSave.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">check_circle</span> Tersimpan'
        setTimeout(() => {
            btnSave.disabled = false
            btnSave.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">bookmark</span> Simpan`
        }, 3000)
    } catch (err) {
        showToast(err.message, 'error')
        btnSave.disabled = false
        btnSave.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">bookmark</span> Simpan'
    }
}

// ══════════════════════════════════════════════════════════════
//  EXPORT TO CALENDAR
// ══════════════════════════════════════════════════════════════
window.exportToCalendar = function () {
    if (!mapDays || mapDays.length === 0) {
        showToast('Data lokasi belum siap atau gagal dimuat. Harap tunggu peta selesai dimuat.', 'error');
        return;
    }

    const departureDateEl = document.getElementById('departure-date');
    let startDate = new Date();
    if (departureDateEl && departureDateEl.value) {
        startDate = new Date(departureDateEl.value);
    }

    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Jelajah Nusantara//ID\nCALSCALE:GREGORIAN\n";

    mapDays.forEach((day, index) => {
        const eventDate = new Date(startDate);
        eventDate.setDate(startDate.getDate() + index);

        // Format dates as YYYYMMDD
        const startStr = eventDate.toISOString().split('T')[0].replace(/-/g, '');
        const nextDate = new Date(eventDate);
        nextDate.setDate(eventDate.getDate() + 1);
        const endStr = nextDate.toISOString().split('T')[0].replace(/-/g, '');

        const destination = lastResult?.tripData?.destination || 'Destinasi';
        const summary = `Hari ${day.day} — ${destination}: ${day.theme || 'Jelajah'}`;
        
        let description = `Itinerary Hari ${day.day}\\n`;
        if (day.theme) description += `Tema: ${day.theme}\\n\\n`;
        
        let locationStr = day.locations.map(l => l.name).join(', ');
        if (!locationStr) locationStr = destination;
        
        day.locations.forEach((loc, idx) => {
             description += `${idx + 1}. ${loc.name}`;
             if (loc.time) description += ` (${loc.time})`;
             description += `\\n`;
             if (loc.description) description += `${loc.description}\\n`;
             description += `\\n`;
        });
        
        if (day.locations.length > 0) {
            const gmapsUrl = buildGoogleMapsUrl(day.locations.map(l => [l.lat, l.lng]));
            description += `Rute di Google Maps: ${gmapsUrl}\\n`;
        }

        icsContent += "BEGIN:VEVENT\n";
        icsContent += `DTSTART;VALUE=DATE:${startStr}\n`;
        icsContent += `DTEND;VALUE=DATE:${endStr}\n`;
        icsContent += `SUMMARY:${summary}\n`;
        icsContent += `DESCRIPTION:${description}\n`;
        icsContent += `LOCATION:${locationStr}\n`;
        icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Itinerary_${(lastResult?.tripData?.destination || 'Jelajah').replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('File kalender berhasil diunduh.', 'success');
}

// ══════════════════════════════════════════════════════════════
//  SHARE
// ══════════════════════════════════════════════════════════════
window.shareItinerary = async function () {
    if (!lastResult) return

    const shareText = `Cek itinerary perjalanan ke ${lastResult.tripData?.destination || 'Indonesia'} yang aku buat di Jelajah Nusantara!\n\n${window.location.href}`

    if (navigator.share) {
        try {
            await navigator.share({ title: 'Jelajah Nusantara', text: shareText })
        } catch { }
    } else {
        await navigator.clipboard.writeText(shareText)
        showToast('Link berhasil disalin!', 'success')
    }
}

// ══════════════════════════════════════════════════════════════
//  MY TRIPS
// ══════════════════════════════════════════════════════════════
async function loadMyTrips() {
    const authGate = document.getElementById('mytrips-auth-gate')
    const loading = document.getElementById('mytrips-loading')
    const grid = document.getElementById('mytrips-grid')
    const empty = document.getElementById('mytrips-empty')

    grid.innerHTML = ''
    empty.classList.add('hidden')

    if (!currentUser) {
        authGate.classList.remove('hidden')
        loading.classList.add('hidden')
        return
    }

    authGate.classList.add('hidden')
    loading.classList.remove('hidden')

    const token = await getAuthToken()
    if (!token) {
        loading.classList.add('hidden')
        return showToast('Token tidak valid. Coba login ulang.', 'error')
    }

    try {
        const resp = await fetch(`${API_BASE}/api/itineraries/my`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error)

        loading.classList.add('hidden')

        if (!data.trips || data.trips.length === 0) {
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
        }

        data.trips.forEach((trip, i) => {
            const card = createTripCard(trip, { showActions: true, delay: i * 0.05 })
            grid.appendChild(card)
        })
        if (window.fetchWikiImages) fetchWikiImages();
    } catch (err) {
        loading.classList.add('hidden')
        showToast('Gagal memuat perjalananmu: ' + err.message, 'error')
    }
}

// ══════════════════════════════════════════════════════════════
//  COMMUNITY
// ══════════════════════════════════════════════════════════════
async function loadCommunity() {
    const loading = document.getElementById('community-loading')
    const grid = document.getElementById('community-grid')
    const empty = document.getElementById('community-empty')

    grid.innerHTML = ''
    empty.classList.add('hidden')
    loading.classList.remove('hidden')

    try {
        const resp = await fetch(`${API_BASE}/api/itineraries/public?limit=20`)
        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error)

        loading.classList.add('hidden')

        if (!data.trips || data.trips.length === 0) {
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
        }

        data.trips.forEach((trip, i) => {
            const card = createTripCard(trip, { showActions: false, delay: i * 0.04 })
            grid.appendChild(card)
        })
        if (window.fetchWikiImages) fetchWikiImages();
    } catch (err) {
        loading.classList.add('hidden')
        showToast('Gagal memuat komunitas: ' + err.message, 'error')
    }
}

// ══════════════════════════════════════════════════════════════
//  TRIP CARD RENDERER
// ══════════════════════════════════════════════════════════════
// Material Symbols icon names for destinations
const DESTINATION_ICONS = {
    bali: 'spa', lombok: 'beach_access', raja: 'scuba_diving', komodo: 'pets',
    labuan: 'pool', bromo: 'landscape', semeru: 'terrain', yogya: 'account_balance',
    jogja: 'account_balance', solo: 'theater_comedy', semarang: 'location_city', surabaya: 'location_city',
    jakarta: 'location_city', bandung: 'park', medan: 'restaurant', manado: 'scuba_diving',
    makassar: 'water', flores: 'eco', toraja: 'account_balance', wakatobi: 'scuba_diving',
    default: 'flight',
}

function getDestIcon(destination = '') {
    const lower = destination.toLowerCase()
    for (const [key, icon] of Object.entries(DESTINATION_ICONS)) {
        if (key !== 'default' && lower.includes(key)) return icon
    }
    return DESTINATION_ICONS.default
}

function formatDate(isoString) {
    if (!isoString) return ''
    const d = new Date(isoString)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function createTripCard(trip, { showActions = false, delay = 0 }) {
    const card = document.createElement('div')
    card.className = 'trip-card'
    card.style.animationDelay = `${delay}s`

    const dest = trip.tripData?.destination || 'Destinasi'
    const duration = trip.tripData?.duration || '?'
    const style = trip.tripData?.style || ''
    const budget = trip.tripData?.budget || ''
    const destImage = getDestImage(dest)
    const preview = trip.itineraryPreview || trip.itineraryText?.substring(0, 280) + '...' || ''
    const date = formatDate(trip.createdAt)
    const userName = trip.userName || 'Traveler'
    const isPublic = trip.isPublic
    const likes = trip.likes || 0

    let avatarHTML = ''
    if (trip.userPhoto) {
        avatarHTML = `<img src="${trip.userPhoto}" alt="${userName}" loading="lazy" width="24" height="24"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
      <div class="trip-author-fallback" style="display:none">${userName[0].toUpperCase()}</div>`
    } else {
        avatarHTML = `<div class="trip-author-fallback">${userName[0].toUpperCase()}</div>`
    }

    let actionsHTML = ''
    if (showActions) {
        actionsHTML = `
      <div class="trip-card-actions">
        <button class="btn-card-action btn-card-toggle"
          onclick="event.stopPropagation(); togglePublic('${trip.id}', ${!isPublic}, this)">
          <span class="material-symbols-outlined">${isPublic ? 'lock' : 'public'}</span>
          ${isPublic ? 'Jadikan Privat' : 'Jadikan Publik'}
        </button>
        <button class="btn-card-action btn-card-delete"
          onclick="event.stopPropagation(); deleteTrip('${trip.id}', this.closest('.trip-card'))">
          <span class="material-symbols-outlined">delete</span> Hapus
        </button>
      </div>`
    }

    card.innerHTML = `
    <div class="trip-card-cover">
      <img src="${destImage}" data-wiki-dest="${dest}" alt="${dest}" loading="lazy" width="400" height="250" />
      <div class="trip-card-cover-overlay"></div>
      <div class="trip-card-dest">${dest}</div>
    </div>
    <div class="trip-card-body">
      <div class="trip-card-meta">
        ${duration ? `<span class="trip-badge"><span class="material-symbols-outlined">calendar_month</span> ${duration} hari</span>` : ''}
        ${style ? `<span class="trip-badge"><span class="material-symbols-outlined">luggage</span> ${style.split(' ')[0]}</span>` : ''}
        ${budget ? `<span class="trip-badge"><span class="material-symbols-outlined">payments</span> ${budget.split(' ')[0]}</span>` : ''}
        ${isPublic ? `<span class="trip-badge trip-badge--public"><span class="material-symbols-outlined">public</span> Publik</span>` : ''}
      </div>
      <p class="trip-card-preview">${preview.replace(/[#*\`_\[\]]/g, '')}</p>
      <div class="trip-card-footer">
        <div class="trip-author">
          ${avatarHTML}
          <span>${userName} · ${date}</span>
        </div>
        <div class="trip-stats">
          <span class="trip-stat" onclick="event.stopPropagation(); likeTrip('${trip.id}', this)">
            <span class="material-symbols-outlined">favorite</span> <span>${likes}</span>
          </span>
        </div>
      </div>
      ${actionsHTML}
    </div>`

    card.addEventListener('click', () => openTripModal(trip))
    return card
}

// ══════════════════════════════════════════════════════════════
//  TRIP MODAL
// ══════════════════════════════════════════════════════════════
async function openTripModal(trip) {
    const overlay = document.getElementById('modal-overlay')
    const body = document.getElementById('modal-body')

    const dest = trip.tripData?.destination || 'Destinasi'
    const destIcon = getDestIcon(dest)
    const duration = trip.tripData?.duration
    const tripStyle = trip.tripData?.style
    const budget = trip.tripData?.budget
    const destImage = getDestImage(dest)
    const date = formatDate(trip.createdAt)
    const userName = trip.userName || 'Traveler'
    const likes = trip.likes || 0
    const isPublic = trip.isPublic
    const isOwner = currentUser && currentUser.uid === trip.userId

    let avatarHTML = ''
    if (trip.userPhoto) {
        avatarHTML = `<img class="modal-author-avatar" src="${trip.userPhoto}" alt="${userName}"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
            <div class="modal-author-fallback" style="display:none">${userName[0].toUpperCase()}</div>`
    } else {
        avatarHTML = `<div class="modal-author-fallback">${userName[0].toUpperCase()}</div>`
    }

    const badges = [
        duration ? `<span class="modal-badge"><span class="material-symbols-outlined">calendar_month</span>${duration} hari</span>` : '',
        tripStyle ? `<span class="modal-badge"><span class="material-symbols-outlined">luggage</span>${tripStyle.split(' ')[0]}</span>` : '',
        budget ? `<span class="modal-badge"><span class="material-symbols-outlined">payments</span>${budget.split(' ')[0]}</span>` : '',
        isPublic ? `<span class="modal-badge modal-badge--public"><span class="material-symbols-outlined">public</span>Publik</span>` : '',
    ].filter(Boolean).join('')

    const ownerActions = isOwner ? `
        <div class="modal-owner-actions">
            <button class="modal-action-btn modal-action-toggle"
                onclick="togglePublic('${trip.id}', ${!isPublic}, this)">
                <span class="material-symbols-outlined">${isPublic ? 'lock' : 'public'}</span>
                ${isPublic ? 'Jadikan Privat' : 'Jadikan Publik'}
            </button>
            <button class="modal-action-btn modal-action-delete"
                onclick="deleteTrip('${trip.id}', null); closeModal()">
                <span class="material-symbols-outlined">delete</span>
                Hapus
            </button>
        </div>` : ''

    body.innerHTML = `
        <div class="modal-trip-header">
            <div class="modal-trip-banner">
                <span class="modal-trip-emoji"><span class="material-symbols-outlined">${destIcon}</span></span>
                <div>
                    <h2 class="modal-trip-dest">${dest}</h2>
                </div>
            </div>
            <div class="modal-trip-meta">
                ${badges ? `<div class="modal-badges">${badges}</div>` : ''}
                <div class="modal-author-row">
                    <div class="modal-author">
                        ${avatarHTML}
                        <span class="modal-author-name">${userName}</span>
                        ${date ? `<span class="modal-author-sep">·</span><span class="modal-author-date">${date}</span>` : ''}
                    </div>
                    <button class="modal-like-btn" onclick="likeTrip('${trip.id}', this)">
                        <span class="material-symbols-outlined">favorite</span>
                        <span>${likes}</span>
                    </button>
                </div>
                ${ownerActions}
            </div>
        </div>
        <div class="modal-divider"></div>
        <div class="modal-itinerary-content" id="modal-itinerary-content">
            <div class="modal-loading">
                <div class="spinner" style="border-color:rgba(0,0,0,0.08);border-top-color:var(--rausch);width:24px;height:24px"></div>
                <span>Memuat itinerary...</span>
            </div>
        </div>`

    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
    
    // Focus trap
    const modalBox = overlay.querySelector('.modal-box');
    if(modalBox) {
        modalBox.setAttribute('tabindex', '-1');
        modalBox.focus();
    }
    
    // Global Esc listener
    window._modalEscListener = function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', window._modalEscListener);

    let itineraryText = trip.itineraryText
    if (!itineraryText || itineraryText.endsWith('...')) {
        try {
            const token = currentUser ? await getAuthToken() : null
            const headers = token ? { Authorization: `Bearer ${token}` } : {}
            const resp = await fetch(`${API_BASE}/api/itineraries/${trip.id}`, { headers })
            const data = await resp.json()
            if (resp.ok) itineraryText = data.trip.itineraryText
        } catch { }
    }

    const contentEl = document.getElementById('modal-itinerary-content')
    if (contentEl) {
        contentEl.innerHTML = window.DOMPurify.sanitize(`<div class="modal-markdown">${window.marked.parse(itineraryText || '*Konten tidak tersedia.*')}</div>`)
    }
}

window.closeModal = function () {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    const body = document.getElementById('modal-body');
    if (body) body.innerHTML = '';
    
    document.body.classList.remove('modal-open');
    if (window._modalEscListener) {
        document.removeEventListener('keydown', window._modalEscListener);
        window._modalEscListener = null;
    }
}

// ══════════════════════════════════════════════════════════════
//  TRIP ACTIONS: Like, Delete, Toggle Public
// ══════════════════════════════════════════════════════════════
window.likeTrip = async function (id, btn) {
    const token = currentUser ? await getAuthToken() : null
    if (!token) return showToast('Login dulu untuk menyukai!', 'error')

    try {
        const resp = await fetch(`${API_BASE}/api/itineraries/${id}/like`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!resp.ok) throw new Error()

        const countStr = btn.textContent.replace(/[^0-9]/g, '')
        const newCount = parseInt(countStr || '0') + 1
        // Update the count inside the span (keep the icon)
        const countSpan = btn.querySelector('span:last-child') || btn
        if (countSpan !== btn) {
            countSpan.textContent = ` ${newCount}`
        } else {
            btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px">favorite</span> ${newCount}`
        }
    } catch {
        showToast('Gagal menyukai. Coba lagi.', 'error')
    }
}

window.deleteTrip = async function (id, cardEl) {
    if (!confirm('Yakin ingin menghapus itinerary ini? Aksi ini tidak dapat dibatalkan.')) return

    const token = await getAuthToken()
    if (!token) return showToast('Token tidak valid.', 'error')

    try {
        const resp = await fetch(`${API_BASE}/api/itineraries/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!resp.ok) {
            const d = await resp.json()
            throw new Error(d.error || 'Gagal menghapus.')
        }
        cardEl.style.transition = 'all 0.3s ease'
        cardEl.style.opacity = '0'
        cardEl.style.transform = 'scale(0.95)'
        setTimeout(() => cardEl.remove(), 300)
        showToast('Itinerary berhasil dihapus.', 'success')
    } catch (err) {
        showToast(err.message, 'error')
    }
}

window.togglePublic = async function (id, newState, btn) {
    const token = await getAuthToken()
    if (!token) return showToast('Token tidak valid.', 'error')

    btn.disabled = true

    try {
        const resp = await fetch(`${API_BASE}/api/itineraries/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ isPublic: newState }),
        })
        if (!resp.ok) {
            const d = await resp.json()
            throw new Error(d.error || 'Gagal memperbarui.')
        }

        btn.innerHTML = newState
            ? '<span class="material-symbols-outlined" style="font-size:14px">lock</span> Jadikan Privat'
            : '<span class="material-symbols-outlined" style="font-size:14px">public</span> Jadikan Publik'
        btn.setAttribute('onclick',
            `event.stopPropagation(); togglePublic('${id}', ${!newState}, this)`)

        const metaEl = btn.closest('.trip-card-body')?.querySelector('.trip-card-meta')
        if (metaEl) {
            const existing = metaEl.querySelector('[data-public-badge]')
            if (newState) {
                if (!existing) {
                    const badge = document.createElement('span')
                    badge.className = 'trip-badge trip-badge--public'
                    badge.setAttribute('data-public-badge', '1')
                    badge.innerHTML = '<span class="material-symbols-outlined">public</span> Publik'
                    metaEl.appendChild(badge)
                }
            } else {
                existing?.remove()
            }
        }

        showToast(newState ? 'Itinerary kini publik!' : 'Itinerary kini privat.', 'success')
    } catch (err) {
        showToast(err.message, 'error')
    } finally {
        btn.disabled = false
    }
}

// ══════════════════════════════════════════════════════════════
//  ERROR / TOAST HELPERS
// ══════════════════════════════════════════════════════════════
function showError(msg) {
    const banner = document.getElementById('error-banner')
    document.getElementById('error-text').textContent = msg
    banner.classList.remove('hidden')
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function hideError() {
    document.getElementById('error-banner').classList.add('hidden')
}

window.dismissError = hideError

let toastTimer = null
function showToast(msg, type = '') {
    const toast = document.getElementById('toast')
    toast.textContent = msg
    toast.className = `toast show ${type}`
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.classList.remove('show') }, 3200)
}

// ══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal()
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generateItinerary()
})

// ══════════════════════════════════════════════════════════════
//  NAVBAR SCROLL EFFECT
// ══════════════════════════════════════════════════════════════
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar')
    navbar.classList.toggle('scrolled', window.scrollY > 20)
}, { passive: true })

// ══════════════════════════════════════════════════════════════
//  INTERACTIVE ROUTE MAP — Leaflet.js Integration
// ══════════════════════════════════════════════════════════════

// Day colours — up to 8 days, cycling if longer
const MAP_DAY_COLORS = [
    '#e63946', // Hari 1 — Red
    '#2a9d8f', // Hari 2 — Teal
    '#e9c46a', // Hari 3 — Gold
    '#457b9d', // Hari 4 — Blue
    '#f4a261', // Hari 5 — Orange
    '#6a4c93', // Hari 6 — Purple
    '#1a936f', // Hari 7 — Green
    '#c77dff', // Hari 8 — Lavender
]

const TIME_ICONS = { 'Pagi': 'wb_twilight', 'Siang': 'wb_sunny', 'Malam': 'dark_mode' }

function getDayColor(dayIndex) {
    return MAP_DAY_COLORS[dayIndex % MAP_DAY_COLORS.length]
}

/** Reset map state when a new itinerary is generated */
function resetMapState() {
    mapDays = null
    mapExtractAborted = false
    discoveryLayerGroup = null

    // Destroy previous Leaflet instance
    if (leafletMap) {
        leafletMap.remove()
        leafletMap = null
    }

    // Reset UI states
    document.getElementById('route-map')?.classList.add('hidden')
    document.getElementById('map-legend')?.classList.add('hidden')
    document.getElementById('map-discovery')?.classList.add('hidden')
    document.getElementById('map-loading-state')?.classList.add('hidden')
    document.getElementById('map-error-state')?.classList.add('hidden')
    document.getElementById('map-legend-days').innerHTML = ''
    document.getElementById('btn-clear-discovery')?.classList.add('hidden')
}

/** Switch between Itinerary text view and Map view */
window.switchResultView = function (view) {
    const itineraryView = document.getElementById('view-itinerary')
    const budgetView = document.getElementById('view-budget')
    const mapView = document.getElementById('view-map')
    const tabItinerary = document.getElementById('vtab-itinerary')
    const tabBudget = document.getElementById('vtab-budget')
    const tabMap = document.getElementById('vtab-map')

    // Hide all views & remove active class from all tabs
    itineraryView.classList.add('hidden')
    if (budgetView) budgetView.classList.add('hidden')
    mapView.classList.add('hidden')

    tabItinerary.classList.remove('active')
    if (tabBudget) tabBudget.classList.remove('active')
    tabMap.classList.remove('active')

    if (view === 'itinerary') {
        itineraryView.classList.remove('hidden')
        tabItinerary.classList.add('active')
    } else if (view === 'budget') {
        if (budgetView) budgetView.classList.remove('hidden')
        if (tabBudget) tabBudget.classList.add('active')
        if (budgetData) {
            renderBudgetChart(budgetData)
        }
    } else if (view === 'map') {
        mapView.classList.remove('hidden')
        tabMap.classList.add('active')

        // If map data is ready, render it; otherwise show loading
        if (mapDays) {
            renderLeafletMap(mapDays)
        } else {
            // Show loading since extraction is in progress
            document.getElementById('map-loading-state').classList.remove('hidden')
        }

        // Invalidate Leaflet size (needed when container was hidden)
        if (leafletMap) {
            setTimeout(() => leafletMap.invalidateSize(), 50)
        }
    }
}

/** Fetch location data from backend and store it */
async function fetchAndRenderMap(itineraryText, duration) {
    const MAX_CLIENT_RETRIES = 2
    let attempt = 0

    while (attempt <= MAX_CLIENT_RETRIES) {
        try {
            const token = await getAuthToken()
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers['Authorization'] = `Bearer ${token}`

            const resp = await fetch(`${API_BASE}/api/extract-locations`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ itineraryText, duration }),
            })

            if (mapExtractAborted) return

            const data = await resp.json()

            // If server says retryable (503/429) and we have retries left, wait and retry
            if (!resp.ok && data.retryable && attempt < MAX_CLIENT_RETRIES) {
                attempt++
                const waitMs = 2000 * attempt // 2s, 4s
                console.warn(`Map: retryable error, waiting ${waitMs}ms (attempt ${attempt})`)
                updateMapLoadingText(`Server AI sibuk, mencoba lagi (${attempt}/${MAX_CLIENT_RETRIES})…`)
                await new Promise(r => setTimeout(r, waitMs))
                continue
            }

            if (!resp.ok || !data.days) {
                throw new Error(data.error || 'Ekstraksi gagal')
            }

            mapDays = data.days

            // Inject real-time weather once we have the first location's coordinates
            if (data.days.length > 0 && data.days[0].locations.length > 0) {
                const firstLoc = data.days[0].locations[0]
                const tripDuration = parseInt(duration) || data.days.length
                fetchAndInjectWeather(firstLoc.lat, firstLoc.lng, tripDuration)
            }

            const mapTabActive = !document.getElementById('view-map').classList.contains('hidden')
            if (mapTabActive) {
                document.getElementById('map-loading-state').classList.add('hidden')
                renderLeafletMap(mapDays)
            }
            return // success


        } catch (err) {
            if (mapExtractAborted) return
            console.warn('Map extraction error:', err)

            if (attempt < MAX_CLIENT_RETRIES) {
                attempt++
                const waitMs = 2000 * attempt
                updateMapLoadingText(`Mencoba ulang (${attempt}/${MAX_CLIENT_RETRIES})…`)
                await new Promise(r => setTimeout(r, waitMs))
                continue
            }

            // All retries exhausted
            mapDays = null
            const mapTabActive = !document.getElementById('view-map')?.classList.contains('hidden')
            if (mapTabActive) showMapError('Gagal mengekstrak lokasi: ' + err.message)
            return
        }
    }
}

/** Update the loading message text without hiding the spinner */
function updateMapLoadingText(text) {
    const el = document.querySelector('.map-loading-text')
    if (el) el.textContent = text
}

window.retryMapExtraction = async function () {
    if (!lastResult) return
    document.getElementById('map-error-state').classList.add('hidden')
    document.getElementById('map-loading-state').classList.remove('hidden')
    await fetchAndRenderMap(lastResult.itineraryText, lastResult.tripData?.duration)
}

function showMapError(msg) {
    document.getElementById('map-loading-state').classList.add('hidden')
    document.getElementById('map-error-state').classList.remove('hidden')
    document.getElementById('map-error-msg').textContent = msg
}

/** Build a custom SVG circle marker for Leaflet */
function buildMarkerIcon(color, label) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
      <path d="M17 2C9.82 2 4 7.82 4 15c0 9.25 13 25 13 25s13-15.75 13-25c0-7.18-5.82-13-13-13z"
            fill="${color}" filter="url(#sh)" stroke="white" stroke-width="1.5"/>
      <text x="17" y="18" text-anchor="middle" dominant-baseline="middle"
            font-family="'Source Sans 3', sans-serif" font-size="10" font-weight="700"
            fill="white">${label}</text>
    </svg>`

    return window.L.divIcon({
        className: '',
        html: svg,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
        popupAnchor: [0, -44],
    })
}

const osrmCache = new Map();
let lastOsrmCall = 0;

/** Fetch driving route from OSRM Public API between two coordinates with caching and rate limit */
async function fetchOsrmRoute(from, to) {
    const key = `${from[0].toFixed(5)},${from[1].toFixed(5)}-${to[0].toFixed(5)},${to[1].toFixed(5)}`;
    if (osrmCache.has(key)) {
        return osrmCache.get(key);
    }

    // Rate limit: minimal 1 detik antar request ke OSRM Public API
    let delay = 0;
    const now = Date.now();
    if (now - lastOsrmCall < 1100) {
        delay = 1100 - (now - lastOsrmCall);
        lastOsrmCall += 1100; // Majukan target waktu untuk request berikutnya
    } else {
        lastOsrmCall = now;
    }

    if (delay > 0) {
        await new Promise(r => setTimeout(r, delay));
    }

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
        if (!res.ok) return null
        const data = await res.json()
        if (!data.routes || data.routes.length === 0) return null
        const route = data.routes[0]
        const result = {
            coords: route.geometry.coordinates.map(c => [c[1], c[0]]), // [lng,lat] → [lat,lng]
            distanceM: route.legs[0].distance,
            durationS: route.legs[0].duration,
        };
        osrmCache.set(key, result);
        return result;
    } catch {
        return null
    }
}

/** Format meters to human-readable distance string */
function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`
    return `${(meters / 1000).toFixed(1)} km`
}

/** Format seconds to human-readable duration string */
function formatDuration(seconds) {
    const mins = Math.round(seconds / 60)
    if (mins < 60) return `${mins} mnt`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h} jam ${m} mnt` : `${h} jam`
}

/** Build Google Maps Directions URL for a list of waypoints [[lat,lng],...] */
function buildGoogleMapsUrl(points) {
    if (points.length === 0) return '#'
    if (points.length === 1) {
        return `https://www.google.com/maps/search/?api=1&query=${points[0][0]},${points[0][1]}`
    }
    const origin = `${points[0][0]},${points[0][1]}`
    const destination = `${points[points.length - 1][0]},${points[points.length - 1][1]}`
    const waypoints = points.slice(1, -1).map(p => `${p[0]},${p[1]}`).join('|')
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
    if (waypoints) url += `&waypoints=${waypoints}`
    url += `&travelmode=driving`
    return url
}

/** Render the Leaflet map with extracted location data */
async function renderLeafletMap(days) {
    // Tunggu sampai Leaflet pasti termuat, apapun kondisi jaringan
    let L
    try {
        L = await loadLeaflet()
    } catch (err) {
        showMapError('Leaflet.js gagal dimuat: ' + err.message)
        return
    }

    if (!days || days.length === 0) {
        showMapError('Tidak ada data lokasi yang dapat ditampilkan.')
        return
    }

    const mapContainer = document.getElementById('route-map')
    const legendContainer = document.getElementById('map-legend')
    const discoveryContainer = document.getElementById('map-discovery')
    const legendDays = document.getElementById('map-legend-days')

    // Show map container
    mapContainer.classList.remove('hidden')
    legendContainer.classList.remove('hidden')
    discoveryContainer?.classList.remove('hidden')
    document.getElementById('map-loading-state').classList.add('hidden')
    document.getElementById('map-error-state').classList.add('hidden')

    // Destroy existing map if re-rendering
    if (leafletMap) {
        leafletMap.remove()
        leafletMap = null
    }

    // ── Initialize Leaflet map ──
    leafletMap = L.map('route-map', {
        zoomControl: true,
        scrollWheelZoom: false,
    })

    // OpenStreetMap tile layer (free, no API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(leafletMap)

    const allLatLngs = []
    legendDays.innerHTML = ''

    for (const [dayIndex, day] of days.entries()) {
        const color = getDayColor(dayIndex)
        const dayLatLngs = []

        // ── Render markers for each location ──
        day.locations.forEach((loc, locIndex) => {
            const pos = [loc.lat, loc.lng]
            allLatLngs.push(pos)
            dayLatLngs.push(pos)

            const markerLabel = `${dayIndex + 1}.${locIndex + 1}`
            const icon = buildMarkerIcon(color, markerLabel, L)
            const timeIcon = TIME_ICONS[loc.time] || 'location_on'
            const gmapsUrl = buildGoogleMapsUrl([pos])

            const popupContent = window.DOMPurify.sanitize(`
                <div class="map-popup">
                    <div class="map-popup-header" style="border-left: 3px solid ${color}">
                        <span class="map-popup-day">Hari ${day.day} · <span class="material-symbols-outlined" style="font-size:12px">${timeIcon}</span> ${loc.time || ''}</span>
                        <strong class="map-popup-name">${loc.name}</strong>
                    </div>
                    ${loc.description ? `<p class="map-popup-desc">${loc.description}</p>` : ''}
                    <a class="map-popup-gmaps" href="${gmapsUrl}" target="_blank" rel="noopener noreferrer">Buka di Google Maps</a>
                </div>`)

            L.marker(pos, { icon })
                .addTo(leafletMap)
                .bindPopup(popupContent, { maxWidth: 280, className: 'leaflet-popup-custom' })
        })

        // ── Draw OSRM route (or fallback to straight line) per segment ──
        if (dayLatLngs.length > 1) {
            const routePromises = []
            for (let i = 0; i < dayLatLngs.length - 1; i++) {
                routePromises.push(
                    fetchOsrmRoute(dayLatLngs[i], dayLatLngs[i + 1]).then(route => ({ i, route }))
                )
            }
            // Render segments as they resolve (non-blocking)
            Promise.allSettled(routePromises).then(results => {
                results.forEach(({ value }) => {
                    if (!value) return
                    const { i, route } = value
                    if (route) {
                        // Real road route
                        const pl = L.polyline(route.coords, {
                            color,
                            weight: 4,
                            opacity: 0.85,
                            lineJoin: 'round',
                        }).addTo(leafletMap)
                        // Segment label with distance and time
                        const midIdx = Math.floor(route.coords.length / 2)
                        const midPt = route.coords[midIdx] || route.coords[0]
                        L.marker(midPt, {
                            icon: L.divIcon({
                                className: 'map-segment-label',
                                html: `<span>${formatDistance(route.distanceM)} · ${formatDuration(route.durationS)}</span>`,
                                iconAnchor: [0, 0],
                            })
                        }).addTo(leafletMap)
                    } else {
                        // Fallback: straight dashed line
                        L.polyline([dayLatLngs[i], dayLatLngs[i + 1]], {
                            color,
                            weight: 3,
                            opacity: 0.65,
                            dashArray: '6, 8',
                            lineJoin: 'round',
                        }).addTo(leafletMap)
                    }
                })
            })
        }

        // ── Build legend entry with Google Maps multi-stop link ──
        const gmapsRouteUrl = buildGoogleMapsUrl(dayLatLngs)
        const legendItem = document.createElement('div')
        legendItem.className = 'map-legend-day'
        legendItem.innerHTML = window.DOMPurify.sanitize(`
            <span class="map-legend-dot" style="background:${color}"></span>
            <span class="map-legend-label">
                <strong>Hari ${day.day}</strong>${day.theme ? ` — ${day.theme}` : ''}
            </span>
            <span class="map-legend-count">${day.locations.length} lokasi</span>
            <a class="map-legend-gmaps" href="${gmapsRouteUrl}" target="_blank" rel="noopener noreferrer">Rute di Maps</a>`)
        legendDays.appendChild(legendItem)
    }

    // ── Fit map bounds to all markers ──
    if (allLatLngs.length > 0) {
        const bounds = L.latLngBounds(allLatLngs)
        leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
    }

    // ── Add a "start" circle at very first location ──
    if (allLatLngs.length > 0) {
        L.circleMarker(allLatLngs[0], {
            radius: 8,
            color: '#fff',
            fillColor: getDayColor(0),
            fillOpacity: 1,
            weight: 3,
        }).addTo(leafletMap).bindTooltip('Mulai', { permanent: true, direction: 'top', className: 'map-start-tooltip' })
    }
}

// ══════════════════════════════════════════════════════════════
//  START APP
// ══════════════════════════════════════════════════════════════
boot()

// ══════════════════════════════════════════════════════════════
//  AI BUDGET ESTIMATION & CHART.JS RENDERER
// ══════════════════════════════════════════════════════════════

/** Helper to format number to Rupiah e.g., Rp 1.500.000 */
function formatRupiah(amount) {
    if (typeof amount !== 'number') return 'Rp 0'
    return 'Rp ' + amount.toLocaleString('id-ID')
}

/** Render a premium budget Doughnut chart using Chart.js */
async function renderBudgetChart(data) {
    if (!window.Chart) {
        try {
            const { Chart, registerables } = await import('chart.js');
            Chart.register(...registerables);
            window.Chart = Chart;
        } catch (err) {
            console.warn('Chart.js gagal dimuat: ', err);
            return;
        }
    }

    const canvas = document.getElementById('budget-chart')
    if (!canvas) return

    // 1. Destroy previous chart instance to prevent layout jumping/flickering
    if (budgetChartInstance) {
        budgetChartInstance.destroy()
        budgetChartInstance = null
    }

    const categories = data.categories || []
    const total = data.total || 0

    // Curated rich warm tropical colors matching the design system
    const CHART_COLORS = [
        '#2a9d8f', // Teal
        '#e85d3a', // Coral
        '#d4a017', // Gold
        '#457b9d', // Slate Blue
        '#f4a261', // Soft Orange
        '#9c27b0', // Purple
        '#009688', // Green
    ]

    const labels = categories.map(c => c.name)
    const amounts = categories.map(c => c.amount)
    const bgColors = categories.map((_, i) => CHART_COLORS[i % CHART_COLORS.length])

    // Update total display card
    const totalDisplay = document.getElementById('budget-total-display')
    if (totalDisplay) {
        totalDisplay.innerHTML = window.DOMPurify.sanitize(`<span style="font-size: 0.9rem; font-family: var(--font-body); display: block; color: var(--muted); font-weight: 600; margin-bottom: 0.2rem;">Total Estimasi Anggaran</span>${formatRupiah(total)}`)
    }

    // 2. Render summary table
    const tableBody = document.getElementById('budget-table-body')
    if (tableBody) {
        tableBody.innerHTML = ''
        categories.forEach((c, idx) => {
            const color = CHART_COLORS[idx % CHART_COLORS.length]
            const percentage = total > 0 ? ((c.amount / total) * 100).toFixed(1) : 0

            const tr = document.createElement('tr')
            tr.innerHTML = window.DOMPurify.sanitize(`
                <td>
                    <div class="budget-category-label">
                        <span class="budget-category-dot" style="background: ${color}"></span>
                        <span>${c.name}</span>
                    </div>
                    <div class="budget-table-bar-container">
                        <div class="budget-table-bar" style="width: ${percentage}%; background: ${color};"></div>
                    </div>
                </td>
                <td><strong>${formatRupiah(c.amount)}</strong></td>
                <td style="color: var(--muted); font-weight: 600; text-align: right;">${percentage}%</td>
            `)
            tableBody.appendChild(tr)
        })
    }

    // 3. Configure Chart.js options
    const ctx = canvas.getContext('2d')
    budgetChartInstance = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: amounts,
                backgroundColor: bgColors,
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    display: false // We use custom interactive table legend instead
                },
                tooltip: {
                    backgroundColor: 'rgba(5, 46, 51, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    titleFont: { family: 'Source Sans 3', size: 13, weight: 'bold' },
                    bodyFont: { family: 'Source Sans 3', size: 14 },
                    padding: 12,
                    cornerRadius: 8,
                    borderColor: 'rgba(212, 160, 23, 0.4)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            const val = context.raw || 0
                            const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : 0
                            return ` ${context.label}: ${formatRupiah(val)} (${percentage}%)`
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 800,
                easing: 'easeOutQuart'
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw: function (chart) {
                const width = chart.width
                const height = chart.height
                const ctx = chart.ctx

                ctx.restore()
                ctx.font = 'bold 15px "Source Sans 3"'
                ctx.textBaseline = 'middle'
                ctx.fillStyle = '#8a7b6e'

                const text = 'Breakdown'
                const textX = Math.round((width - ctx.measureText(text).width) / 2)
                const textY = Math.round(height / 2 - 10)

                ctx.fillText(text, textX, textY)

                ctx.font = 'bold 17px "Source Sans 3"'
                ctx.fillStyle = '#052e33'
                const text2 = 'Anggaran'
                const textX2 = Math.round((width - ctx.measureText(text2).width) / 2)
                const textY2 = Math.round(height / 2 + 12)

                ctx.fillText(text2, textX2, textY2)
                ctx.save()
            }
        }]
    })
}




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

// ══════════════════════════════════════════════════════════════
//  NEARBY DISCOVERY (Overpass API)
// ══════════════════════════════════════════════════════════════
window.discoverNearby = async function(type) {
    if (!leafletMap) return;

    if (leafletMap.getZoom() < 13) {
        showToast('Area peta terlalu luas. Silakan zoom in (perbesar) peta terlebih dahulu.', 'warning');
        return;
    }

    const bounds = leafletMap.getBounds();
    const s = bounds.getSouth();
    const w = bounds.getWest();
    const n = bounds.getNorth();
    const e = bounds.getEast();

    let overpassQuery = '';
    let iconName = '';
    let color = '';

    if (type === 'hotel') {
        overpassQuery = `node["tourism"="hotel"](${s},${w},${n},${e});node["tourism"="guest_house"](${s},${w},${n},${e});`;
        iconName = 'hotel';
        color = '#3b82f6';
    } else if (type === 'restaurant') {
        overpassQuery = `node["amenity"~"restaurant|cafe|fast_food|food_court"](${s},${w},${n},${e});`;
        iconName = 'restaurant';
        color = '#f59e0b';
    } else if (type === 'atm') {
        overpassQuery = `node["amenity"~"atm|bank"](${s},${w},${n},${e});`;
        iconName = 'atm';
        color = '#10b981';
    } else if (type === 'fuel') {
        overpassQuery = `node["amenity"="fuel"](${s},${w},${n},${e});`;
        iconName = 'local_gas_station';
        color = '#ef4444';
    }

    if (!overpassQuery) return;

    const queryStr = `[out:json][timeout:10];(${overpassQuery});out;`;
    const queryUrl = `https://overpass-api.de/api/interpreter`;
    
    document.getElementById('discovery-loading').classList.remove('hidden');
    
    // Matikan tombol saat loading
    const btns = document.querySelectorAll('#map-discovery-buttons button');
    btns.forEach(btn => btn.disabled = true);

    try {
        const res = await fetch(queryUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: 'data=' + encodeURIComponent(queryStr)
        });
        
        if (!res.ok) {
            if (res.status === 429) throw new Error('429');
            if (res.status === 504) throw new Error('504');
            throw new Error('Overpass API error');
        }
        
        const data = await res.json();
        
        clearDiscovery(); // Hapus markah lama sebelum menampilkan yang baru
        discoveryLayerGroup = L.layerGroup().addTo(leafletMap);

        const nodes = data.elements.filter(el => el.type === 'node' && el.lat && el.lon);
        nodes.forEach(el => {
            const name = el.tags?.name || 'Tidak diketahui';
            const divIcon = L.divIcon({
                className: 'custom-map-marker',
                html: `
                    <div style="background:${color}; width:28px; height:28px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                        <span class="material-symbols-outlined" style="font-size:16px; color:#fff;">${iconName}</span>
                    </div>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });

            L.marker([el.lat, el.lon], { icon: divIcon })
                .addTo(discoveryLayerGroup)
                .bindPopup(window.DOMPurify.sanitize(`<strong>${name}</strong><br><span style="font-size:12px; color:#666;">Lokasi dari OpenStreetMap</span>`), { className: 'leaflet-popup-custom', maxWidth: 200 });
        });

        document.getElementById('btn-clear-discovery').classList.remove('hidden');
        if (nodes.length === 0) {
            showToast('Tidak ada tempat ditemukan di area yang terlihat di peta.', 'info');
        } else {
            showToast(`Menampilkan ${nodes.length} lokasi ${type} di peta.`, 'success');
        }
    } catch (err) {
        if (err.message === '429') {
            showToast('Server pencarian sibuk (Rate Limit). Harap tunggu beberapa detik lalu coba lagi.', 'error');
        } else if (err.message === '504') {
            showToast('Area terlalu luas atau server lambat (Timeout). Silakan perbesar (zoom in) peta lalu coba lagi.', 'error');
        } else {
            showToast('Gagal mencari lokasi sekitar. Silakan coba lagi.', 'error');
        }
    } finally {
        document.getElementById('discovery-loading').classList.add('hidden');
        btns.forEach(btn => btn.disabled = false);
    }
}

window.clearDiscovery = function() {
    if (discoveryLayerGroup && leafletMap) {
        leafletMap.removeLayer(discoveryLayerGroup);
        discoveryLayerGroup = null;
    }
    document.getElementById('btn-clear-discovery').classList.add('hidden');
}
