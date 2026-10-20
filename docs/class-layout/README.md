# Konsistensi layout tab kelas

Header kelas, navigasi tab, dan isi keenam tab memakai tepi konten yang sama.
Isi mengikuti lebar ruang kerja dengan gutter 40 px pada desktop, 24 px pada
viewport menengah, dan 16 px pada HP. Paragraf pengantar tetap dibatasi 65ch untuk
keterbacaan; pembatas lebar formulir tidak menentukan lebar seluruh tab.

Judul tab memakai `ClassTabHeading`: 22 px pada desktop / 20 px pada HP,
deskripsi berjarak 8 px, dan jarak setelah heading 24 px. Jarak dari navigasi tab
ke konten adalah padding body 24 px / 20 px pada HP, ditambah garis pemisah 1 px.
Counter dan aksi berada di kanan pada ruang cukup; tombol membungkus di HP.

## Reproduksi dan screenshot

`npm run test:class-layout` menjalankan fixture sintetis yang sama di Chromium dan
WebKit: enam tab × enam viewport × dua tema = 144 keadaan. Pengujian memeriksa
penjajaran tepi, jarak dan ukuran judul, lebar Pertemuan, overflow halaman,
perpindahan tab, dan filter pertemuan. Fixture tidak mengakses backend produksi.

`node scripts/ui/class-layout.cjs --capture` juga mengekstrak sumber base PR
`d321bcdf3bd5f550d7fc2194a1e76f1d93e1f813` dari Git ke `out/class-layout/base`.
Before dirender dari sumber base tersebut; after dari working tree. Keduanya
memakai fixture 93 mahasiswa sintetis, kelas aktif yang sama, 16 minggu,
tema gelap, dan reduced motion. Nama/NIM produksi tidak dipakai.

Screenshot berpasangan tersedia untuk semua tab desktop 1650×1050, tiga tab HP
390×844 (Pertemuan, Mahasiswa, Jadwal), dan Pertemuan lebar 3300×1408.
Screenshot memotret viewport tanpa memotong atau merekonstruksi UI.

Lebar 3300 CSS px memeriksa ruang layout setara viewport 1650 px saat zoom browser
50%. Ini pengujian viewport CSS lebar, bukan klaim pengoperasian kontrol zoom Codex
atau pengujian Mac fisik. WebKit berjalan otomatis di lingkungan pengujian.
