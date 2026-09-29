// ════════════════════════════════════════════════════════════════
//  Jelajah Nusantara — Frontend Application
//  Stack  : Vanilla ES6 + Firebase SDK v10 (modular) + marked.js
//  Pattern: Config-first init → Auth → UI → API calls
// ════════════════════════════════════════════════════════════════

import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Configure DOMPurify for external links
DOMPurify.addHook('afterSanitizeAttributes', function(node) {
    if (node.nodeName && node.nodeName.toLowerCase() === 'a') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    }
});
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

// ── BUDGET STATE ───────────────────────────────
let budgetData = null          // AI budget breakdown data
let budgetChartInstance = null // Chart.js instance to avoid memory leaks / redraw bugs

// ── LEAFLET LOADER ─────────────────────────────
// Garantikan window.L tersedia sebelum render peta, tanpa peduli kecepatan CDN
let _leafletLoadPromise = null
function loadLeaflet() {
    if (_leafletLoadPromise) return _leafletLoadPromise
    _leafletLoadPromise = new Promise((resolve, reject) => {
        if (window.L) return resolve(window.L)          // Sudah dimuat oleh HTML <script>

        // Belum ada — load secara dinamis
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)

        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.onload = () => resolve(window.L)
        script.onerror = () => reject(new Error('Gagal memuat Leaflet.js dari CDN.'))
        document.body.appendChild(script)
    })
    return _leafletLoadPromise
}

// Markdown renderer config
marked.setOptions({
    breaks: true,
    gfm: true,
})

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
        console.error('❌ Boot error:', err)
        showToast('Gagal terhubung ke server. Coba refresh halaman.', 'error')
    }
}

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════

window.handleLogin = async function () {
    if (!auth) return showToast('Aplikasi belum siap. Coba refresh.', 'error')
    try {
        const provider = new GoogleAuthProvider()
        provider.addScope('profile')
        provider.addScope('email')
        // Gunakan popup — tidak redirect keluar halaman, tidak ada race condition
        const result = await signInWithPopup(auth, provider)
        // onAuthStateChanged akan otomatis update UI
        showToast(`Selamat datang, ${result.user.displayName?.split(' ')[0] || 'Traveler'}! 🎉`, 'success')
    } catch (err) {
        console.error('Login error:', err)
        // Abaikan error jika user menutup popup sendiri
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

window.handleLogout = async function () {
    try {
        await signOut(auth)
        currentUser = null
        updateAuthUI(null)
        showToast('Kamu berhasil keluar. Sampai jumpa! 👋')
    } catch (err) {
        showToast('Gagal keluar. Coba lagi.', 'error')
    }
}
function updateAuthUI(user) {
    const btnLogin = document.getElementById('btn-login')
    const userInfo = document.getElementById('user-info')
    const userAvatar = document.getElementById('user-avatar')
    const userName = document.getElementById('user-name')

    // Elemen Tambahan: Target UI di dalam Hamburger/Mobile Menu
    const mobileBtnLogin = document.getElementById('mobile-btn-login')
    const mobileUserProfile = document.getElementById('mobile-user-profile')
    const mobileUserAvatar = document.getElementById('mobile-user-avatar')
    const mobileUserName = document.getElementById('mobile-user-name')

    if (user) {
        // Update UI Desktop (Gunakan opsional chaining/kondisional agar tidak crash jika null)
        if (btnLogin) btnLogin.classList.add('hidden')
        if (userInfo) userInfo.classList.remove('hidden')
        if (userAvatar) {
            userAvatar.src = user.photoURL || ''
            userAvatar.onerror = () => { userAvatar.style.display = 'none' }
        }
        if (userName) userName.textContent = user.displayName || user.email || 'Traveler'

        // Update UI Mobile Menu
        if (mobileBtnLogin) mobileBtnLogin.classList.add('hidden')
        if (mobileUserProfile) mobileUserProfile.classList.remove('hidden')
        if (mobileUserAvatar) {
            mobileUserAvatar.src = user.photoURL || ''
            mobileUserAvatar.onerror = () => { mobileUserAvatar.style.display = 'none' }
        }
        if (mobileUserName) mobileUserName.textContent = user.displayName || user.email || 'Traveler'
    } else {
        // Update UI Desktop
        if (btnLogin) btnLogin.classList.remove('hidden')
        if (userInfo) userInfo.classList.add('hidden')

        // Update UI Mobile Menu
        if (mobileBtnLogin) mobileBtnLogin.classList.remove('hidden')
        if (mobileUserProfile) mobileUserProfile.classList.add('hidden')
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
}

window.showTab = function (tab) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'))
    document.getElementById(`tab-${tab}`)?.classList.add('active')

    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active')
        p.classList.add('hidden')
    })
    const page = document.getElementById(`page-${tab}`)
    if (page) {
        page.classList.remove('hidden')
        page.classList.add('active')
    }

    if (tab === 'mytrips') loadMyTrips()
    if (tab === 'community') loadCommunity()

    // Close mobile menu when tab is clicked
    const mobileMenu = document.getElementById('mobile-menu')
    const hamburger = document.getElementById('hamburger-menu')
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden')
        hamburger?.classList.remove('active')
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    const duration = document.getElementById('duration').value
    const budget = document.getElementById('budget').value
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

        let data
        const text = await resp.text()
        try {
            data = JSON.parse(text)
        } catch {
            throw new Error(!resp.ok ? `Server sedang memproses atau sibuk (HTTP ${resp.status}). Coba beberapa saat lagi.` : 'Respon server tidak valid.')
        }
        if (!resp.ok) throw new Error(data.error || 'Gagal menghasilkan itinerary.')

        lastResult = { itineraryText: data.itineraryText, tripData: data.tripData, budgetBreakdown: data.budgetBreakdown }
        showResult(data.itineraryText, data.tripData, data.budgetBreakdown)
        showToast('✨ Itinerary berhasil dibuat!', 'success')
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

        let data
        const text = await resp.text()
        try {
            data = JSON.parse(text)
        } catch {
            throw new Error(!resp.ok ? `Server sedang memproses atau sibuk (HTTP ${resp.status}). Coba beberapa saat lagi.` : 'Respon server tidak valid.')
        }
        if (!resp.ok) throw new Error(data.error || 'Gagal menganalisis gambar.')

        lastResult = { itineraryText: data.itineraryText, tripData: data.tripData, budgetBreakdown: data.budgetBreakdown }
        showResult(data.itineraryText, data.tripData, data.budgetBreakdown)
        showToast('📸 Foto berhasil dianalisis!', 'success')
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
function showResult(itineraryText, tripData, budgetBreakdown) {
    const section = document.getElementById('result-section')
    const body = document.getElementById('result-body')
    const meta = document.getElementById('result-meta')

    body.innerHTML = DOMPurify.sanitize(marked.parse(itineraryText))

    const parts = []
    if (tripData.destination) parts.push(`🏝️ <strong>${tripData.destination}</strong>`)
    if (tripData.duration) parts.push(`📅 ${tripData.duration} hari`)
    if (tripData.budget) parts.push(`💰 ${tripData.budget}`)
    if (tripData.style) parts.push(`🧳 ${tripData.style}`)
    meta.innerHTML = DOMPurify.sanitize(parts.join(' &nbsp;·&nbsp; '))

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
    btnSave.textContent = '💾 Menyimpan...'

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

        showToast('✅ Itinerary berhasil disimpan!', 'success')
        btnSave.textContent = '✅ Tersimpan'
        setTimeout(() => {
            btnSave.disabled = false
            btnSave.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg> Simpan Itinerary`
        }, 3000)
    } catch (err) {
        showToast(err.message, 'error')
        btnSave.disabled = false
        btnSave.innerHTML = '💾 Simpan Itinerary'
    }
}

// ══════════════════════════════════════════════════════════════
//  SHARE
// ══════════════════════════════════════════════════════════════
window.shareItinerary = async function () {
    if (!lastResult) return

    const shareText = `✈️ Cek itinerary perjalanan ke ${lastResult.tripData?.destination || 'Indonesia'} yang aku buat di Jelajah Nusantara!\n\n${window.location.href}`

    if (navigator.share) {
        try {
            await navigator.share({ title: 'Jelajah Nusantara', text: shareText })
        } catch { }
    } else {
        await navigator.clipboard.writeText(shareText)
        showToast('📋 Link berhasil disalin!', 'success')
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
            empty.classList.remove('hidden')
            return
        }

        data.trips.forEach((trip, i) => {
            const card = createTripCard(trip, { showActions: true, delay: i * 0.05 })
            grid.appendChild(card)
        })
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
            empty.classList.remove('hidden')
            return
        }

        data.trips.forEach((trip, i) => {
            const card = createTripCard(trip, { showActions: false, delay: i * 0.04 })
            grid.appendChild(card)
        })
    } catch (err) {
        loading.classList.add('hidden')
        showToast('Gagal memuat komunitas: ' + err.message, 'error')
    }
}

// ══════════════════════════════════════════════════════════════
//  TRIP CARD RENDERER
// ══════════════════════════════════════════════════════════════
const DESTINATION_EMOJI = {
    bali: '🌺', lombok: '🏖️', raja: '🐠', komodo: '🦎',
    labuan: '🏊', bromo: '🌋', semeru: '⛰️', yogya: '🏛️',
    jogja: '🏛️', solo: '🎭', semarang: '🏙️', surabaya: '🌆',
    jakarta: '🏙️', bandung: '🌿', medan: '🍜', manado: '🐟',
    makassar: '🌊', flores: '🌸', toraja: '⚰️', wakatobi: '🐙',
    default: '✈️',
}

function getDestEmoji(destination = '') {
    const lower = destination.toLowerCase()
    for (const [key, emoji] of Object.entries(DESTINATION_EMOJI)) {
        if (key !== 'default' && lower.includes(key)) return emoji
    }
    return DESTINATION_EMOJI.default
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
    const emoji = getDestEmoji(dest)
    const preview = trip.itineraryPreview || trip.itineraryText?.substring(0, 280) + '...' || ''
    const date = formatDate(trip.createdAt)
    const userName = trip.userName || 'Traveler'
    const isPublic = trip.isPublic
    const likes = trip.likes || 0

    let avatarHTML = ''
    if (trip.userPhoto) {
        avatarHTML = `<img src="${trip.userPhoto}" alt="${userName}" loading="lazy"
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
          ${isPublic ? '🔒 Jadikan Privat' : '🌐 Jadikan Publik'}
        </button>
        <button class="btn-card-action btn-card-delete"
          onclick="event.stopPropagation(); deleteTrip('${trip.id}', this.closest('.trip-card'))">
          🗑️ Hapus
        </button>
      </div>`
    }

    card.innerHTML = DOMPurify.sanitize(`
    <div class="trip-card-banner">
      <div class="trip-card-banner-inner">${emoji}</div>
      <div class="trip-card-dest">${dest}</div>
    </div>
    <div class="trip-card-body">
      <div class="trip-card-meta">
        ${duration ? `<span class="trip-badge">📅 ${duration} hari</span>` : ''}
        ${style ? `<span class="trip-badge">🧳 ${style.split(' ')[0]}</span>` : ''}
        ${budget ? `<span class="trip-badge">💰 ${budget.split(' ')[0]}</span>` : ''}
        ${isPublic ? `<span class="trip-badge" style="background:#d4f1f5;color:#0d5c67">🌐 Publik</span>` : ''}
      </div>
      <p class="trip-card-preview">${preview.replace(/[#*\`_\[\]]/g, '')}</p>
      <div class="trip-card-footer">
        <div class="trip-author">
          ${avatarHTML}
          <span>${userName} · ${date}</span>
        </div>
        <div class="trip-stats">
          <span class="trip-stat" onclick="event.stopPropagation(); likeTrip('${trip.id}', this)">
            ❤️ ${likes}
          </span>
        </div>
      </div>
      ${actionsHTML}
    </div>`)

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
    const duration = trip.tripData?.duration
    const tripStyle = trip.tripData?.style
    const budget = trip.tripData?.budget
    const emoji = getDestEmoji(dest)
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

    body.innerHTML = DOMPurify.sanitize(`
        <div class="modal-trip-header">
            <div class="modal-trip-banner">
                <span class="modal-trip-emoji">${emoji}</span>
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
        </div>`)

    overlay.classList.remove('hidden')

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
        contentEl.innerHTML = DOMPurify.sanitize(`<div class="modal-markdown">${marked.parse(itineraryText || '*Konten tidak tersedia.*')}</div>`)
    }
}

window.closeModal = function () {
    document.getElementById('modal-overlay').classList.add('hidden')
    document.getElementById('modal-body').innerHTML = ''
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
        btn.textContent = `❤️ ${newCount}`
        btn.style.color = 'var(--coral-500)'
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
        showToast('🗑️ Itinerary berhasil dihapus.', 'success')
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

        btn.textContent = newState ? '🔒 Jadikan Privat' : '🌐 Jadikan Publik'
        btn.setAttribute('onclick',
            `event.stopPropagation(); togglePublic('${id}', ${!newState}, this)`)

        const metaEl = btn.closest('.trip-card-body')?.querySelector('.trip-card-meta')
        if (metaEl) {
            const existing = metaEl.querySelector('[data-public-badge]')
            if (newState) {
                if (!existing) {
                    const badge = document.createElement('span')
                    badge.className = 'trip-badge'
                    badge.setAttribute('data-public-badge', '1')
                    badge.style.cssText = 'background:#d4f1f5;color:#0d5c67'
                    badge.textContent = '🌐 Publik'
                    metaEl.appendChild(badge)
                }
            } else {
                existing?.remove()
            }
        }

        showToast(newState ? '🌐 Itinerary kini publik!' : '🔒 Itinerary kini privat.', 'success')
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
    navbar.style.boxShadow = window.scrollY > 20
        ? '0 4px 30px rgba(5,46,51,0.4)'
        : '0 2px 24px rgba(5,46,51,0.3)'
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

const TIME_ICONS = { 'Pagi': '🌅', 'Siang': '☀️', 'Malam': '🌙' }

function getDayColor(dayIndex) {
    return MAP_DAY_COLORS[dayIndex % MAP_DAY_COLORS.length]
}

/** Reset map state when a new itinerary is generated */
function resetMapState() {
    mapDays = null
    mapExtractAborted = false

    // Destroy previous Leaflet instance
    if (leafletMap) {
        leafletMap.remove()
        leafletMap = null
    }

    // Reset UI states
    document.getElementById('route-map')?.classList.add('hidden')
    document.getElementById('map-legend')?.classList.add('hidden')
    document.getElementById('map-loading-state')?.classList.add('hidden')
    document.getElementById('map-error-state')?.classList.add('hidden')
    document.getElementById('map-legend-days').innerHTML = ''
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
                updateMapLoadingText(`⏳ Server AI sibuk, mencoba lagi (${attempt}/${MAX_CLIENT_RETRIES})…`)
                await new Promise(r => setTimeout(r, waitMs))
                continue
            }

            if (!resp.ok || !data.days) {
                throw new Error(data.error || 'Ekstraksi gagal')
            }

            mapDays = data.days

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
                updateMapLoadingText(`⏳ Mencoba ulang (${attempt}/${MAX_CLIENT_RETRIES})…`)
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
    const legendDays = document.getElementById('map-legend-days')

    // Show map container
    mapContainer.classList.remove('hidden')
    legendContainer.classList.remove('hidden')
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

    days.forEach((day, dayIndex) => {
        const color = getDayColor(dayIndex)
        const dayLatLngs = []

        // ── Render markers for each location ──
        day.locations.forEach((loc, locIndex) => {
            const pos = [loc.lat, loc.lng]
            allLatLngs.push(pos)
            dayLatLngs.push(pos)

            const markerLabel = `${dayIndex + 1}.${locIndex + 1}`
            const icon = buildMarkerIcon(color, markerLabel, L)
            const timeIcon = TIME_ICONS[loc.time] || '📍'

            const popupContent = DOMPurify.sanitize(`
                <div class="map-popup">
                    <div class="map-popup-header" style="border-left: 3px solid ${color}">
                        <span class="map-popup-day">Hari ${day.day} · ${timeIcon} ${loc.time || ''}</span>
                        <strong class="map-popup-name">${loc.name}</strong>
                    </div>
                    ${loc.description ? `<p class="map-popup-desc">${loc.description}</p>` : ''}
                </div>`)

            L.marker(pos, { icon })
                .addTo(leafletMap)
                .bindPopup(popupContent, { maxWidth: 260, className: 'leaflet-popup-custom' })
        })

        // ── Draw polyline connecting this day's locations ──
        if (dayLatLngs.length > 1) {
            L.polyline(dayLatLngs, {
                color,
                weight: 3,
                opacity: 0.75,
                dashArray: '6, 8',
                lineJoin: 'round',
            }).addTo(leafletMap)
        }

        // ── Build legend entry ──
        const legendItem = document.createElement('div')
        legendItem.className = 'map-legend-day'
        legendItem.innerHTML = DOMPurify.sanitize(`
            <span class="map-legend-dot" style="background:${color}"></span>
            <span class="map-legend-label">
                <strong>Hari ${day.day}</strong>${day.theme ? ` — ${day.theme}` : ''}
            </span>
            <span class="map-legend-count">${day.locations.length} lokasi</span>`)
        legendDays.appendChild(legendItem)
    })

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
        }).addTo(leafletMap).bindTooltip('🚀 Mulai', { permanent: true, direction: 'top', className: 'map-start-tooltip' })
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
function renderBudgetChart(data) {
    if (!window.Chart) {
        console.warn('Chart.js is not loaded yet.')
        return
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
        totalDisplay.innerHTML = DOMPurify.sanitize(`<span style="font-size: 0.9rem; font-family: var(--font-body); display: block; color: var(--muted); font-weight: 600; margin-bottom: 0.2rem;">Total Estimasi Anggaran</span>${formatRupiah(total)}`)
    }

    // 2. Render summary table
    const tableBody = document.getElementById('budget-table-body')
    if (tableBody) {
        tableBody.innerHTML = ''
        categories.forEach((c, idx) => {
            const color = CHART_COLORS[idx % CHART_COLORS.length]
            const percentage = total > 0 ? ((c.amount / total) * 100).toFixed(1) : 0

            const tr = document.createElement('tr')
            tr.innerHTML = DOMPurify.sanitize(`
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