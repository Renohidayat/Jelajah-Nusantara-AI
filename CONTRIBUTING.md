# Contributing to Jelajah Nusantara

Terima kasih telah tertarik untuk berkontribusi pada Jelajah Nusantara! Kami sangat menghargai setiap kontribusi dari komunitas. Berikut adalah panduan untuk berkontribusi.

## 📋 Code of Conduct

Proyek ini mematuhi Code of Conduct. Dengan berpartisipasi, Anda diharapkan untuk mematuhi standar ini.

---

## 🚀 Cara Berkontribusi

### 1. Report Bugs

Jika Anda menemukan bug, silakan buat issue baru dengan informasi:

**Issue Template:**
```markdown
**Deskripsi Bug:**
Penjelasan singkat tentang bug

**Steps to Reproduce:**
1. Langkah pertama
2. Langkah kedua
3. ...

**Expected Behavior:**
Apa yang seharusnya terjadi

**Actual Behavior:**
Apa yang benar-benar terjadi

**Screenshots/Logs:**
Jika relevan, tambahkan screenshot atau error log

**Environment:**
- OS: Windows/Mac/Linux
- Node Version: 18.x
- Browser: Chrome/Firefox/Safari
```

### 2. Suggest Enhancements

Ingin menambah fitur baru? Buat issue dengan label `enhancement`:

**Enhancement Template:**
```markdown
**Deskripsi Fitur:**
Penjelasan detail tentang fitur yang diinginkan

**Use Case:**
Kapan fitur ini akan berguna?

**Implementation Ideas:**
Jika ada, bagikan ide implementasi

**Related Issues:**
Referensi issue yang terkait (jika ada)
```

### 3. Submit Pull Request

**Step-by-Step:**

1. **Fork Repository**
   ```bash
   git clone https://github.com/yourusername/Jelajah-Nusantara-AI.git
   cd Jelajah-Nusantara-AI
   ```

2. **Buat Branch Feature**
   ```bash
   git checkout -b feature/descriptive-name
   # atau untuk bug fix:
   git checkout -b fix/bug-description
   ```

3. **Buat Perubahan**
   - Ikuti style guide (lihat di bawah)
   - Commit dengan pesan yang jelas
   - Pastikan kode dapat dijalankan

4. **Test Perubahan**
   ```bash
   # Backend testing
   cd backend && npm run dev
   
   # Frontend testing
   cd frontend && npm run dev
   ```

5. **Push Branch**
   ```bash
   git push origin feature/descriptive-name
   ```

6. **Buat Pull Request**
   - Jelaskan apa yang diubah
   - Reference issue yang terkait
   - Tunggu review

---

## 📝 Style Guide

### JavaScript/ES6

```javascript
// ✅ Good - Gunakan const & let, hindari var
const config = {
  apiUrl: process.env.API_BASE,
  timeout: 5000
}

let counter = 0

// ✅ Good - Gunakan arrow functions
const handleClick = () => {
  console.log('Clicked!')
}

// ✅ Good - Gunakan template literals
const message = `Hello, ${user.name}!`

// ✅ Good - Gunakan async/await
async function fetchData() {
  try {
    const response = await fetch('/api/data')
    return await response.json()
  } catch (err) {
    console.error('Fetch failed:', err)
  }
}

// ❌ Avoid - Jangan gunakan var
var oldWay = 'outdated'

// ❌ Avoid - Jangan gunakan callback hell
function callback1(err, data) {
  if (err) return console.error(err)
  function callback2(err, data) {
    // deeply nested...
  }
}
```

### CSS

```css
/* ✅ Good - Gunakan BEM naming convention */
.card {
  display: flex;
  gap: var(--sp-md);
}

.card__header {
  font-weight: 600;
}

.card__header--active {
  color: var(--color-primary);
}

/* ✅ Good - Gunakan CSS variables */
:root {
  --color-primary: #1976d2;
  --sp-md: 16px;
}

/* ❌ Avoid - Hardcoded values */
.card {
  padding: 16px;
  color: #1976d2;
}
```

### Comments

```javascript
// ✅ Good - Comments yang bermakna
// Validate email format sebelum API call
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ✅ Good - TODO untuk pekerjaan yang belum selesai
// TODO: Implement cache layer untuk performa

// ❌ Avoid - Obvious comments
const count = 1 // Set count to 1
```

---

## 🔄 Git Workflow

### Commit Messages

Gunakan format yang jelas dan deskriptif:

```bash
# Format: [type]: [description]
git commit -m "feat: add AI budget analysis feature"
git commit -m "fix: resolve CORS issue on production"
git commit -m "docs: update README with setup instructions"
git commit -m "style: format code according to style guide"
git commit -m "refactor: simplify Firebase authentication logic"
git commit -m "test: add unit tests for budget calculator"
git commit -m "chore: update dependencies"
```

**Types:**
- `feat` - Fitur baru
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code formatting
- `refactor` - Code restructuring (tanpa mengubah fungsionalitas)
- `test` - Add atau update tests
- `chore` - Dependency updates, etc.

### Branch Naming

```bash
feature/add-social-sharing
fix/firebase-connection-error
docs/api-documentation
refactor/component-structure
```

---

## ✅ Checklist Sebelum Submit PR

- [ ] Saya telah fork repository
- [ ] Saya membuat branch dengan nama yang deskriptif
- [ ] Saya mengikuti style guide project
- [ ] Saya telah test perubahan secara lokal
- [ ] Saya telah menambahkan comments untuk kode yang kompleks
- [ ] Saya telah update dokumentasi jika diperlukan
- [ ] Saya telah mengecek apakah ada conflicts dengan main branch
- [ ] Saya telah memberikan deskripsi detail di PR

---

## 🧪 Testing

Sebelum submit PR, pastikan:

1. **No Console Errors:**
   ```bash
   # Check DevTools console
   ```

2. **Test di berbagai browser:**
   - Chrome
   - Firefox
   - Safari
   - Mobile browsers

3. **Test responsiveness:**
   - Desktop (1920px)
   - Tablet (768px)
   - Mobile (375px)

4. **Test fitur yang diubah:**
   - Normal flow
   - Error cases
   - Edge cases

---

## 📚 Development Setup

### Requirements
- Node.js 18+
- npm 9+ atau yarn/pnpm
- Git

### First Time Setup

```bash
# Clone repository
git clone https://github.com/yourusername/Jelajah-Nusantara-AI.git
cd Jelajah-Nusantara-AI

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Setup .env files
# Lihat README.md untuk environment variables

# Run development servers
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

---

## 🎯 Project Goals

Kami sedang fokus pada:
- ✅ Meningkatkan AI integration
- ✅ Mobile responsiveness
- ✅ User experience
- ✅ Performance optimization
- ✅ Community features

Silakan contributing untuk goals tersebut!

---

## 📞 Butuh Bantuan?

- Baca [README.md](README.md) untuk dokumentasi lengkap
- Buka [GitHub Issues](https://github.com/yourusername/Jelajah-Nusantara-AI/issues)
- Diskusi di [GitHub Discussions](https://github.com/yourusername/Jelajah-Nusantara-AI/discussions)
- Email: your.email@example.com

---

## 🙏 Terima Kasih!

Kontribusi Anda membuat Jelajah Nusantara lebih baik untuk semua traveler Indonesia!

**Happy Contributing! 🚀**

---

**Last Updated**: June 2024
