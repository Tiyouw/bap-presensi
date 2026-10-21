# PRD & rencana implementasi sidebar

Versi 1.0 · 21 Oktober 2026

Status: diimplementasikan di branch sidebar; menunggu review PR/preview pengguna.
Prototipe awal memiliki glitch; implementasi memakai geometri panel tetap dan pengujian regresi terpisah.

## 1. Keputusan produk

Sidebar desktop awalnya terbuka seperti sidebar biasa. Tombol bergambar panel di
bagian bawah mengubahnya menjadi rail ikon dengan mode hover. Saat kursor masuk
area sidebar, label terbuka sementara; saat keluar, sidebar kembali ringkas.
Tombol yang sama menyematkan sidebar agar terbuka permanen kembali.

Hamburger hanya digunakan untuk membuka drawer pada tampilan mobile. Desktop
tidak memakai hamburger atau tombol silang untuk expand/collapse. Pencarian global
tetap di header. Menu yang ditampilkan tetap menu utama, tanpa pohon/submenu kelas.

Karakter visual mengikuti Kontras: bidang datar, sudut kecil, teks jelas, ikon
garis yang konsisten, tema terang hijau hutan dan tema gelap charcoal/lime.

## 2. Tujuan dan cakupan

- Memudahkan Centa mengenali tujuan setiap menu melalui ikon dan label.
- Menambah ruang kerja tanpa menghilangkan akses navigasi.
- Menjaga panel stabil ketika kursor bergerak, klik menu, atau memakai keyboard.
- Mempertahankan alur presensi, pencarian, dialog, izin akun, dan navigasi saat ini.

Menu: Beranda, Matkul & kelas, Dokumen BAP, Akun & akses sesuai izin admin, serta
Pengaturan. Bantuan & panduan dan tombol panel berada di bawah. Ikon semantik:
rumah, buku, dokumen, pengguna, pengaturan, bantuan, dan panel kiri.

Mode Panggil tetap di header halaman Presensi sesuai plan terpisah. Sidebar juga
tersedia di halaman Presensi pada desktop; jangan menyembunyikannya diam-diam.
Tidak ada kebutuhan mutation, tabel database, atau perubahan format dokumen BAP
untuk pekerjaan ini.

## 3. Keadaan dan transisi

Pisahkan preferensi permanen dari keadaan sementara:

- `pinned`: terbuka permanen; default `true` untuk akun yang belum punya preferensi.
- `pointerInside`: kursor berada dalam area sidebar desktop.
- `keyboardWithin`: pengguna menavigasi sidebar dengan keyboard.
- `mobileOpen`: drawer mobile sedang terbuka; selalu mulai tertutup.
- `overlayActive`: dialog aplikasi sedang mengambil alih interaksi.

Desktop menampilkan panel penuh jika `pinned`, atau jika mode hover sedang terbuka
karena pointer/keyboard. Hover tidak mengubah preferensi `pinned`.

| Keadaan | Tampilan | Perilaku |
|---|---|---|
| Disematkan | Ikon + label, lebar 240 px | Konten menyediakan ruang 240 px |
| Mode hover, tertutup | Rail ikon 72 px | Konten menyediakan ruang 72 px |
| Mode hover, terbuka sementara | Panel 240 px di atas konten | Posisi konten tetap; tanpa backdrop gelap |
| Mobile, tertutup | Sidebar tersembunyi | Hamburger di header |
| Mobile, terbuka | Drawer hingga 280 px | Backdrop, fokus terkurung, scroll halaman dikunci |

Klik tombol bawah mengubah `pinned`. Dalam keadaan disematkan, label tombol
"Mode hover"; dalam mode hover, "Sematkan sidebar". Ikonnya tetap panel kiri.
Klik saat pointer masih di sidebar boleh mempertahankan panel terbuka sementara;
panel baru ringkas setelah pointer keluar. Ini perilaku yang diharapkan.

Pilihan disimpan lokal per ID akun dan versi preferensi. Kegagalan atau nilai
storage yang rusak memakai default terbuka tanpa menghalangi navigasi. Hover,
fokus, dan drawer tidak ditulis ke storage. Akun lain tidak mewarisi preferensi.

## 4. Perbaikan hover yang wajib

Glitch dalam prototipe harus direproduksi dan dihilangkan sebelum PR siap review.
Fokus pemeriksaan: batas hit area yang berubah saat animasi, label yang mengubah
tinggi baris, ikon yang berpindah, dan fokus yang membuat panel terus terbuka.
Ini kandidat penyebab untuk diperiksa, bukan hasil diagnosis implementasi produksi.

Aturan implementasi:

1. Rail dan panel merupakan satu komponen navigasi dengan DOM dan key menu stabil.
   Jangan mengganti daftar menu atau memasang ulang elemen saat hover berubah.
2. Area panel yang sedang terbuka termasuk area hover. Berpindah dari rail ke label
   atau tombol bawah tidak boleh memicu tutup-buka. Jangan sisakan celah hit area.
3. Dalam mode hover, kolom layout tetap 72 px. Hanya panel visual yang membuka di
   atas konten. Perubahan ruang konten hanya terjadi ketika mengubah `pinned`.
4. Posisi ikon dan tinggi baris tetap sama saat label dibuka/disembunyikan. Sediakan
   ruang tetap untuk judul kelompok agar menu tidak meloncat secara vertikal.
5. Layout bagian dalam panel tetap selebar 240 px; sembunyikan label dengan clipping
   dan opacity sehingga teks tidak membungkus ulang selama transisi.
6. Gunakan area induk untuk pointer enter/leave, bukan handler di setiap ikon/label.
   Bedakan pointer mouse dari sentuhan; tap tidak boleh dianggap hover permanen.
7. Titik awal penalaan: delay buka sekitar 100 ms, tutup 180 ms, transisi 160 ms.
   Batalkan timer tutup ketika pointer kembali. Nilai boleh disetel setelah QA;
   kestabilan dan respons lebih penting daripada mempertahankan angka tersebut.
8. Timer dan transisi harus aman saat kursor bolak-balik, tombol ditekan cepat,
   route berganti, breakpoint berubah, dialog dibuka, dan komponen dilepas.
   Tidak boleh ada callback lama yang membuka kembali panel.
9. Fokus dari klik mouse pada tombol panel tidak boleh menahan panel terbuka
   setelah pointer keluar. Fokus navigasi keyboard memang mempertahankan label.
10. Animasi tidak mengubah scroll halaman atau posisi target yang sedang diklik.
    Hindari animasi lebar grid pada setiap hover. Hormati reduced motion dengan
    menghilangkan gerak; perubahan keadaan tetap jelas.

Panel hover bukan modal: jangan memasang `aria-modal`, backdrop, focus trap, atau
membuat konten utama inert. Konten tetap dapat digunakan ketika pointer keluar.
Dialog seperti pencarian, logout, panduan, dan Mode Panggil mempunyai prioritas
lapisan lebih tinggi; tutup panel sementara dan batalkan timer ketika dialog dibuka.
Setelah dialog ditutup, hitung ulang kondisi pointer/fokus yang sebenarnya.

## 5. Responsif dan perangkat sentuh

- Target awal: lebar viewport CSS sampai 640 px memakai drawer mobile; mulai 641 px
  memakai sidebar desktop. Jangan memakai cutoff 900 px yang membuat preview
  desktop sedang selalu tampil sebagai hamburger.
- Verifikasi header dan isi pada rentang 641–900 px. Ringkas konteks kelas/header
  secara responsif bila perlu; pencarian dan menu akun harus tetap dapat diakses.
- Drawer mobile selebar `min(280px, viewport - 32px)`. Header mempertahankan tombol
  cari dan akun. Drawer menyediakan tombol tutup yang berlabel jelas.
- Mobile tidak mengandalkan hover atau rail ikon. Backdrop, Escape, dan tombol
  tutup mengembalikan fokus ke pemicu; navigasi berhasil memindahkan fokus ke judul.
- Ketika keluar dari breakpoint mobile, tutup drawer dan pulihkan preferensi desktop.
  Jangan mengubah preferensi desktop hanya karena membuka menu di HP.
- Pada perangkat sentuh dengan viewport desktop, rail tetap bisa dinavigasi dan
  tombol bawah dapat menyematkan label. Tidak ada aksi penting yang hanya tersedia
  melalui hover. Target sentuh sekurangnya 44 px, menu utama ditargetkan 48 px.

## 6. Keyboard dan aksesibilitas

- `⌘B` di Mac dan `Ctrl+B` di Windows/Linux mengubah sematkan/mode hover desktop.
  Pada mobile shortcut membuka/menutup drawer. Label shortcut mengikuti platform.
- Abaikan shortcut saat mengetik pada input, textarea, select, contenteditable,
  proses IME, dialog aktif, kombinasi Alt/Shift, dan key repeat.
- Pertahankan `⌘K`/`Ctrl+K` pencarian global. Jangan mengambil shortcut browser lain
  atau shortcut 1–4, panah, Enter milik Mode Panggil.
- Tab/Shift+Tab mengikuti urutan native. Saat fokus keyboard masuk rail, tampilkan
  label dan pertahankan sampai fokus meninggalkan sidebar. Desktop tidak menjebak fokus.
- Escape menutup drawer/dialog teratas terlebih dahulu. Pada panel hover dengan
  fokus keyboard, Escape memindahkan fokus ke pemicu pencarian di header agar panel
  dapat ringkas; jangan otomatis membuka atau mengubah preferensi sematkan.
- Gunakan link asli dengan `href` untuk navigasi; Cmd/Ctrl+klik dan buka tab baru
  tetap bekerja. Tombol dipakai untuk toggle dan bantuan.
- Ikon dekoratif `aria-hidden`; nama link tetap tersedia saat label visual tersembunyi.
  Gunakan `aria-current="page"` untuk menu aktif dan `aria-pressed` pada toggle
  sematkan. Hamburger memakai `aria-expanded` dan `aria-controls` drawer.
- Fokus terlihat jelas dalam dua tema. Jangan mengumumkan setiap pointer hover
  lewat live region; pengumuman cukup untuk perubahan mode oleh pengguna.

## 7. Integrasi aplikasi

Lokasi implementasi utama: `src/components/Workspace.jsx` dan `src/management.css`.
Ekstrak komponen sidebar, ikon bersama, atau hook preferensi jika membantu menjaga
logika tetap terbaca. Jangan menambah framework UI hanya untuk sidebar ini.

Sumber menu dan pemeriksaan peran tetap mengikuti navigasi yang ada. Pertahankan
penanda aktif di route turunan. Tab Mahasiswa/Jadwal/Template/Pertemuan tetap pada
halaman kelas, bukan dipindah ke submenu sidebar.

Pertahankan navigation guard draf presensi. Jika pengguna membatalkan perpindahan
halaman, tetap pada halaman semula dan jangan menampilkan keadaan seolah navigasi
berhasil. Drawer ditutup mengikuti route yang benar-benar berubah. Pencarian global,
menu akun, dialog logout, skeleton, dan isi draf tidak boleh di-reset oleh hover.

## 8. Urutan pengerjaan

1. Ambil screenshot base PR desktop/HP dengan data sintetis dan catat perilaku lama.
2. Bangun shell, ikon menu, state sematkan, dan preferensi lokal tanpa animasi.
3. Implementasikan panel hover dengan geometri tetap, fokus keyboard, dan pembatalan
   timer. Reproduksi jalur kursor yang memicu glitch sebelum menambahkan gerak.
4. Tambahkan transisi pendek dan reduced motion setelah interaksi stabil.
5. Lengkapi drawer mobile, fokus, backdrop, breakpoint, shortcut, dan lapisan dialog.
6. Jalankan pengujian terarah serta build; cek regresi navigasi/presensi yang terdampak.
7. Lampirkan screenshot sebelum–sesudah inline pada PR sesuai `AGENTS.md`, ditambah
   rekaman singkat hover karena glitch gerak tidak dapat dibuktikan screenshot saja.
8. Sediakan preview yang bisa diakses untuk review pengguna. Buat/perbarui PR sesuai
   branch pekerjaan; jangan merge sebelum instruksi baru dari pengguna.

## 9. Kriteria penerimaan dan bukti QA

- Kunjungan pertama: desktop terbuka tanpa hamburger; mobile tertutup dengan hamburger.
- Toggle bawah: terbuka → mode hover → terbuka permanen; reload mengingat preferensi.
- Hover membuka label tanpa perubahan posisi konten. Keluar menutup dengan stabil.
- Gerakkan pointer masuk/keluar sedikitnya 20 kali, termasuk secara diagonal dari
  ikon ke label, antar-menu, ke footer, dan sepanjang batas panel: tanpa flicker,
  menu meloncat, salah klik, panel macet, atau timer terlambat membuka kembali.
- Dalam mode hover, posisi konten setelah transisi sama sebelum/sesudah hover;
  perubahan paling banyak 1 CSS px karena pembulatan. Header dan scroll tidak bergeser.
- Klik toggle cepat berulang dan lakukan navigasi saat transisi: keadaan akhir
  konsisten dengan aksi terakhir, tidak menelan klik atau memindah fokus tiba-tiba.
- Fokus dari mouse tidak membuat panel melekat; fokus keyboard membuka label.
  Tab, Shift+Tab, Escape, Cmd/Ctrl+B, serta Cmd/Ctrl+K bekerja sesuai konteks.
- Dialog pencarian/logout/panduan dan Mode Panggil berada di atas sidebar; sidebar
  tidak mencuri fokus atau menerima shortcut ketika dialog tersebut aktif.
- Akun non-admin tidak mendapat menu Akun & akses. Membuka route turunan tetap
  menandai menu induk dengan benar. Guard draf presensi tetap bekerja.
- Mobile: buka, backdrop, Escape, tombol tutup, navigasi berhasil/batal, scroll lock,
  dan rotasi/resize tidak meninggalkan drawer atau lapisan transparan yang memblokir.
- Uji 320, 390, 640, 641, 768, 1024, dan 1280 CSS px; tema terang/gelap; teks/zoom
  200%; label panjang; reduced motion; storage tidak tersedia; akun berganti.
- Uji Chromium dan WebKit. Verifikasi shortcut Meta dengan simulasi Mac, lalu review
  nyata di Safari/Mac jika tersedia; jangan mengklaim Mac fisik hanya dari WebKit.
- PR memuat sebelum–sesudah dari layar, data, viewport, dan tema yang sama, mencakup
  desktop serta HP. Gunakan data sintetis. Sertakan rekaman hover dan URL preview.

## 10. Acuan dan batas persetujuan

Acuan visual: screenshot Cloudflare dari pengguna dan ikon panel kiri yang dilampirkan.
Acuan eksplorasi terakhir: `sidebar-hover.html` dalam direktori visualisasi percakapan.
Perilaku yang disetujui tercatat dalam dokumen ini; glitch prototipe tidak diterima
sebagai perilaku final. Perubahan dirilis melalui PR dan preview sebelum persetujuan merge.

## 11. Implementasi dan reproduksi QA

- `src/components/Sidebar.jsx`, `Sidebar.css`, dan `WorkspaceIcon.jsx`: panel, ikon,
  label, tombol sematkan, serta drawer mobile. Lebar panel dalam selalu 240 px;
  clipping membuka/menutup label tanpa reflow konten. Hit area tetap terbuka sampai
  transisi tutup selesai agar pointer dapat kembali tanpa celah.
- `src/lib/useSidebar.js`: preferensi per akun, timer, breakpoint, fokus, scroll lock,
  dan prioritas dialog. Dialog standar `role="dialog" aria-modal="true"` termasuk
  Mode Panggil otomatis menangguhkan hover dan shortcut sidebar. Tidak perlu mengubah
  kode editor presensi untuk berintegrasi dengan sidebar.
- `npm run test:sidebar`: dua browser, 20 siklus hover per browser dengan animasi
  aktif, geometri/DOM stabil, toggle cepat, key repeat, shortcut Meta/Ctrl, mode
  reduced motion, modal, input, drawer/fokus, akun/peran, dan kegagalan storage.
- `node scripts/ui/sidebar.cjs --capture`: screenshot base PR aktual `b1c7ee1`
  dan after, data sintetis sama, desktop/HP, tema terang/gelap.
- `node scripts/ui/capture-sidebar-motion.cjs`: merekam interaksi browser asli pada
  fixture sintetis dan mengekspor GIF. Membutuhkan ffmpeg dari instalasi lokal.
- Bukti gambar/rekaman ada di `docs/sidebar/`; hasil detail lokal di `out/sidebar/`.
  Pengujian otomatis WebKit bukan klaim penggunaan Mac/Safari fisik.
