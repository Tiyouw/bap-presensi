# BAP Praktikum — Management v2

Ruang kerja **mata kuliah → kelas/semester → mahasiswa, jadwal, presensi, BAP**.
Setiap kelas memiliki dosen, roster, jadwal, template, dan arsip sendiri.
Status: PR/preview untuk review; **belum di-merge atau dimigrasikan ke produksi**.

- [Spesifikasi](PRD.md) · [Pedoman Kontras](DESIGN.md)
- [Bukti verifikasi](docs/VERIFICATION-V2.md) · [Migrasi/rollback](docs/MIGRATION-V2.md)

## Menggunakan aplikasi

1. Masuk dengan username/password individual dari admin. Ganti password sementara
   saat pertama masuk. Panduan awal boleh dilewati dan dibuka kembali dari Bantuan.
2. **Tambah kelas**: pilih/buat matkul, isi identitas kelas, semester, dosen/asdos.
   Simpan draf dan lanjutkan nanti. Salin kelas menyalin pengaturan; menyalin
   mahasiswa adalah opsi terpisah.
3. **Mahasiswa**: tambah/ubah/nonaktifkan atau impor `.xlsx`/`.csv`. Pilih sheet,
   cocokkan kolom, periksa preview dan konfirmasi. Baris invalid/duplikat memblokir
   impor; pembaruan nama/golongan memerlukan persetujuan. Impor tidak menghapus
   peserta yang tidak ada di file. Batas 5 MB/2000 baris. Simpan NIM sebagai teks
   di Excel agar nol awal tidak hilang. Susunan yang disarankan: satu baris header
   **NIM, Nama, Golongan**, lalu satu mahasiswa per baris; hindari judul golongan
   atau header berulang di tengah tabel. Pembaca mendukung namespace XML Excel
   dengan prefix maupun tanpa prefix.
4. **Jadwal**: buat mingguan atau tambah satu pertemuan. Pilih Praktikum/TEORI/UTS/
   UAS/LIBUR. Kelas baru boleh praktikum minggu1. Preset PPB: teori1, praktikum2–7/
   9–15, UTS8, UAS16. Periksa sebelum menyimpan.
5. **Template BAP**: atur kop lengkap (termasuk jurusan, alamat/telepon/faks,
   email/situs), logo PNG/JPEG, judul dan label peran opsional. Tombol
   **Gunakan format resmi** mengembalikan isi editor ke acuan DOCX asli;
   simpan draf, periksa preview lalu terbitkan. Identitas dosen,
   asdos, prodi dan semester mengikuti kelas. Tabel mengikuti format resmi;
   tidak ada upload DOCX bebas.
6. Periksa persiapan, aktifkan kelas. Buka praktikum, tandai yang tidak hadir,
   periksa nama/status, **Simpan & Kunci**, lalu unduh Word/PDF.
7. **Siapkan cetak** dari kelas/presensi/arsip: pilih pertemuan terkunci dalam satu
   kelas, buat preview PDF atau unduh paket Word dua form per folio.

Di halaman presensi, **Mode Panggil** meminta golongan yang sedang hadir, lalu
membuka kartu satu mahasiswa. Ikon golongan dan tombol **Bantuan** menjelaskan alur.
Progress dihitung per golongan; setelah selesai, otomatis kembali ke daftar dalam
3 detik. Bisa dibatalkan, keluar sekarang, atau lanjut golongan berikutnya secara
manual. Membuka bantuan menjeda perpindahan kartu dan countdown. Pilih status
dengan tombol atau **1 Hadir / 2 Alpha / 3 Sakit / 4 Izin**. **←** kembali,
**→/Enter** berikutnya setelah memilih, **Escape** menutup. Warna dan cap mengikuti
status. Lanjut otomatis (700 ms) bisa dimatikan; pengaturannya diingat per akun/kelas.
Kartu dan daftar memakai draf yang sama. Nama yang dilewati tidak diubah dan
ditampilkan saat review. Posisi/progres dapat dilanjutkan setelah tutup/refresh;
progres direset bila snapshot/revisi berubah. Akhir panggilan tetap melalui review
dan konfirmasi Simpan & Kunci. Lihat [catatan dan verifikasi](docs/MODE-PANGGIL.md).

Search navbar mencari matkul/kelas, mahasiswa/NIM, tanggal/pertemuan dan fitur.
**⌘K** pada Mac, **Ctrl+K** pada Windows; ↑↓/Enter/Escape didukung. Konteks kelas/
semester terlihat dan hasil dibatasi izin. ⌘F/Ctrl+F tetap milik browser.
Menu mobile, tema terang/gelap, konfirmasi logout dan reduced motion tersedia.

## Akun dan akses

| Peran | Kemampuan |
| --- | --- |
| Admin | Semua kelas, akun/reset/nonaktifkan, promosi peran dan penugasan |
| Pengelola | Membuat matkul/kelas, mengelola kelas yang ditugaskan |
| Operator | Presensi, koreksi, unduh/cetak pada kelas yang ditugaskan |

Tiyouw admin awal, Marchaenta pengelola awal; admin dapat mempromosikannya.
Tidak ada signup publik, OAuth atau verifikasi email. Password 12–128 karakter,
hash scrypt dengan salt acak. Reset/penonaktifan mencabut sesi. Admin terakhir
dilindungi. Profil menyediakan sesi perangkat dan kode pemulihan admin sekali
pakai; simpan kode secara privat. Server hanya menyimpan hash.

## Draf, snapshot dan arsip

Draf/cache terpisah per akun/kelas/pertemuan. Logout mempertahankan draf. Offline
mendukung data yang sudah dicache; simpan server, manajemen dan generate memerlukan
internet. Draf aplikasi lama ditawarkan untuk diambil alih sekali pada kelas PPB.

Kunci membekukan roster/nama/NIM/golongan, dosen, identitas kelas dan versi template.
Perubahan kelas tidak mengubah arsip. Buka kunci mempertahankan snapshot.
Pengelola boleh **Terapkan data kelas terbaru** setelah review; tindakan ini
menaikkan revision agar perangkat lain mendeteksi konflik. Kunci kembali membuat
revisi berikutnya. Berkas revisi lama tetap tersimpan.

## Word, PDF dan cetak

Folio **215 × 330 mm**, 12 tidak hadir per form; absen ke-13 memakai form lanjutan
bernomor13. Arsip satu form per halaman, paket maksimal dua form per halaman.
Form tidak dipotong/dikecilkan; konten panjang bisa menambah halaman. Jumlah form
ganjil menyisakan bagian bawah kosong.

Preview PDF dirender dengan [PDF.js](https://mozilla.github.io/pdf.js/examples/) di canvas, termasuk pada browser tanpa plugin
PDF bawaan. Tersedia navigasi halaman dan teks untuk pembaca layar. Preview memakai
PDF hasil generator yang sama, font Tinos tertanam dengan metrik Times New Roman (OFL di
`bap-shared/assets/`). Word memakai template resmi. Keduanya dari snapshot sama,
dengan pengukuran layout berbeda; jumlah halaman konten panjang dapat berbeda.
Periksa berkas format yang akan dicetak. Skala100%, satu halaman per lembar dan
kertas sesuai dokumen; jangan memilih dua halaman per lembar lagi. Printer dipilih
melalui dialog sistem. Pengujian otomatis WebKit bukan pengujian Mac/printer fisik.

Kop, proporsi logo, identitas, tabel pembimbing dan tabel mahasiswa mengikuti
DOCX asli. Format resmi mencetak nama pembimbing tanpa awalan peran. Pengaturan
yang sudah disimpan tetap dipertahankan; gunakan **Gunakan format resmi** lalu
terbitkan bila ingin mengembalikan isinya. Sesi yang pernah dikunci dan berkas
arsip tidak diganti otomatis. Sumber font PDF dipin dari
[Google Fonts Tinos](https://github.com/google/fonts/tree/ba95515f1333efe9342c2ad988b9c2f6bef6dbad/ofl/tinos);
regenerasi aset dengan `node scripts/embed-pdf-fonts.mjs`.

## Menjalankan lokal

Node22.13+ atau Node24, npm dan akun Convex yang memiliki akses project.

```sh
npm ci
npx convex dev
npm run dev
```

Pilih deployment development secara eksplisit. `.env.local` berisi
`CONVEX_DEPLOYMENT`/`VITE_CONVEX_URL`; jangan commit. Build tidak lagi membutuhkan
CSV pribadi, `BAP_MAHASISWA_CSV` atau `BAP_PASS_HASH`. Seed publik sudah dihapus.
Data baru dimasukkan dari aplikasi.

Bootstrap oleh pemilik deployment, bukan API publik:

```sh
node scripts/setup-management.mjs --deployment TEAM:PROJECT:dev/NAME --demo
```

Demo hanya menerima selector dev/preview, mengisi contoh PPB sintetis dan dua akun.
Password acak/kode pemulihan ditulis ke `out/credentials/management.json` yang
Git-ignored, tidak dicetak ke terminal. Tanpa `--demo`, data lama ditautkan dan
password awal wajib diganti. Gunakan `--output out/credentials/nama-lain.json`
untuk deployment lain. Baca panduan migrasi sebelum produksi.

## Deploy preview Vercel

Integrasi Convex harus mengizinkan preview deploy. Build di `vercel.json`:

```sh
npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL
```

Deploy key disediakan integrasi Convex. Frontend preview harus menunjuk backend
preview branch itu, bukan produksi. Backend baru kosong: pemilik project perlu
menjalankan setup demo dengan selector preview yang benar, lalu menguji login.
Environment Defaults tidak membuat akun. Reference preview branch ini adalah
`tiyouw-s-projects:yo-urconvex:preview/codex-management-v2` (slash branch menjadi minus). Jangan salin roster/kredensial produksi.
Kebijakan PR ini: **preview direview dahulu, jangan merge otomatis**.

## Pengujian

```sh
npm test                 # helper, invariant transaksi, API wiring, importer, migrasi fixture
npm run build
npm run test:documents   # 0/12/13/25/93 absen, arsip/paket, konten panjang
npm audit
npx playwright install chromium webkit
npm run test:backend
npm run test:ui
npm run test:pdf-ui       # renderer PDF portabel, paging/zoom/teks
npm run test:responsive   # semua layar manajemen, kedua browser/tema
npm run test:panggil      # progres/draf + UI kartu dengan transport sintetis, dua browser
```

Integrasi/UI dipatok ke deployment QA sintetis `doting-horse-423`, agar tidak menulis
produksi. Siapkan akun `admin.qa`/`marchaenta.qa`, password hanya di environment
`BAP_QA_PASSWORD` atau berkas privat `out/management/qa-credentials.json` dengan
properti `password`. Tidak ada kredensial dalam Git. Hasil di `out/management/`.
Screenshot PR di `docs/management-v2/`, before dari commit base yang dicatat.

## Struktur dan roadmap

`convex/accounts.js`/`authNode.js`: akun/sesi; `kelola.js`: manajemen;
`lib/access.js`: ACL; `lib/classLogic.js`: snapshot; `lib/sesiLogic.js`: transaksi;
`bapNode.js`/`http.js`: generator/unduhan berizin. `bap-shared/`: Word/PDF/validasi.
`src/screens/`: workspace/manajemen/presensi; `src/lib/importRoster.js`: adapter
Excel/CSV terpisah dari preview/commit.

Google Sheets/Excel Online direncanakan sebagai adapter tabel yang memakai jalur
mapping/preview/commit sama. Belum ada koneksi Google atau sinkronisasi otomatis.
