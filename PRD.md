# BAP Management v2

Status: siap direview melalui PR/preview; belum di-merge. Acuan: keputusan pengguna pada 20 Oktober 2026.
Tujuan: seluruh pengelolaan kelas sehari-hari dilakukan di aplikasi, tanpa coding
atau mengubah environment. Rilis mempertahankan presensi dan arsip PPB yang berjalan.

## 1. Pengguna dan hasil yang dituju

Tiyouw adalah admin awal. Marchaenta adalah pengelola kelas awal dan asdos bawaan.
Admin dapat mempromosikannya menjadi admin penuh. Dua akun awal bukan batas jumlah
akun. Tidak ada pendaftaran publik, verifikasi email, Google login, atau organisasi
multi-tenant. Login memakai username dan password individual.

Alur utama: masuk → pilih/buat kelas → masukkan mahasiswa → siapkan jadwal dan
template → isi/periksa/kunci presensi → unduh Word/PDF atau paket cetak.
Matkul adalah induk; setiap kelas/semester memiliki roster, jadwal, dosen, dan arsip
sendiri. Berhasil berarti dua kelas berbeda dapat dikelola tanpa data bercampur.

## 2. Peran dan akun

| Kemampuan                                    | Admin       | Pengelola kelas                 | Operator presensi |
| -------------------------------------------- | ----------- | ------------------------------- | ----------------- |
| Membuat matkul/kelas                         | Ya          | Ya                              | Tidak             |
| Mengubah roster, jadwal, identitas, template | Semua kelas | Kelas ditugaskan/dibuat sendiri | Tidak             |
| Presensi, koreksi, kunci, unduh, cetak       | Semua kelas | Kelas ditugaskan                | Kelas ditugaskan  |
| Akun, penugasan kelas, promosi akses, reset  | Ya          | Tidak                           | Tidak             |
| Profil dan ganti password sendiri            | Ya          | Ya                              | Ya                |

AUTH-01: Admin membuat akun dengan password sementara dan pengguna wajib
menggantinya sebelum bekerja. Tidak ada password di log, screenshot, Git, atau API
profil. Hash scrypt dengan salt acak; sesi individual dapat dicabut.
AUTH-02: Reset password/penonaktifan mencabut sesi akun. Perubahan akses diperiksa
server pada setiap permintaan. Admin aktif terakhir tidak dapat dinonaktifkan atau
diturunkan. Password salah dan username tidak dikenal memberi respons generik.
AUTH-03: Pembatasan percobaan login dan kode pemulihan admin sekali pakai. Pengguna
melihat/mencabut sesi sendiri. Konfirmasi logout dipertahankan.
AUTH-04: Setup awal terkontrol oleh administrator deployment, tanpa public signup.
Kredensial awal diserahkan dalam berkas lokal privat, bukan disertakan dalam PR.

## 3. Matkul, kelas, dan jadwal

CLS-01: CRUD matkul (kode/nama), kelas (nama, semester, tahun akademik, prodi, dosen,
identitas dosen, asdos, ruang). Penghapusan operasional menggunakan arsip, bukan
menghapus sejarah. Arsip dapat dipulihkan dan dibaca; operasi tulis ditolak.
CLS-02: Wizard kelas dapat disimpan dan dilanjutkan. Salin kelas menyalin pengaturan
dan template, tanpa roster secara default; opsi menyalin roster harus eksplisit.
CLS-03: Jadwal mingguan memakai tanggal mulai dan jumlah minggu, dapat ditinjau
sebelum disimpan. Default preset PPB: 16 minggu, 1 teori, 2–7/9–15 praktikum,
8 UTS, 16 UAS. Kelas lain boleh praktikum minggu 1. Tersedia LIBUR.
CLS-04: Setiap pertemuan dapat ditambah/dikoreksi nomor, tanggal, ruang, dan jenisnya.
Tanggal lokal YYYY-MM-DD; nama hari diturunkan dari tanggal. Nomor unik per kelas.
Sesi terkunci tidak diubah oleh editor jadwal; koreksi melalui buka kunci.

## 4. Mahasiswa dan impor

ROS-01: Roster per kelas: NIM (string, nol awal dipertahankan), nama, golongan bebas,
urutan, status aktif. NIM unik per kelas; boleh sama di kelas lain. Jumlah peserta
dan golongan tidak ditetapkan 93/A–D. Tambah, koreksi, nonaktifkan melalui UI.
ROS-02: Excel/CSV → pilih sheet → cocokkan kolom → preview baris dan masalah →
konfirmasi. Duplikat, NIM kosong, nama kosong, dan konflik data lama terlihat.
Import menambah/memperbarui secara eksplisit; tidak menghapus yang tidak ada di file.
Import atomik, bersifat idempoten terhadap NIM, dan mencatat actor serta ringkasan.
ROS-03: Importer memisahkan adapter sumber dari normalisasi/validasi dan commit.
Future adapter Google Sheets menggunakan jalur preview/commit yang sama.

## 5. Presensi, snapshot, dan arsip

ATT-01: Alur kuas Hadir/Alpha/Sakit/Izin, pencarian/filter, undo, review nama/status,
konflik baseRevision, simpan+kunci atomik, retry generator dipertahankan.
ATT-02: Praktikum saja dapat disimpan/dibuatkan BAP. Progres menghitung praktikum
kelas tersebut. Validasi seluruh peserta berdasarkan roster sesi, bukan roster global.
ATT-03: Saat pertama dikunci, simpan snapshot roster (ID, NIM, nama, golongan, urut),
identitas kelas/dosen, tanggal/ruang, dan versi konfigurasi template. Perubahan roster,
dosen, atau template kelas tidak mengubah sesi/dokumen terkunci sebelumnya.
ATT-04: Buka kunci mempertahankan snapshot untuk koreksi status, sehingga perubahan
roster tidak menyisipkan mahasiswa Hadir secara otomatis. Pengelola dapat menerapkan
pengaturan/roster terbaru secara eksplisit setelah review perubahan; simpan membuat
revisi baru. Riwayat revisi dan file terdahulu tetap tersedia.
ATT-05: Draf/cache terpisah per akun/kelas/pertemuan. Logout mempertahankan draf,
berganti akun tidak menampilkannya. Draf lama ditawarkan untuk diambil alih satu kali
oleh pengguna yang boleh mengakses kelas PPB. Offline mendukung draf/data yang telah
dicache; tidak menjanjikan simpan server, manajemen data, atau generate offline.

## 6. Template dan dokumen

DOC-01: Format resmi dengan formulir pengaturan: kop institusi, prodi, logo,
nama/kode matkul, semester, tahun, dosen/identitas, asdos/identitas, teks judul dan
blok tanda tangan. Tidak ada upload DOCX bebas, kode template, atau editor drag-drop.
DOC-02: Template memiliki draf, preview, terbitkan, dan histori versi per kelas.
Pratinjau PDF dihasilkan generator yang sama dengan unduhan, memakai contoh sintetis
sebelum kelas punya presensi. Versi terbit berlaku untuk sesi berikutnya.
DOC-03: Word dan PDF dari snapshot yang sama. PDF server memakai pdf-lib dan font
tertanam. Kop/logo/tabel/tanda tangan tetap terbaca. Layout folio 215 × 330 mm.
DOC-04: Arsip 1 form/halaman; paket 2 form/folio, hanya satu kelas. Satu form
menampung 12 tidak hadir, form lanjutan bernomor berkelanjutan. Form tidak dipotong
atau dikecilkan. Bila tinggi konten tidak muat, form berpindah halaman utuh; preview
menunjukkan jumlah halaman sebenarnya. Paket ganjil menyisakan bagian bawah kosong.
DOC-05: Identitas arsip menyertakan pertemuan, presensiRevision, templateVersion,
format dan mode layout. Generator idempoten; klaim gagal bisa pulih. Unduhan dilindungi
akses kelas. Riwayat BAP lama tidak ditimpa atau diklaim sebagai snapshot baru.

## 7. Navigasi dan pencarian

NAV-01: Navbar konsisten: brand/beranda, konteks kelas, pencarian global, bantuan,
profil. Sidebar/menu responsif: Beranda, Matkul & Kelas, Dokumen, Pengaturan; akun
khusus admin. Halaman penting mempunyai URL; Back/Forward bekerja.
NAV-02: Search navbar/⌘K/Ctrl+K; mobile panel penuh. Kelompok hasil: matkul/kelas,
mahasiswa, pertemuan/dokumen, fitur. Nama/NIM/kode/tanggal/nomor/sinonim fitur
didukung. Konteks matkul/kelas/semester terlihat, termasuk hasil nama sama.
NAV-03: Recent lokal per akun, saran ketika kosong, prioritas kelas aktif, opsi
kelas arsip. Hasil dibatasi izin server. Enter membuka tujuan, tidak melakukan aksi
destruktif. ↑↓, Enter, Escape, Tab, pengembalian fokus, VoiceOver labels; jangan ambil
alih ⌘F/Ctrl+F atau shortcut penyuntingan teks. Shortcut ditampilkan sesuai platform.
NAV-04: Gaya Kontras, dua tema, 48px target, tidak overflow 320–1280px/zoom 200%,
safe-area iOS, skeleton menunggu data, reduced-motion, status error/retry yang jujur.
Onboarding bisa dilewati, tidak berulang; panduan fitur manajemen bisa dibuka lagi.

## 8. Teknis dan migrasi

React/Vite + Convex dipertahankan. Session token dipetakan ke pengguna; ACL kelas
berlaku di query/mutation/action/internal document lookup, bukan hanya menu UI.
API kelas/peserta/jadwal/template/impor memeriksa role, akses kelas, versi perubahan,
dan status arsip. Tidak ada query global mengambil roster semua kelas ke browser.

MIG-01: Sebelum produksi, export Convex termasuk file storage ke ZIP privat. Catat
jumlah/ID/revisi/hash arsip sebelum dan sesudah. Backup tidak masuk Git.
MIG-02: Migrasi idempoten mengaitkan roster dan 16 minggu lama ke kelas PPB Gasal
2026/2027; minggu 1 TEORI. Pertahankan ID, status, revision, presensi, audit, storage.
Bekukan snapshot lama memakai data dan template legacy. Catat versi migrasi.
MIG-03: Akun Tiyouw ADMIN dan Marchaenta PENGELOLA dibuat sekali dengan password
sementara acak. Password bersama dan public seed dinonaktifkan setelah migrasi.
Build tidak memerlukan BAP_MAHASISWA_CSV atau file roster pribadi lagi.
MIG-04: Uji integrasi pada deployment nonproduksi terpisah dengan data sintetis;
tidak salin roster produksi ke preview. Uji migration dry-run/fixture dan pengulangan.
Simpan panduan rollback dan verifikasi akhir produksi sebelum menganggap selesai.

## 9. Pengujian dan rilis

TEST-01: Semua AUTH/CLS/ROS/ATT/DOC/NAV/MIG ditelusuri ke pengujian atau bukti runtime
di docs/VERIFICATION-V2.md. Unit/helper saja tidak membuktikan alur UI atau akses API.
TEST-02: Backend: dua kelas/akun, forged ID lintas kelas, semua role, promosi/demosi,
last-admin, password/reset/sesi/recovery, impor duplikat/konflik, perubahan roster dan
template setelah kunci, baseRevision, paket campur kelas, arsip, migrasi dua kali.
TEST-03: UI Chromium/WebKit: setup/login/password wajib, wizard/import mapping/error,
jadwal praktikum minggu 1, editor/preview/publish, PDF/Word/paket, search ⌘K dan
keyboard/focus, URL/Back, akses sesuai peran, logout, draft offline lintas akun,
reduced motion, 320/390/768/1280px, kedua tema, zoom 200%.
TEST-04: Render dan inspeksi Word/PDF 0/12/13/25/93 absen, nama/kop/dosen panjang,
logo beda, unicode, halaman ganjil, 1-form/2-form. Safari/WebKit bukan pengganti
klaim pengujian printer fisik; laporkan keterbatasan nyata.
TEST-05: README mencakup setup, role, alur penggunaan, import, template, backup,
migrasi, tes, dan future Sheets. Tiap PR UI berisi screenshot before–after asli
base, viewport sama, data sintetis. RALAT pengguna: jangan merge dahulu. Hasil akhir
berupa PR dan preview yang sudah terbukti dapat diakses/login. Migrasi produksi
disiapkan dan diuji di deployment terpisah; penerapan produksi menunggu review.

## 10. Rencana Google Sheets (belum bagian rilis v2)

Tempel URL Google Sheets → koneksi Google read-only untuk file privat → pilih tab
→ mapping → preview → impor. Tidak perlu publikasi spreadsheet. Tidak ada polling
atau sinkronisasi otomatis; reimport selalu melalui review. Simpan source type,
spreadsheet ID, sheet, mapping, dan import timestamp saat adapter ini ditambahkan.
Excel Online dapat memakai kontrak adapter yang sama. UI sekarang tidak menampilkan
tombol koneksi palsu; roadmap dijelaskan di bantuan dan README.
