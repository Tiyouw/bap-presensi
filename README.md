# Presensi & BAP — Pengantar Pariwisata Budaya

Aplikasi presensi 4 tombol (Hadir / Alpha / Sakit / Izin) yang langsung
menghasilkan BAP `.docx` sesuai template resmi Prodi Destinasi Pariwisata,
Politeknik Negeri Jember.

1 operator (asisten dosen), ±100 mahasiswa, 4 golongan, 1 tanggal = 1 sesi = 1 BAP.

**Repo ini sengaja bebas data pribadi.** Nama & NIM peserta tidak pernah
di-commit — data hidup di deployment Convex, dimasukkan lewat env
`BAP_MAHASISWA_CSV` (Vercel build) atau file lokal `data/bap-mahasiswa.csv`
(gitignored). Bentuknya lihat `data/mahasiswa.csv.example`.

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
  seed.js            16 pertemuan + peserta (idempoten, dipanggil app otomatis)
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

## Deploy (Vercel + Convex via Marketplace)

1. Vercel → **Marketplace** → Convex → install & provision.
2. Import repo ini. Build command (sudah di `vercel.json`):
   ```
   node scripts/embed-peserta.mjs && npx convex codegen && npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL
   ```
   `codegen &&` di depan itu wajib: `convex deploy` menjalankan `--cmd`
   SEBELUM codegen, sedangkan `convex/_generated/` tidak di-commit.
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

## Setelah template berubah

```bash
# taruh template asli prodi di data/bap-sumber-asli.docx (gitignored), lalu:
/usr/local/bin/python3 templates/build_template.py
node scripts/embed-template.mjs      # WAJIB: template di-embed ke kode Convex
npm run test:fase0
```

## Keputusan desain penting

- **Satu form per halaman** — halaman F4 (21,5 × 33 cm) muat 2 form tepat tanpa
  sisa, jadi satu nama panjang yang terbungkus 2 baris mendorong baris terakhir
  form ke-2 ke halaman berikutnya. Dibuktikan lewat render nyata.
- **Nomor 1–12 diisi generator** — baris data diulang loop, tidak bisa pre-printed.
- **Simpan & kunci satu transaksi** — tanpa itu BAP bisa digenerate dari data
  setengah jadi.
- **Klaim generator bisa pulih** — PENDING hidup 120 detik; kalau action mati,
  percobaan berikutnya mengambil alih (tidak nyangkut selamanya).
- **BAP terikat (sesi, revisi, templateVersion) + sha256** — sumber sama
  menghasilkan dokumen sama; revisi baru = versi BAP baru.
