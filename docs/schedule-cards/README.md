# Jadwal dengan kartu lipat dan penyimpanan bersama

Kartu baru tetap tertutup saat ditambahkan. Pengguna dapat menambah beberapa kartu,
membuka kartu yang ingin dikoreksi, lalu menyimpan kartu baru sekaligus. Ikon hapus
berada di luar sudut kanan atas kartu (pilihan C), terpisah dari area buka/tutup.

- Kartu pertama memakai hari ini di Asia/Jakarta. Kartu baru berikutnya mengikuti
  tanggal kartu sebelumnya +7 hari, termasuk pergantian bulan, tahun dan tahun kabisat.
- Mengubah tanggal tidak menggeser kartu yang sudah ada. Tanggal terakhir yang belum
  valid harus diperbaiki sebelum menambah kartu berikutnya.
- Umumnya 16 pertemuan. Penambahan ke-17 dan seterusnya memakai dialog aplikasi
  dengan pilihan Tetap tambah/Batal. Batas teknis 100 sesi aktif tetap berlaku.
- Draf boleh disusun saat offline. Penyimpanan memerlukan koneksi dan izin jadwal.
- Tombol belum siap tetap dapat difokuskan dan diklik untuk penjelasan. Aksi perbaikan
  mengarahkan ke isian yang kurang atau area penyimpanan.
- Kembali ke atas muncul saat aksi penyimpanan keluar layar. Toast berada di atasnya
  agar tidak menutupi tombol tersebut.

## Penyimpanan dan kompatibilitas

Mutation `meetingCommands.addMeetings` memvalidasi semua kartu terlebih dahulu, lalu
membuatnya dalam satu transaksi. Nomor harus unik, semua tanggal valid, dan jumlah
sesi aktif tidak melampaui 100. Revisi kelas diperiksa; akses server mengikuti
capability jadwal pada kelas tersebut. Tidak ada perubahan schema atau migrasi.

Permintaan lengkap beserta kunci idempotensi disimpan di perangkat sebelum dikirim.
Jika hasil respons tidak diketahui, editor menahan perubahan dan menawarkan
Periksa & coba simpan lagi. Reload dan retry mengirim permintaan yang sama; respons
operasi yang sudah diterima dipakai kembali tanpa membuat pertemuan ganda.
Permintaan yang ditolak server secara definitif dapat disunting ulang. Jika penyimpanan
lokal permintaan gagal, data belum dikirim ke server.

Draf jadwal versi lama tetap terbaca. Ekspor/impor draf dan pemulihan pekerjaan revisi
lama tetap tersedia. Tanggal sesi tersimpan memakai protokol preview/revisi yang
sudah ada; sesi bersejarah tetap melalui Edit rincian. Penghapusan sesi tersimpan
memerlukan konfirmasi dan pemeriksaan server bahwa sesi benar-benar kosong.

Tombol lanjut persiapan kelas juga memberi alasan ketika belum siap. Penanganan klik
memisahkan perpindahan tahap dari submit form agar render tahap berikutnya tidak
menjalankan submit kedua dari klik yang sama.

## Bukti visual

Before berasal dari base aktual `58ab0072d85b9777488e61c6fb0a2367e05b63b2`.
Kedua versi memakai Kelas Demo, tiga sesi sintetis yang sama (26 Oktober,
2 November dan 9 November 2026), ruang F6, tanpa presensi; keadaan kosong memakai
fixture yang sama tanpa sesi. Semua data contoh sintetis.

Viewport desktop 1280×900 dan HP 390×844, tema terang, reduced motion. Screenshot
full-page memperlihatkan keadaan kosong dan jadwal terisi; pada versi kartu,
kartu kedua dibuka untuk memperlihatkan editor. Versi lama langsung menampilkan
semua tanggal pada baris. Bukti validasi terperinci dicatat di `validation.json`.

Uji UI memakai fixture lokal yang memanggil handler backend sebenarnya, bukan data
produksi. Uji respons hilang memakai kegagalan transport sintetis sesudah handler
menerima transaksi, lalu reload dan retry. Ini tidak diklaim sebagai uji jaringan
produksi, pembaca layar manusia, atau uji pemahaman pengguna.
