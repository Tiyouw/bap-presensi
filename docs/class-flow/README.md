# Alur kelas A dan dialog aplikasi

Setelah `Simpan & lanjut ke Mahasiswa`, kelas draf yang berhasil disimpan langsung
membuka tab Mahasiswa. Pesan sukses tidak membutuhkan konfirmasi. Penanda langkah
menunjukkan bagian yang sedang dibuka. Jika mahasiswa aktif sudah tersedia dan
akun memiliki izin jadwal, tombol `Lanjut ke Jadwal` membantu langkah berikutnya.
Kelas tetap draf sampai syarat aktivasi diperiksa.

Akar masalah sebelumnya: redirect dilakukan di dalam callback penyimpanan, saat
navigation guard masih menganggap form sedang sibuk. Sekarang redirect menunggu
state penyimpanan selesai dan keputusan navigasi lain berakhir. ID hasil simpan
diterima sementara oleh router sampai katalog menyusul; detail tetap diperiksa
oleh query server dan akses kelas. Klik simpan berulang tidak membuat kelas ganda.

Seluruh 11 pemanggilan alert/confirm JavaScript dalam aplikasi diganti dengan
dialog berukuran maksimum 420 px. Keputusan punya label sesuai tindakan,
fokus keyboard terkurung di dialog teratas, Escape membatalkan, dan fokus kembali
ke pemicu. Dialog tidak menumpuk dan membatalkan keputusan bila editor pemicunya
hilang. Editor di belakang dialog tetap menyimpan isinya ketika dibatalkan.

Peringatan saat menutup/reload tab dengan perubahan belum disimpan tetap memakai
mekanisme `beforeunload` milik browser. Browser tidak mengizinkan penggantian
peringatan penutupan tab tersebut dengan dialog HTML; ini terpisah dari popup
alert/confirm dalam aplikasi yang sudah dihapus.

## Bukti visual

Base aktual: `3d5453c337dd5f5fd34df4bc07fb9f8210dd33a4`.
Screenshot memakai aplikasi sebenarnya dengan akun dan data sintetis Admin Demo,
tema terang/reduced motion. Desktop 1280 × 900; HP 390 × 844.
Form dan isi draf pada pasangan sebelum/sesudah sama.

## Verifikasi

`npm run test:class-flow` menguji Chromium dan WebKit: pembuatan kelas tunggal,
katalog terlambat, perpindahan saat simpan, editor mahasiswa bertumpuk, pembatalan,
Back/Forward dan Back berulang, gagal simpan, fokus, tema terang/gelap, lebar
320/390/1280, teks 200%, axe dan ketiadaan alert/confirm native.

Regresi menyertakan presensi, koreksi, jadwal, pengelolaan akses, sidebar,
bantuan, offline dan dokumen. Hasil lengkap lokal tersedia di
`out/audit/verification/results.json` setelah pemeriksaan selesai.
Uji manual pembaca layar dan pemahaman calon pengguna belum dilakukan.

Hasil: 27 suite regresi lulus, lalu 40 pemeriksaan bantuan dan 12 pemeriksaan
alur kelas lulus pada run terpisah. Ulangan alur kelas juga memeriksa posisi
dialog tepat di tengah setelah perapian CSS. Lihat `validation.json`.

Untuk pasangan screenshot dialog, gambar sebelum menampilkan form setelah
confirm native dibatalkan; popup browser tidak tercakup pada screenshot halaman.
Isi draf yang ditampilkan sama dengan gambar sesudah.
