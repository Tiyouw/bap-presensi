# Mode Panggil — Kartu Geser + Keyboard

Implementasi pada branch `codex/mode-panggil`, berangkat dari merge PR #6,
`b1c7ee1c86f0fe90134c42a95c169f3585ab0a9e`. Target rilis PR/preview untuk review;
tidak melakukan merge atau migrasi produksi.

## Perilaku

Tombol sekunder **Mode Panggil** berada di header halaman presensi, setelah
identitas/status dan sebelum ringkasan kehadiran. Daftar tetap layar awal. Kartu
menggunakan seluruh roster snapshot sesi, tanpa mengikuti pencarian/golongan di
daftar. Dialog desktop maksimal 540 px, HP mengisi viewport dan dapat digulir;
header tutup tetap terlihat.

- **1 Hadir, 2 Alpha, 3 Sakit, 4 Izin**, panah kiri sebelumnya, kanan/Enter berikutnya
  setelah memilih, Escape tutup. Tombol sentuh tersedia untuk semua aksi.
- Pilihan memberi warna status dan cap teks/ikon. Lanjut otomatis awalnya aktif,
  menunggu 700 ms; gerak keluar 160 ms dan masuk 220 ms. Reduced motion menonaktifkan
  gerak, mempertahankan warna dan cap. Preferensi auto diingat per akun/kelas.
- Sebelumnya dapat dipakai untuk koreksi. Key repeat dan klik ganda tidak mengisi
  beberapa nama. Navigasi manual, tutup, konflik dan unmount membatalkan timer.
- Ctrl/Cmd+K menyerahkan fokus ke pencarian global, menutup kartu tanpa membuang
  draf/posisi. Shortcut browser tidak diambil alih. Tab/Shift+Tab terkurung di dialog,
  penutupan mengembalikan fokus ke tombol Mode Panggil termasuk pada WebKit.
- Progres menghitung ID unik yang diperiksa, termasuk memilih Hadir yang sama dengan
  default. **Lewati dulu** tidak mengubah status atau menambah progres.
- Review memuat nama yang belum diperiksa beserta statusnya. Pengguna melanjutkan
  panggilan atau menyetujui secara eksplisit status daftar sebelum mengunci.
- Setelah seluruh nama diperiksa, membuka kembali langsung menuju review. Tidak ada
  mutation server dari pilihan kartu. Simpan & Kunci tetap mutation atomik editor.

## Data dan pemulihan

`src/components/ModePanggil.jsx` memakai status editor `Presensi.jsx` yang sama,
termasuk undo dan review. Metadata `panggil` (currentId, reviewedIds, started,
roster, revision) disimpan satu penulisan bersama status ke `bap.draft` yang sudah
terpisah per akun/kelas/pertemuan. Membuka dialog dan memulihkan draf tidak menulis
ulang draf; penulisan terjadi setelah interaksi yang mengubah data/progres.

Fingerprint roster memuat ID, NIM, nama, golongan dan urutan. Snapshot/revisi berbeda
membatalkan progres lama. ID asing/duplikat dibuang. Memuat server dan mengunci
menghapus progres yang lama; menerapkan draf konflik tidak memulihkan progres pada
revisi berbeda. Preferensi auto terpisah dari draf supaya tetap diingat setelah kunci.

Izin tulis, status terkunci, kelas arsip, konflik revisi dan sesi kedaluwarsa mengikuti
editor. Offline masih dapat mengedit draf yang tersedia; simpan server/generate
memerlukan koneksi. Kegagalan storage terlihat di kartu dan daftar; perlindungan
navigasi editor tetap berlaku untuk draf yang belum aman.

## Verifikasi

```sh
npm test
npm run build
npm run test:panggil
npm run test:ui
node scripts/ui/panggil.cjs --capture-only
```

- Unit Mode Panggil: invalidasi snapshot/revisi, ID unik, isolasi akun/kelas/sesi,
  metadata dalam draf yang sama dan kegagalan storage.
- UI kartu dengan React asli dan transport sintetis: alur 93 nama, tombol/keyboard,
  same-default Hadir, skip, koreksi, resume/refresh tanpa penulisan saat restore,
  Ctrl+K/fokus, auto/manual/timer, konflik, offline, storage gagal dan sesi habis.
- Chromium dan WebKit: 320/390/768/1280 px, dua tema, target sentuh minimal 48 px,
  teks 200%, nama panjang, perubahan snapshot dan reduced motion.
- Suite UI backend nyata menggunakan Convex QA `doting-horse-423` dengan data
  sintetis: Mode Panggil memakai roster kelas baru, selesai ke review, lalu alur
  undo/draf/offline/kunci/Word/PDF tetap bekerja. Backend produksi tidak dipakai.
- Suite regresi juga mencakup login, wizard, impor, pencarian, peran, PDF canvas,
  failure injection dan 208 kombinasi viewport/tema manajemen.

Hasil reproducible disimpan di `out/panggil/results.json` dan `out/management/`
(Git-ignored). Screenshot di `docs/mode-panggil/`, sebelum dari commit base di atas,
viewport dan data sintetis yang sama dengan sesudah. Screenshot kartu memperlihatkan
status Izin sebagai contoh. WebKit otomatis di Windows bukan pengujian iPhone/Mac,
VoiceOver atau printer fisik. Mode ini memakai animasi geser; gesture swipe untuk
memilih status bukan bagian rancangan yang dipilih.
