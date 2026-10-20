# Migrasi Management v2

PR ini belum di-merge. **Jangan menjalankan migrasi produksi sebelum review.**
Project: `tiyouw-s-projects:yo-urconvex`; produksi `fiery-gecko-814`;
QA terpisah `dev/management-v2` (`doting-horse-423`).

## Sebelum produksi

1. Jeda presensi, catat commit/environment aplikasi lama. Export Convex termasuk
   storage dengan selector produksi eksplisit. Simpan ZIP privat, bukan dalam Git.
2. Catat ID peserta/pertemuan, revision/status, presensi/audit dan
   ID/storageId/sha256 dokumen. Periksa backup dapat dibaca.
3. Backup awal tugas di `out/backup-before-management-v2.zip`; buat backup baru
   saat rilis karena data produksi dapat berubah. Siapkan akses pemulihan admin.
4. Review PR, preview login, pengujian dan render sebelum deploy produksi.

## Transaksi migrasi

`migrate:initialize` adalah **internalMutation**, hanya pemilik deployment melalui
Convex CLI; tidak bisa dipanggil public API browser. Marker `management-v2`
menjadikannya idempoten. Pengulangan tidak menambah akun/kelas/peserta.

- Membuat matkul/kelas PPB Gasal2026/2027, template1, dua akun awal.
- Menautkan peserta/pertemuan/audit tanpa mengganti ID. Minggu1 menjadi TEORI.
- Mempertahankan presensi/status/revision, bapDoc/storageId/sha256.
- Membekukan snapshot sesi bersejarah; file arsip tidak ditulis ulang.
- Menghapus sesi password bersama lama. Data preview selalu sintetis.

Setelah persetujuan rilis: deploy schema/functions, jalankan
`scripts/setup-management.mjs` dengan selector produksi eksplisit, **tanpa demo**.
Gunakan output privat baru; serahkan password acak/kode pemulihan secara privat.
Kedua akun produksi wajib mengganti password awal.

## Verifikasi setelah migrasi

Bandingkan ID/isi/revision/hash arsip dengan backup. Saat audit awal:93 peserta,
16 pertemuan,5 baris bapDoc; ambil ulang angka aktual saat rilis. Periksa teori1,
UTS8/UAS16,13 praktikum, login/ACL, arsip lama, kunci/koreksi/cetak dan draf lama.
Build berhasil belum membuktikan migrasi selesai.

## Rollback

Jika belum ada transaksi v2 baru, jeda akses, pulihkan backup lengkap termasuk
storage pada deployment yang sudah diverifikasi, lalu deploy commit/environment
lama. Import dapat mengganti data: administrator harus memeriksa target, backup,
dan dokumentasi import versi CLI sebelum tindakan destruktif.

Jika sudah ada transaksi v2 baru, export lagi sebelum rollback; backup lama akan
menghilangkan pekerjaan setelah titik backup. Rekonsiliasi data baru atau perbaiki
maju. Jangan hanya menghapus kolom kelasId/snapshot atau menurunkan schema.

## Bukti pada PR ini

Backup produksi termasuk storage telah diekspor. Fixture migrasi menjalankan
handler dua kali dan memeriksa ID/revision/presensi/storageId/sha256 tetap utuh.
Integrasi nyata memakai QA terpisah. Produksi belum dimigrasikan.
