# Jadwal praktikum

Koreksi dari Marchaenta: minggu 1 hanya teori, praktikum minggu 2–7 dan 9–15,
minggu 8 UTS, minggu 16 UAS. Total **13 sesi praktikum** dalam 16 minggu.
Nomor pertemuan tetap mengikuti minggu semester; praktikum pertama tetap nomor 2.
Tanggal yang sudah tercatat tidak digeser.

Minggu teori tetap terlihat di daftar dengan label “Teori saja / Tanpa praktikum”.
Teori, UTS, dan UAS tidak bisa dibuka untuk presensi atau dipilih untuk BAP.
Rekomendasi pertemuan, filter, dan penghitung progres hanya memakai sesi praktikum.
Server juga menolak simpan, buka kunci, klaim generator, generate BAP, dan paket
cetak untuk minggu tanpa praktikum. Maksimum paket cetak menjadi 13 pertemuan.

## Kompatibilitas data lama

Seed baru menyimpan minggu 1 sebagai `TEORI`. Database yang sudah berisi data
tidak di-seed ulang: `bap-shared/jadwal.js` mengartikan record minggu 1 lama
(`REGULER`, termasuk jika sudah terkunci) sebagai teori saat dibaca dan divalidasi.
Frontend menerapkan aturan yang sama pada cache offline lama. Tidak diperlukan
migrasi yang menghapus, menomori ulang, atau mengubah revisi presensi.
ID, tanggal, presensi, audit, dokumen tersimpan, serta draf lokal lama tetap utuh;
catatan minggu 1 tidak disertakan dalam progres maupun daftar cetak praktikum.
Dokumen lama tidak ditarik kembali dari perangkat yang sudah mengunduhnya.

## Verifikasi

- `npm test`: jadwal 13 sesi, penolakan semua operasi teori/ujian, arsip lama
  tetap utuh, aturan revisi/peserta, wiring API, serta struktur DOCX.
- `npm run test:ui`: teori/UTS/UAS dinonaktifkan, filter/progres 13 sesi,
  cache offline lama tetap aman, serta regresi presensi, panduan, login, dan cetak.
- `npm run build`: build frontend produksi.
- Screenshot di `docs/jadwal/`: kode sebelum dari commit `ac4d5cc`, kode sesudah
  memakai data sintetis yang sama (minggu 1 dan 2 terkunci), tema gelap,
  390 × 844 dan 1280 × 900. Data minggu 1 lama sengaja dipertahankan dalam fixture.

Deployment backend melalui alur Convex/Vercel proyek setelah merge.
