# Verifikasi Management v2

Target rilis: PR/preview, **tanpa merge atau migrasi produksi**. QA menggunakan
Convex nyata `doting-horse-423`; data sintetis, bukan roster produksi.
Base screenshot: `70c7dbbb4fddf6e78362a41213e052eb1268d1ee`.

| Requirement PRD | Bukti |
| --- | --- |
| AUTH-01–04 | `test-management.mjs`: login, akun baru/wajib ganti, revoke sesi, operator, promosi langsung, nonaktif, last-admin, pemulihan sekali pakai. `test-handlers.mjs`: token/ACL. `setup-management.mjs`: bootstrap internal dan output privat. |
| CLS-01–04 | Backend nyata dua kelas, ACL, aktivasi, arsip dan proteksi tulis; UI wizard/draf/jadwal minggu1 dan LIBUR; helper tanggal; salin kelas/pengaturan melalui API/UI. |
| ROS-01–03 | Unit CSV multiline/semicolon/BOM, XLSX sheet/format nol awal dan namespace XML dengan/tanpa prefix, mapping, duplicate/update; UI preview/commit/error; backend impor atomik dan optimistic revision. |
| ATT-01–05 | Invariant transaksi atomik/foreign ID/duplicate/revision; backend frozen snapshot setelah roster/dosen/template berubah, buka kunci/refresh/relock dan arsip lama; UI undo/draf reload/offline/lock/download. Storage scope akun/kelas/pertemuan. |
| DOC-01–05 | Generator dinamis Word/PDF, backend preview/publish/format/idempotensi/unduhan berizin/paket satu kelas; fixture render 0/12/13/25/93, kop/dosen/nama panjang dan unicode Latin. |
| NAV-01–04 | Chromium/WebKit real-backend: Cmd/Ctrl+K, hasil berkonteks, keyboard/deep link/Back; viewport320/390/768/1280 dua tema/reduced motion, onboarding/skip/logout. |
| MIG-01–04 | Backup produksi termasuk storage privat; unit migrasi fixture lama dua kali menjaga ID/revision/status/file/hash; integrasi pada deployment terpisah; panduan rollback. Produksi belum diubah. |
| TEST-01–05 | Script reproducible di package.json, screenshot actual-base di `docs/management-v2`, README dan panduan migrasi. Catatan final hasil runtime/preview diperbarui sebelum PR siap. |

## Render dokumen

`npm run test:documents` menghasilkan Word/PDF sintetis. Microsoft Word Windows
COM membuka dan mengekspor semua11 DOCX ke PDF. Hasil normal:

| Absen | Arsip: form/halaman | Paket: form/halaman (ditambah pertemuan 0 absen) |
| --- | --- | --- |
| 0 | 1/1 | 2/1 |
| 12 | 1/1 | 2/1 |
| 13 | 2/2 | 3/2 |
| 25 | 3/3 | 4/2 |
| 93 | 8/8 | 9/5 |

Fixture panjang menghasilkan PDF3 halaman dan Word3 halaman dengan kop lengkap:
konten utuh dipindah tanpa mengecilkan font. PDF memakai Tinos tertanam penuh,
dengan metrik yang sesuai Times New Roman. Font tidak hanya diperiksa dari
keberadaan resource—gambar render ikut diperiksa.

### Fidelitas terhadap DOCX asli

Acuan adalah `BAP - Senin 2.docx` (SHA256
`e3cf9ad25e5872ece3f51b69883e2fb633f9f53b2c755a6780078df3cea0ec69`).
Referensi asli dibaca privat; gambar publik hanya berisi data sintetis.
Kop mempertahankan enam baris, termasuk jurusan terpisah dari prodi, telepon/faks,
email/situs, proporsi logo sekitar2,71×2,70cm dan garis tebal. Tabel pembimbing
memakai judul sumber; nama langsung tanpa label peran secara default. Teks nama
mahasiswa pada kedua kolom memakai font/ukuran dan rata kiri yang sama.

`test-document-fidelity.mjs` memeriksa isi/struktur kop, logo, tabel, format
kedua kolom nama, label opsional dan kompatibilitas versi lama. Uji dokumen
memeriksa lebar label identitas pada12pt serta kasus0/12/13/25/93 dan konten panjang.
Render Microsoft Word dan PDF diperiksa untuk jumlah form, halaman kosong,
batas kertas, dan kelengkapan teks. Posisi enam baris kop dibandingkan dengan
render sumber; form kedua dimulai di setengah folio, bukan tepat setelah tabel
pertama. Pengukuran ini mendukung fidelitas tata letak, bukan klaim piksel identik
untuk semua font, isi khusus, aplikasi Word, atau printer.

Hasil24 pemeriksaan tambahan ada di
[`document-fidelity-results.json`](management-v2/document-fidelity-results.json).
Pada fixture kop resmi, selisih koordinat maksimum terhadap render sumber adalah
0,222pt untuk Word dan0,833pt untuk PDF; jarak awal form pertama–kedua sekitar467,8pt.
Angka ini hanya mengukur enam baris kop dan posisi setengah folio; pemeriksaan
tabel, isi, jumlah halaman dan kasus panjang dilakukan terpisah.

Word memakai `pageBreakBefore` pada pemisah paket agar karakter page break yang
jatuh di batas bawah tidak menghasilkan halaman kosong tambahan. Baris luar
menjaga form utuh dan tinggi minimum slot atas; konten tinggi tetap boleh pindah
halaman. Draf/template/arsip yang sudah tersimpan tidak ditimpa otomatis.

Output privat/sintetis: `out/management/documents/results.json`,
`word-results.json`, render PDF/PNG dan hasil backend/UI. Tidak perlu membagikan
backup/credential untuk mereproduksi fixture dokumen.

## Batas verifikasi

Pembaca XLSX menormalkan nama elemen SpreadsheetML sebelum dibaca ExcelJS.
Uji regresi mencakup beberapa prefix, prefix hanya pada worksheet, teks sel yang
menyerupai XML, atribut namespace ekstensi, beberapa sheet, format nol awal,
serta penolakan ZIP/XML rusak. File biasa diteruskan tanpa ditulis ulang.
Chromium dan WebKit menguji unggah, preview dan konfirmasi impor XLSX berprefix
dengan tiga mahasiswa sintetis, serta penolakan NIM duplikat dari CSV.

WebKit otomatis di Windows bukan perangkat Mac fisik, VoiceOver atau printer
fisik. PDF/Word dapat memecah halaman berbeda pada konten panjang; periksa format
yang dicetak. Migrasi produksi menunggu review. Google Sheets belum termasuk v2.
Pemeriksaan zoom menggunakan pembesaran teks dan viewport ekuivalen; bukan klaim
telah menguji seluruh kombinasi zoom, browser dan driver printer.

## Hasil akhir runtime

- Unit/invariant/API/importer/migrasi fixture: lulus; build lulus; npm audit0 temuan.
- Backend Convex nyata:9 kelompok lulus, termasuk salin kelas tanpa/dengan roster,
  prioritas pencarian konteks, dan penolakan HTTP dokumen lintas kelas.
- Chromium dan WebKit:22 kelompok UI lulus, termasuk pembuatan/penugasan akun lewat
  UI dan konflik pengaturan saat editor terbuka.6 kelompok failure injection lulus:
  konflik, generator gagal/retry, storage penuh, offline rincian terkunci belum
  dicache, sesi habis, skeleton/reduced motion.
- Preview Vercel menggunakan `accurate-cow-413`, reference
  `tiyouw-s-projects:yo-urconvex:preview/codex-management-v2` (slash branch dinormalisasi
  menjadi minus). Login admin dan pembacaan kelas/roster/jadwal telah diverifikasi
  melalui browser pada URL preview. Bootstrap diulang: skipped, akun tetap sama.
- Perbandingan dua export produksi:93 peserta,16 pertemuan,279 presensi,9 audit,
  5 bapDoc dan4 file storage identik, termasuk ID/revision/hash. Sesi login15→16;
  sesi tambahan tersebut tidak dihapus atau diubah. Schema/migrasi v2 belum diterapkan
  ke produksi. Manifest lengkap disimpan privat di out/management/.

- Penampil PDF diperiksa dari piksel canvas hasil render, bukan hanya keberadaan
  URL/iframe. PDF.js menggantikan iframe yang kosong pada in-app browser.
  Dua uji renderer tambahan di Chromium/WebKit memeriksa halaman2, ekstraksi teks
  untuk pembaca layar, zoom, dan viewport320px. Worker dan library dimuat saat
  preview dibuka; PDF tidak dikirim ke layanan pihak ketiga.
- Kelas DEMO di preview berisi3 mahasiswa sintetis dan dua pertemuan terkunci.
  Empat dokumen Word/PDF terlindungi serta paket dua form/1folio telah diuji pada
  backend preview sebenarnya. Gambar PDF aktual di docs/management-v2/.

- Responsive sweep tambahan:208 kombinasi lulus, mencakup beranda, daftar/wizard
  kelas, mahasiswa/impor, jadwal, template, pengaturan, riwayat, arsip, akun dan
  editor akun/profil; 320/390/768/1280px, terang/gelap, Chromium/WebKit. Native
  select WebKit sempat menambah scrollWidth pada320px; styling select diperbaiki
  tanpa menghapus indikator fokus atau mengganti kontrol HTML native.
