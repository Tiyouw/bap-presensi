# Persiapan kelas yang utuh

Alur persiapan sekarang terdiri dari lima tahap:

1. Identitas: simpan kelas sebagai draf.
2. Mahasiswa: impor atau tambahkan mahasiswa, lalu lanjut ke Jadwal.
3. Jadwal: tambahkan pertemuan dan edit tanggalnya langsung.
4. Template & preview: periksa PDF otomatis, edit bila diperlukan, lalu simpan.
5. Tinjau & aktifkan: periksa ringkasan, lengkapi bagian yang kurang, lalu aktifkan.

Tombol lanjut berada di atas konten. Navigasi tahap tetap dapat dipakai untuk
kembali dan mengoreksi data sesuai izin kelas. Aktivasi hanya ditawarkan pada
tinjauan akhir; sesudah aktif, aplikasi membuka daftar pertemuan untuk presensi.
Pengaman perubahan yang belum disimpan dan pemeriksaan akses server tetap berlaku.

## Perubahan utama

| Bagian | Perilaku baru |
| --- | --- |
| Semua unggahan | Area seret/lepas dan tombol pilih file. Validasi format dan batas ukuran tetap berlaku. Drop di luar area tidak membuka file dan meninggalkan editor. |
| Mahasiswa | Pagination 10/25/50, pencarian mengembalikan halaman pertama, dan aksi lanjut tidak berada di akhir daftar. Preview impor juga memakai pagination dan konfirmasi di atas tabel. |
| Jadwal | Kelas kosong langsung memperlihatkan form tambah pertemuan. Tanggal dapat diedit per baris tanpa memilih kumpulan sesi atau memasukkan jumlah hari pergeseran. |
| Pemulihan | File draf dan status pekerjaan berada dalam bagian tertutup yang menjelaskan bahwa file berasal dari unduhan draf aplikasi. Perubahan terputus tetap dapat dilanjutkan dan hasilnya dapat dipulihkan melalui revisi. |
| Kalender | Dialog aplikasi, navigasi bulan/tahun, panah keyboard, pilihan hari, Escape untuk batal, input ISO manual dan kesalahan di dekat input. Semua Field tanggal memakai komponen yang sama. |
| Template | Preview otomatis dari konfigurasi editor, tanpa menyimpan. Status membaca logo, menyiapkan/memperbarui PDF, dan menyimpan ditampilkan. Respons preview yang terlambat diabaikan. |
| Tinjauan | Ringkasan identitas, mahasiswa, jadwal dan template, dengan tautan perbaikan. Pemeriksaan server tetap menentukan apakah kelas dapat diaktifkan. |

Banner pengenalan tidak bersaing dengan langkah persiapan. Bantuan melalui ikon
(?) tetap tersedia. Pada persiapan template, judul tidak diulang, editor dan
riwayat dapat dibuka saat diperlukan, dan PDF satu halaman tidak menampilkan
kontrol pindah halaman yang tidak berguna.

## Implementasi dan kompatibilitas

Preview menerima konfigurasi opsional dan memvalidasinya setelah pemeriksaan
akses kelas. Query tetap hanya membaca: preview tidak mengubah draf, versi terbit,
arsip atau revisi. Tanggal contoh memakai pertemuan praktikum terbuka pertama;
kelas tanpa pertemuan juga tetap dapat menampilkan contoh.

Penyimpanan tanggal memakai protokol revisi yang sudah ada, termasuk preview
selisih, pengamanan revisi bersamaan, kunci operasi dan pekerjaan yang dapat
dilanjutkan. Penghapusan tetap terbatas pada sesi kosong; sesi bersejarah melalui
editor rincian yang mempertahankan riwayat.

CSV dan XLSX tetap didukung. XLS biner ditambahkan dengan SheetJS 0.20.3 dari
[distribusi resmi](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/),
dimuat hanya ketika membaca XLS. NIM dengan nol di depan dipertahankan.

## Bukti visual dan validasi

Base sebelum perubahan: `0334d0009814809b18bc1c6223ba049c769a1319`.
Screenshot berasal dari aplikasi sebenarnya dengan data sintetis yang sama:
Admin Demo, Kelas Persiapan Demo, 93 mahasiswa QA dan satu pertemuan contoh.
Desktop 1280×900 dan HP 390×844, tema terang dan reduced motion. Gambar jadwal
awal diambil sebelum penambahan pertemuan; gambar template setelah penambahan
pertemuan yang sama pada kedua versi.

`validation.json` mencatat hasil regresi dan ulangan terarah setelah perapian UI.
Uji mencakup Chromium/WebKit, aksesibilitas otomatis, 320/390/1280 px, tema
terang/gelap, teks 200%, pemulihan setelah reload, akses kelas dan preview tanpa
penyimpanan. Generator PDF pada fixture memakai renderer produksi dengan data
sintetis. Uji manusia dengan NVDA/VoiceOver dan calon pengguna belum dilakukan.
