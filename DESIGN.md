# BAP Praktikum — Kontras

Arah desain yang dipilih pengguna: **Kontras**, diterapkan ke aplikasi yang sudah ada. Bahasa antarmuka Indonesia. Utamakan kecepatan mengisi presensi di HP dan kejelasan status data.

## Sumber acuan

- `src/tokens.css`: sumber warna, font, jarak, radius, ukuran, serta tema.
- `src/styles.css`: penerapan komponen dan breakpoint.
- `src/components/Brand.jsx`: simbol form presensi dengan centang 45°.
- `public/favicon.svg`: simbol yang sama dengan warna mengikuti tema sistem.
- `docs/ui-preview/`: bukti tampilan menggunakan fixture, bukan presensi kelas sebenarnya.
- PRD terbaru yang menyertai proyek: aturan bisnis. Kontrak backend yang berjalan di `convex/` tetap menjadi acuan integrasi UI.

## Karakter

Tegas, datar, tenang, dan mudah dibaca. Hijau hutan pada tema terang, charcoal dan lime pada tema gelap. Bentuk bersudut kecil, angka monospace, nama mahasiswa sans-serif. Tidak ada gradien, glassmorphism, avatar dekoratif, grafik tambahan, atau gamifikasi.

## Token dan aksesibilitas

| Peran           | Terang    | Gelap     |
| --------------- | --------- | --------- |
| Latar           | `#FFFFFF` | `#151717` |
| Surface         | `#F3F4F1` | `#262A28` |
| Teks            | `#17231E` | `#F7FAF6` |
| Sekunder        | `#4D5C52` | `#BAC8BC` |
| Aksen           | `#213E2E` | `#C7EC6A` |
| Teks pada aksen | `#F2FFD8` | `#1D3015` |

Nilai status Hadir/Alpha/Sakit/Izin dan pasangan latarnya ada di token. Selalu sertakan label status; warna tidak boleh menjadi satu-satunya informasi. Mode kuas aktif memakai aksen utama, sedangkan badge nama memakai warna status.

- Font UI: Segoe UI / system UI / Arial. Angka: Consolas / SFMono / Menlo.
- Judul pendek 28–36 px; nama 14–15 px; metadata dan badge minimum 12 px; input 16 px.
- Target sentuh minimum 48 × 48 px. Tombol utama 52 px tinggi.
- Baris mahasiswa minimum 76 px dan bertambah tinggi untuk nama panjang.
- Radius kontrol 3 px, badge 2 px, dialog 8 px.
- Focus ring terlihat; dialog menahan Tab, mendukung Escape, dan mengembalikan focus.
- Teks diperbesar 200% harus tetap dapat dipakai. Tombol/filter boleh membungkus.
- Transisi singkat; hormati reduced motion. Animasi berulang hanya selama loading
  (shimmer, simbol, indikator akses), lalu berhenti ketika data siap.

## Layout responsif

Di desktop, area kerja maksimum 760 px dengan header lebih lebar. Di HP, padding 16 px dan satu kolom. Layar presensi memakai grid setinggi viewport: header, area kerja bergulir, lalu action bar di aliran layout. Footer tidak menutupi daftar dan mendukung safe area.

Header presensi HP merangkum tombol kembali, undo, dan BAP agar tidak menduplikasi judul dalam navigasi kedua. Pemilih tema tersedia di header; pada lebar sangat kecil pemilih itu dapat diakses lewat halaman pertemuan. Pilihan tema disimpan dan berlaku ke seluruh aplikasi.

Pada 390 × 844 px dengan ukuran teks standar, minimal empat baris nama terlihat utuh. Pada layar pendek, toolbar tidak dibuat sticky supaya hasil pencarian tetap dapat dijangkau. Pembesaran teks dan keyboard lebih diutamakan daripada jumlah baris terlihat.

## Presensi dan dokumen

1. Semua Hadir secara default; mode awal Alpha terlihat jelas. Tidak ada progres “x/93 terisi”.
2. Tap nama menetapkan mode aktif. Tombol opsi terpisah membuka detail mahasiswa.
3. Pencarian nama dan NIM case-insensitive, filter golongan dinamis, counter tetap menghitung kelas penuh.
4. Undo memberi feedback nama/status. Target undo tidak terhalang footer.
5. Review sebelum kunci menampilkan seluruh nama tidak hadir, golongan, dan status. Nol absen dikonfirmasi sebagai seluruh peserta hadir.
6. Simpan-dan-kunci tetap satu mutation. Keberhasilannya terpisah dari pembuatan BAP.
7. “BAP siap” hanya setelah file tersedia untuk revisi terkunci saat ini. Unduh melalui Blob dengan nama file eksplisit.
8. Membuka kunci memakai dialog yang dapat diakses. Dokumen lama ditandai usang sampai koreksi dikunci lagi.

Tap presensi hanya menulis lokal. Jika penyimpanan lokal gagal, tampilkan peringatan dan lindungi navigasi keluar agar isian tidak hilang tanpa disadari. Koneksi browser dan koneksi server dibedakan. Jangan mengaku tersimpan ke server sebelum mutation dikonfirmasi.

Draf dan rincian sesi dicache per pertemuan. Detail terkunci yang belum pernah dicache tidak boleh ditampilkan sebagai semua Hadir. Konflik revisi mempertahankan draf; muat server mencadangkan draf terlebih dahulu. Memakai draf sebagai pengganti memerlukan konfirmasi tersendiri dan tetap divalidasi backend saat simpan.

## Mode Panggil

Tombol sekunder bertanda tumpukan kartu berada setelah identitas/status pertemuan
dan sebelum ringkasan. Di HP tombol selebar area kerja. Daftar tetap menjadi layar
awal. Dialog desktop maksimal 540 px; HP memakai seluruh viewport dengan header
tutup yang tetap terjangkau saat bergulir. Kartu bertumpuk, nama besar, metadata
monospace, empat tombol status 2 × 2 dengan target minimum 48 px mengikuti artifact
Kartu Geser + Keyboard. Tidak menambah menu sidebar.

Pilihan memberi latar warna status dan cap teks/ikon, feedback 700 ms sebelum
lanjut otomatis. Pergeseran keluar 160 ms dan masuk 220 ms hanya transform/opacity.
Reduced motion mempertahankan warna/cap tanpa gerak. Angka 1–4, kiri/kanan, Enter,
Tab/Shift+Tab dan Escape bekerja di dialog. Ctrl/Cmd+K menutup kartu sambil membuka
pencarian global; draf/posisi tetap ada dan timer dihentikan. Shortcut browser tetap
tersedia. Dialog berada di atas navbar/menu agar tombol tutup tidak tertutup.

Progres memakai “x dari n diperiksa”, bukan jumlah status terisi. Cakupan seluruh
roster ditulis jelas. Review menampilkan nama yang dilewati beserta status daftar;
pengguna dapat melanjutkan atau menyetujui status daftar sebelum kunci. Rincian
implementasi dan bukti pengujian: `docs/MODE-PANGGIL.md`.

## Batas cakupan

Logo aplikasi tidak masuk kop BAP resmi. Format cetak tetap template prodi.
Unduhan arsip memakai generator satu form per halaman. Siapkan cetak memakai
generator paket terpisah, hingga dua form per folio, hanya dari pertemuan reguler
terkunci dan revisi tervalidasi. Lihat `docs/GUIDE-PRINT.md`. Tidak menambah layar
rekap/pengaturan yang backend-nya belum tersedia.

Panduan awal dapat dilewati dan hanya muncul sekali per browser. Tombol Bantuan
(?) membuka ulang panduan tanpa mengubah data. Hindari tour yang memaksa pengguna
mengisi presensi sungguhan atau membuka ulang panduan setiap login.

Siapkan cetak tersedia dari dashboard, footer presensi, dan dialog BAP dengan
pilihan bersama selama sesi aplikasi. Unduhan satu pertemuan tetap terpisah.
Logout meminta konfirmasi. Login memakai splash; perpindahan halaman memakai
skeleton singkat. Pembaruan server di latar belakang mempertahankan editor dan
hanya menampilkan indikator tipis. Rincian serta bukti: `docs/ACCESS-MOTION.md`.

Metadata berasal dari kelas yang dipilih atau snapshot sesi. Jangan memakai literal PPB/93/A–D pada layar kelas baru. `KELAS` hanya fallback kompatibilitas, bukan sumber data manajemen.

## Workspace management v2

Pertahankan Kontras: bidang datar, teks jelas, lime untuk tindakan utama dan status
yang selalu memiliki label. Sidebar desktop, menu mobile dan navbar global berada
di luar editor presensi. Pada HP tampilkan ikon brand/search agar navbar muat320px;
target tetap48px. Konteks kelas/semester tetap terlihat pada judul halaman.

Search adalah navigasi, bukan chat AI. Kelompokkan fitur, kelas, mahasiswa dan
pertemuan; nama yang sama wajib dibedakan dengan kelas/semester/NIM. Tampilkan
⌘K pada Apple, Ctrl+K pada Windows. Jangan ambil alih shortcut pencarian browser.
Hasil wajib difilter server sesuai akses; menyembunyikan menu saja tidak cukup.

Manajemen memakai formulir berlabel, empty/error/loading state dan konfirmasi
yang menyebut dampak. Wizard dapat disimpan sebagai draf. Impor memperlihatkan
mapping, contoh data, jumlah baris bermasalah dan perubahan sebelum commit.
Jangan menyamarkan preview template sebagai dokumen kelas yang sudah dikunci.
Konfigurasi template memiliki draf/versi terbit; snapshot arsip tetap utuh.

Preview cetak menampilkan PDF sebenarnya. Perubahan pilihan/revisi membatalkan
preview lama. Jangan menjanjikan dua form pasti muat untuk semua panjang isi;
jumlah halaman aktual terlihat setelah generate. Tidak mengubah ukuran font
dokumen untuk mengejar jumlah halaman. UI dan tipografi dokumen terpisah.

Pemulihan data cache tidak sama dengan service worker untuk membuka aplikasi dari nol saat jaringan benar-benar mati. Pekerjaan service worker tetap terpisah; UI tidak menjanjikan generate atau simpan server saat offline.

## Pemeriksaan perubahan berikutnya

Jalankan `npm test` dan `npm run test:ui`, lalu build dengan konfigurasi Convex proyek. Periksa tema terang/gelap pada 320, 360, 390, 414, 768, dan 1280 px. Uji nama panjang, pencarian kosong, nol absen, generator gagal, offline/reconnect, konflik, storage penuh, dan login kedaluwarsa.

Preview PDF harus merender isi berkas pada canvas menggunakan PDF.js; jangan
mengandalkan iframe/plugin PDF browser. Sediakan paging, pembesaran dan teks
untuk pembaca layar. Tes harus memeriksa piksel dokumen yang dirender, bukan
hanya memeriksa atribut src berisi blob URL.
