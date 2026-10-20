# Presensi & BAP — Pengantar Pariwisata Budaya

Aplikasi presensi 4 tombol (Hadir / Alpha / Sakit / Izin) yang langsung
menghasilkan BAP `.docx` sesuai template resmi Prodi Destinasi Pariwisata,
Politeknik Negeri Jember.

1 operator (asisten dosen), ±100 mahasiswa, 4 golongan, 1 tanggal = 1 sesi = 1 BAP.

**Repo ini sengaja bebas data pribadi.** Nama & NIM peserta tidak pernah
di-commit — data hidup di deployment Convex, dimasukkan lewat env
`BAP_MAHASISWA_CSV` (Vercel build) atau file lokal `data/bap-mahasiswa.csv`
(gitignored). Bentuknya lihat `data/mahasiswa.csv.example`.

- Pedoman UI Kontras: [`DESIGN.md`](DESIGN.md)
- Perubahan UI, screenshot sintetis, dan verifikasi: [`docs/UI-UPDATE.md`](docs/UI-UPDATE.md)

## Status

Dipakai di kelas (production). Rencana fase 2: ekspor xlsx + matriks rekap.

## Struktur

```
convex/
  schema.js          peserta, pertemuan, presensi, bapDoc, sesi, audit
  auth.js            createSession (internal), me, logout
  authNode.js        login (action, scrypt)
  bootstrap.js       satu query: semua pertemuan + peserta (untuk cache offline)
  sesi.js            detail, simpanDanKunci (atomik), bukaKunci
  bap.js             klaim (bisa pulih), selesai, gagal, forSesi, pesanGagal
  bapNode.js         generate (action "use node") -> docx + sha256 + storage
  seed.js            16 minggu: 13 praktikum, teori, UTS, UAS + peserta (idempoten)
  lib/               logika transaksi + data template (base64)
bap-shared/
  bapRender.js       inti algoritma form/nomor + render docx-templates
                     (di luar convex/ karena mengimpor paket Node — see docs)
src/
  App.jsx            token + cache bootstrap + routing
  screens/           Login, Pertemuan, Presensi
  lib/store.js       token, cache bootstrap, draf lokal per pertemuan
templates/
  build_template.py  pembangun template .docx dari file asli prodi (lokal)
scripts/             uji, verifikasi, embed data, hash password
data/
  mahasiswa.csv.example  contoh bentuk CSV peserta
```

## Menjalankan lokal

```bash
export PATH=$HOME/.local/node/bin:$PATH   # kalau node user-local
npm install

# 1. siapkan data peserta (lokal, tidak di-commit)
cp data/mahasiswa.csv.example data/bap-mahasiswa.csv   # lalu isi data asli

# 2. buat project Convex (sekali)
npx convex dev

# 3. set password operator (disimpan sebagai hash scrypt di Convex env)
node scripts/hash-password.mjs "password-pilihan"
#    tempel hasilnya ke Convex dashboard -> Settings -> Environment Variables
#    nama: BAP_PASS_HASH

# 4. jalankan
npm run dev     # http://localhost:5173
```

Data 16 pertemuan + peserta diisi otomatis app saat pertama dibuka
(seed idempoten — hanya mengisi kalau tabel kosong).

Jadwal: minggu 1 teori; minggu 2–7 dan 9–15 praktikum (13 sesi); minggu 8 UTS;
minggu 16 UAS. [Aturan dan kompatibilitas data lama](docs/JADWAL-PRAKTIKUM.md).

## Deploy (Vercel + Convex via Marketplace)

1. Vercel → **Marketplace** → Convex → install & provision.
2. Import repo ini. Build command (sudah di `vercel.json`):
   ```
   node scripts/embed-peserta.mjs && npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL
   ```
   Helper runtime `convex/_generated/api.js` di-commit agar frontend dapat dibangun
   sebelum codegen milik `convex deploy`. File ini hanya referensi fungsi dan
   tidak berisi data peserta atau kredensial. Jangan menambahkan `convex codegen`
   terpisah di depan: perintah itu tidak mendukung preview deploy key.
   Generated lain tetap diabaikan, dan `convex deploy` meregenerasinya seperti biasa.
   Lihat [panduan Convex untuk Vercel](https://docs.convex.dev/production/hosting/vercel)
   dan [anjuran version control generated code](https://docs.convex.dev/understanding/best-practices/other-recommendations#check-generated-code-into-version-control).
3. Env:
   - Vercel: `BAP_MAHASISWA_CSV` = isi CSV `nim,nama,golongan` (data peserta)
   - Convex: `BAP_PASS_HASH` = hasil `node scripts/hash-password.mjs "…"`
4. Setelah deploy pertama, app mengisi data sendiri saat dibuka.

Preview deployment per PR butuh Preview deploy key terpisah — untuk app
1 operator ini tidak wajib.

## Uji

```bash
npm test        # logika form/nomor/hari + logika handler (ctx tiruan) + wiring
npm run test:fase0   # generate 4 contoh BAP (0/12/13/25 tidak hadir) + verifikasi
```

Regresi UI memakai data sintetis dan API fixture lokal; tidak perlu roster asli
atau kredensial Convex:

```bash
npm ci
npx playwright install chromium
npm run test:ui
```

Lihat `docs/UI-UPDATE.md` untuk cakupan dan batas pengujian.
Panduan awal, paket cetak, bukti sebelum–sesudah, dan hasil render Word dijelaskan
di [docs/GUIDE-PRINT.md](docs/GUIDE-PRINT.md).
Quick access cetak, konfirmasi logout, dan transisi loading dijelaskan di
[docs/ACCESS-MOTION.md](docs/ACCESS-MOTION.md), termasuk screenshot sebelum–sesudah.

## Setelah template berubah

```bash
# taruh template asli prodi di data/bap-sumber-asli.docx (gitignored), lalu:
/usr/local/bin/python3 templates/build_template.py
node scripts/embed-template.mjs      # WAJIB: template di-embed ke kode Convex
npm run test:fase0
```

## Keputusan desain penting

- **Arsip satu form per halaman; paket cetak hingga dua form per folio** — pilih
  pertemuan terkunci di Siapkan cetak. Nama panjang dapat membuat satu form pindah
  utuh ke halaman berikutnya. Font dan tabel tidak diperkecil atau dipotong.
- **Nomor 1–12 diisi generator** — baris data diulang loop, tidak bisa pre-printed.
- **Simpan & kunci satu transaksi** — tanpa itu BAP bisa digenerate dari data
  setengah jadi.
- **Klaim generator bisa pulih** — PENDING hidup 120 detik; kalau action mati,
  percobaan berikutnya mengambil alih (tidak nyangkut selamanya).
- **BAP terikat (sesi, revisi, templateVersion) + sha256** — sumber sama
  menghasilkan dokumen sama; revisi baru = versi BAP baru.
