# AGENTS.md — Aturan Kerja Repositori Jelajah Nusantara

Berlaku untuk semua kontributor, manusia maupun agen AI (Antigravity dan sejenisnya).
Baca seluruh file ini sebelum mengubah apa pun. Jika ada `GEMINI.md` di root dan isinya
bertentangan dengan file ini, `GEMINI.md` yang berlaku.

---

## 0. Aturan Emas

1. **Tidak ada perubahan tanpa issue.** Sekecil apa pun, termasuk typo.
2. **Satu issue = satu branch = satu PR.**
3. **Commit kecil dan sering**, memakai format Conventional Commits (Bagian 4).
4. **Tidak pernah commit langsung ke `main`.**
5. **Merge memakai "Rebase and merge", bukan squash**, supaya seluruh commit tetap terlihat di riwayat.
6. **Issue baru dianggap selesai** setelah PR ter-merge dan komentar Penyelesaian ditulis (Bagian 2.3).
7. **Jangan mengarang** nomor issue, hash commit, atau hasil pengujian. Tulis apa yang benar-benar terjadi.

---

## 1. Alur Kerja Wajib per Perubahan

1. Sinkronkan: `git switch main && git pull --ff-only`
2. Buat issue (Bagian 2). Catat nomornya.
3. Buat branch dari `main` (Bagian 3): `git switch -c feat/7-navbar-bersama`
4. Kerjakan dalam langkah kecil. Setiap langkah selesai, langsung commit (Bagian 4).
5. Push setiap 3 sampai 5 commit dan di akhir sesi kerja: `git push -u origin <branch>`
6. Buka **Draft PR** sejak push pertama (Bagian 5).
7. Verifikasi sesuai Definition of Done (Bagian 6).
8. Tandai PR siap direview, lalu **Rebase and merge**. Hapus branch.
9. Tulis komentar **Penyelesaian** pada issue dan pastikan issue tertutup.

Membuat issue, PR, dan komentar memakai GitHub CLI (`gh`). Jika `gh` belum terpasang atau belum
login, **berhenti sebelum mengubah kode**, tampilkan draf issue lengkap di chat, dan minta
pemilik repo membuatnya atau menjalankan `gh auth login`. Lanjutkan setelah nomor issue nyata diberikan.

---

## 2. Issue

### 2.1 Judul dan label

Judul memakai format yang sama dengan commit: `type(scope): deskripsi singkat`

Contoh: `feat(nav): navbar dan footer bersama untuk semua halaman`

Setiap issue wajib punya minimal **satu label `type:*`** dan **satu label `area:*`**.
Label lengkap ada di Lampiran A.

### 2.2 Templat isi issue

Isi issue ditulis dalam Bahasa Indonesia dengan struktur berikut:

```md
## Latar belakang
Kondisi sekarang dan mengapa ini masalah. Sertakan screenshot atau potongan kode bila ada.

## Solusi yang diusulkan
Pendekatan yang akan dipakai, dalam beberapa kalimat atau poin.

## Lingkup
- Termasuk: ...
- Tidak termasuk: ...

## Kriteria selesai
- [ ] Kriteria yang bisa diperiksa satu per satu
- [ ] Tampilan sudah dicek di 1440, 768, dan 390 px (untuk perubahan UI)
- [ ] `npm run build` lolos

## Catatan
Referensi, tautan issue terkait, atau risiko. Hapus bagian ini bila kosong.
```

Untuk perubahan sangat kecil (typo, satu baris CSS) boleh memakai **issue ringkas**: judul yang jelas,
dua kalimat latar belakang, dan minimal satu kriteria selesai. Issue tetap wajib ada.

### 2.3 Komentar Penyelesaian

Setelah PR ter-merge, tulis komentar berikut pada issue (`gh issue comment <n> --body-file <file>`).
Daftar commit diambil dengan `gh pr view <n> --json commits --jq '.commits[].messageHeadline'`.

```md
## Penyelesaian
**PR:** #<nomor> · **Branch:** `<nama-branch>`

### Yang dikerjakan
- Ringkasan perubahan dalam poin singkat

### Commit
- type(scope): subject commit 1
- type(scope): subject commit 2

### Sebelum dan sesudah
Screenshot atau penjelasan singkat (untuk perubahan UI: 1440, 768, 390 px).

### Verifikasi
- [x] `npm run build` lolos
- [x] Kriteria selesai pada issue terpenuhi
- [ ] Yang belum diuji dan alasannya (tulis jujur, hapus baris bila kosong)

### Catatan dan tindak lanjut
Temuan di luar lingkup dan nomor issue baru yang dibuat untuknya.
```

### 2.4 Epic

Pekerjaan besar (misalnya redesign UI) dibuat sebagai satu issue **epic** berisi daftar tugas:

```md
- [ ] #7 feat(nav): navbar dan footer bersama
- [ ] #8 refactor(static-pages): pindahkan CSS inline
```

Setiap butir adalah issue tersendiri yang dikerjakan lewat alur Bagian 1. Centang butir epic saat issue-nya selesai.

---

## 3. Branch

Format: `<type>/<nomor-issue>-<slug-singkat>`, huruf kecil, kata dipisah tanda hubung.

- `feat/7-navbar-bersama`
- `fix/12-spinner-modal`
- `style/15-kartu-perjalanan`

Aturan:
- Selalu dibuat dari `main` yang terbaru.
- Umur branch sependek mungkin. Jika sudah lebih dari beberapa hari, rebase ke `main`.
- Setelah merge, hapus branch lokal dan remote.

---

## 4. Commit

### 4.1 Format

Conventional Commits 1.0.0:

```
<type>(<scope>): <subject>

<body opsional>

<footer opsional>
```

- **type** dan **scope**: huruf kecil, bahasa Inggris, dari daftar di bawah.
- **subject**: Bahasa Indonesia, kata kerja perintah (tambahkan, perbaiki, ganti, pindahkan, hapus, rapikan),
  huruf awal kecil, tanpa titik di akhir, maksimal 72 karakter.
- **body**: jelaskan *apa* dan *mengapa* (bukan *bagaimana*), dibungkus sekitar 72 karakter per baris.
  Wajib bila alasan perubahan tidak jelas dari subject.
- **footer**: `Refs #7` pada commit di branch. `Closes #7` ditulis di deskripsi PR, bukan di commit.
- Perubahan yang merusak kompatibilitas: tambahkan `!` setelah scope dan footer `BREAKING CHANGE: ...`.

Tidak boleh dicampur dalam satu commit: perubahan tampilan dan logika, perubahan fungsional dan
pemformatan, atau perubahan line ending (CRLF/LF) dengan perubahan lain.

### 4.2 Type

| Type | Dipakai untuk |
|---|---|
| `feat` | Kemampuan atau komponen baru yang terlihat pengguna |
| `fix` | Perbaikan bug, termasuk bug tampilan dan aksesibilitas |
| `style` | Perubahan tampilan murni (CSS, token, layout, tipografi) tanpa mengubah logika |
| `refactor` | Merapikan struktur kode tanpa mengubah perilaku |
| `perf` | Peningkatan performa |
| `docs` | Dokumentasi, komentar, README, copywriting halaman statis |
| `test` | Menambah atau memperbaiki pengujian |
| `build` | Vite, dependensi, `package.json`, `vercel.json` |
| `ci` | Workflow GitHub Actions |
| `chore` | Pemeliharaan lain (`.gitignore`, `.gitattributes`, formatting) |
| `revert` | Membatalkan commit sebelumnya |

### 4.3 Scope

`nav`, `footer`, `auth`, `planner`, `vision`, `result`, `map`, `budget`, `trips`, `community`, `modal`,
`toast`, `ui` (komponen dasar), `tokens`, `typography`, `icons`, `static-pages`, `a11y`, `build`, `deps`,
`repo`, `agents`. Scope baru boleh ditambah bila perlu, asal konsisten dan dicatat di sini.

### 4.4 Ukuran dan ritme commit

Riwayat commit yang banyak dan bermakna berasal dari langkah kecil yang nyata.

- **Satu commit = satu alasan perubahan.** Bila subject butuh kata "dan" untuk dua hal berbeda, pecah.
- Commit setiap kali satu langkah kecil selesai dan aplikasi masih bisa berjalan.
- Jika sudah sekitar 30 menit atau 3 file tanpa commit, berhenti dan commit sekarang.
- Patokan wajar: satu commit mengubah paling banyak sekitar 5 file dan 150 baris, kecuali pemindahan atau
  penggantian nama file yang mekanis. Issue biasa menghasilkan sekitar 3 sampai 15 commit.
- **Setiap commit harus menjaga aplikasi tetap bisa di-build.** Ini memudahkan `git bisect` dan revert.
- **Dilarang menggelembungkan riwayat:** tanpa commit kosong (`--allow-empty`), tanpa commit yang hanya
  mengubah spasi atau mengubah lalu mengembalikan, tanpa memecah satu perubahan utuh menjadi potongan tak bermakna.

### 4.5 Contoh

```
feat(nav): ekstrak navbar ke partial bersama
style(tokens): definisikan palet dan skala tipografi di :root
refactor(static-pages): pindahkan css inline ke style.css
fix(tokens): hapus referensi var(--rausch) yang tidak terdefinisi
style(trips): ganti banner ikon dengan cover foto destinasi
feat(modal): tambah focus trap dan atribut aria pada dialog
docs(static-pages): seragamkan sapaan menjadi "kamu"
```

Contoh dengan body:

```
fix(modal): kembalikan fokus ke kartu setelah dialog ditutup

Sebelumnya fokus hilang ke body sehingga pengguna keyboard harus
menekan Tab dari awal halaman setelah menutup popup.

Refs #18
```

### 4.6 Praktik saat commit

- Jangan `git add .` atau `git add -A` secara membabi buta. Tambahkan file tertentu atau pakai `git add -p`.
- Sebelum commit: `git status` dan `git diff --staged`. Pastikan hanya perubahan yang dimaksud yang ikut.
- Jangan commit: `node_modules/`, `dist/`, `.env*`, kunci atau token, file sementara, dan gambar mentah berukuran besar.
- Jangan gunakan `--no-verify`.
- Commit yang sudah di-push dan sudah dilihat orang lain tidak boleh di-amend atau di-rebase. Pada branch milik
  sendiri sebelum merge boleh, dengan `git push --force-with-lease` (bukan `--force`).

---

## 5. Pull Request

- Satu PR untuk satu issue. Judul memakai format commit: `type(scope): deskripsi`.
- Buka sebagai **Draft** sejak awal, ubah ke Ready setelah Definition of Done terpenuhi.
- Deskripsi PR:

```md
## Ringkasan
Apa yang berubah dan mengapa, dalam 2 sampai 4 kalimat.

Closes #<nomor-issue>

## Perubahan
- Poin perubahan utama

## Sebelum dan sesudah
Screenshot 1440, 768, dan 390 px (untuk perubahan UI).

## Cara menguji
1. Langkah yang bisa diulang oleh reviewer

## Checklist
- [ ] `npm run build` lolos
- [ ] Semua kriteria selesai pada issue terpenuhi
- [ ] Tidak ada perubahan di luar lingkup issue
- [ ] Tidak ada emoji, warna hex di luar token, atau style inline yang baru
```

- Jika Vercel membuat Preview Deployment, cantumkan tautannya.
- Ukuran PR ideal di bawah sekitar 400 baris diff. Bila lebih besar, pecah issue-nya.

---

## 6. Definition of Done

Sebuah issue selesai bila **semua** poin ini benar:

- Semua kriteria selesai di issue tercentang dan benar-benar terpenuhi.
- `npm run build` lolos tanpa error.
- Untuk perubahan UI: dicek pada 1440, 768, dan 390 px, navigasi keyboard berfungsi, focus ring terlihat.
- Tidak ada perubahan di luar lingkup issue.
- PR ter-merge dengan Rebase and merge, branch dihapus.
- Komentar Penyelesaian ditulis dan issue tertutup.

---

## 7. Merge dan Riwayat

- Strategi merge: **Rebase and merge**. Squash tidak dipakai karena akan meleburkan semua commit menjadi satu.
- Riwayat `main` harus linear. Tidak ada commit merge.
- Tidak ada force push ke `main`. Tidak ada penghapusan `main`.
- Tag rilis memakai Semantic Versioning (`v1.2.0`) dan dibuat dari `main`.

---

## 8. Aturan Tambahan untuk Agen AI

1. Sebelum menulis kode, pastikan ada issue nyata dengan nomor yang valid. Jika belum ada, buat dulu.
2. Untuk pekerjaan multi-issue (epic), buat semua issue-nya terlebih dulu, tampilkan daftarnya, dan minta
   persetujuan **satu kali**. Setelah itu kerjakan berurutan tanpa meminta izin per issue.
3. Tetap di dalam lingkup issue. Temuan lain (bug, ide, perapian) dicatat sebagai issue baru, bukan dikerjakan sekarang.
4. Jangan menggabungkan beberapa issue dalam satu branch atau satu PR.
5. Minta konfirmasi eksplisit sebelum tindakan berisiko: force push, `git reset --hard`, menghapus branch remote,
   mengubah pengaturan repo, atau menghapus banyak file.
6. Jangan mengubah logika bisnis (API, Firebase Auth, payload) pada issue bertipe `style` atau `docs`.
7. Jangan menyatakan sesuatu "sudah diuji" bila tidak dijalankan. Tulis apa yang dijalankan dan apa yang belum.
8. Di akhir setiap tugas, laporkan dengan format berikut:

```
Issue   : #7 feat(nav): navbar dan footer bersama
Branch  : feat/7-navbar-bersama
Commit  : 8 commit
  - refactor(nav): pindahkan markup navbar ke partial
  - ...
PR      : <url>
Verifikasi : build lolos; dicek di 1440/768/390; belum diuji: ...
Di luar lingkup : issue #21 dibuat untuk ...
```

---

## Lampiran A — Setup Awal (sekali jalan)

**Identitas git.** Pastikan `git config user.name` dan `git config user.email` terisi, dan email tersebut
terhubung ke akun GitHub agar commit tercatat di profil. Kontribusi baru tampil di grafik setelah commit
berada di branch default (`main`), yang terjadi saat PR di-merge.

**Pengaturan repo** (GitHub → Settings, atau CLI):

```bash
gh repo edit --enable-rebase-merge --enable-squash-merge=false \
  --enable-merge-commit=false --delete-branch-on-merge
```

Branch protection untuk `main` (Settings → Branches): wajib lewat Pull Request, wajib linear history,
larang force push, larang penghapusan. Jika ada workflow CI, jadikan wajib lolos sebelum merge.

**Label** (jalankan di bash atau Git Bash):

```bash
while IFS='|' read -r name color desc; do
  gh label create "$name" --color "$color" --description "$desc" --force
done <<'EOF'
type:feat|0E8A16|Kemampuan atau komponen baru
type:fix|D73A4A|Perbaikan bug
type:style|A2EEEF|Perubahan tampilan murni
type:refactor|5319E7|Perapian kode tanpa ubah perilaku
type:docs|0075CA|Dokumentasi dan copywriting
type:chore|CFD3D7|Pemeliharaan repo
type:build|FBCA04|Vite, dependensi, deploy
area:nav|C5DEF5|Navbar, footer, navigasi
area:auth|C5DEF5|Login dan menu akun
area:planner|C5DEF5|Form generate input manual
area:vision|C5DEF5|Generate dari foto
area:result|C5DEF5|Hasil itinerary, anggaran, peta
area:trips|C5DEF5|Halaman Perjalananku
area:community|C5DEF5|Halaman Komunitas
area:modal|C5DEF5|Popup dan dialog
area:static-pages|C5DEF5|Tentang, Kontak, Privasi
area:design-system|C5DEF5|Token, tipografi, ikon, komponen dasar
area:a11y|C5DEF5|Aksesibilitas
epic|3E4B9E|Induk dari beberapa issue
priority:high|B60205|Kerjakan lebih dulu
priority:low|E4E669|Bisa ditunda
EOF
```

---

## Lampiran B — Daftar Issue Awal untuk Redesign UI

Buat satu epic: `epic: redesign UI profesional dan konsisten`, lalu issue berikut (urutan = urutan pengerjaan).

| # | Judul issue | Label |
|---|---|---|
| 1 | `chore(repo): tambah .gitattributes dan rapikan .gitignore` (commit line ending terpisah dari perubahan lain) | type:chore |
| 2 | `docs(design): audit UI saat ini dan rencana redesign` | type:docs, area:design-system |
| 3 | `style(tokens): ganti palet dengan identitas visual sendiri` | type:style, area:design-system |
| 4 | `style(typography): pasang font dan skala tipografi` | type:style, area:design-system |
| 5 | `fix(tokens): hapus referensi var(--rausch) yang tidak terdefinisi` | type:fix, area:design-system |
| 6 | `refactor(icons): ganti Material Symbols dengan satu set ikon SVG` | type:refactor, area:design-system |
| 7 | `refactor(ui): hapus style inline dan !important` | type:refactor, area:design-system |
| 8 | `feat(nav): navbar dan footer bersama untuk semua halaman` | type:feat, area:nav |
| 9 | `refactor(static-pages): pindahkan CSS inline ke style.css` | type:refactor, area:static-pages |
| 10 | `feat(nav): routing hash untuk tab Planner, Perjalananku, Komunitas` | type:feat, area:nav |
| 11 | `style(auth): tombol Masuk, dropdown akun, dan drawer mobile` | type:style, area:auth |
| 12 | `feat(ui): komponen dasar (button, input, badge, dialog, toast, skeleton, empty state)` | type:feat, area:design-system |
| 13 | `style(planner): rapikan form input manual` | type:style, area:planner |
| 14 | `style(vision): rapikan dropzone dan state upload foto` | type:style, area:vision |
| 15 | `style(result): rapikan hasil itinerary, cuaca, anggaran, tab` | type:style, area:result |
| 16 | `style(trips): kartu berfoto dan peta destinasi ke cover` | type:style, area:trips, area:community |
| 17 | `feat(trips): pencarian, filter, urutan, dan menu aksi kartu` | type:feat, area:trips |
| 18 | `feat(community): pencarian dan tombol suka yang aksesibel` | type:feat, area:community |
| 19 | `style(modal): popup detail menjadi side sheet dan bottom sheet` | type:style, area:modal |
| 20 | `style(static-pages): page header ringkas untuk Tentang, Kontak, Privasi` | type:style, area:static-pages |
| 21 | `docs(static-pages): seragamkan copy dan verifikasi klaim` | type:docs, area:static-pages |
| 22 | `fix(a11y): audit keyboard, fokus, dan kontras` | type:fix, area:a11y |
| 23 | `ci(build): workflow GitHub Actions untuk npm run build` (opsional) | type:build |

---

## Lampiran C — Contoh Satu Issue dari Awal sampai Selesai

Nomor di bawah hanya contoh.

```bash
# 1. Issue
gh issue create \
  --title "feat(nav): navbar dan footer bersama untuk semua halaman" \
  --body-file <file-isi-issue.md> \
  --label "type:feat" --label "area:nav"

# 2. Branch
git switch main && git pull --ff-only
git switch -c feat/8-navbar-bersama
```

Rangkaian commit yang wajar untuk issue ini:

```
refactor(nav): pindahkan markup navbar ke src/partials/navbar.html
feat(build): tambah plugin vite untuk menyisipkan partial
refactor(footer): pindahkan markup footer ke partial bersama
refactor(nav): ganti navbar di index.html dengan penanda partial
refactor(nav): terapkan partial pada tentang, kontak, dan privasi
style(nav): samakan tautan menjadi Planner, Perjalananku, Komunitas
fix(nav): tandai halaman aktif dengan aria-current
docs(repo): jelaskan struktur partial di README
```

```bash
# 3. Push dan Draft PR (setelah commit pertama)
git push -u origin feat/8-navbar-bersama
gh pr create --draft \
  --title "feat(nav): navbar dan footer bersama untuk semua halaman" \
  --body-file <file-isi-pr.md>          # memuat: Closes #8

# 4. Verifikasi, lalu siap direview dan merge
npm run build
gh pr ready
gh pr merge --rebase --delete-branch

# 5. Komentar Penyelesaian
gh issue comment 8 --body-file <file-penyelesaian.md>
```

File sementara (`<file-...>`) dibuat di folder temp sistem, bukan di dalam repo, dan tidak boleh di-commit.
