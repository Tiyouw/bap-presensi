# Completion audit: kendali penuh BAP

Implementasi empat tahap siap untuk review sebagai PR draft #10–#13. Source runtime
diverifikasi dengan fingerprint `6ca34f152db83ee5444c4424eb93f2f3db3b116cf2dd141c62ea72ccf3a0951a`; seluruh 26 suite
lulus tanpa perubahan source selama pengujian. Bukti tersanitasi: [validation.json](full-control/validation.json).
Main/produksi belum diubah. U01–U08 audit UI/UX awal tetap terpisah.

| ID | Kriteria | Bukti aktual |
| --- | --- | --- |
| T01 | Koreksi tanggal tanpa reset data | Handler koreksi + browser publish; API native membandingkan seluruh status/roster/template/dosen. Word/PDF asli r1 21 Oktober dan r2 23 Oktober diverifikasi isi serta hash. |
| T02 | Arsip immutable dan metadata asal | Hash Word/PDF r1 tetap identik setelah koreksi, lifecycle, restore data, native browser, dan migrasi old main. Nomor asal legacy yang tidak terbukti ditandai belum terverifikasi. |
| T03 | Draf, buang draf dan storage gagal | Chromium/WebKit: reload, storage quota, unduh/muat draf, scope akun/kelas/server, Buang draf tanpa revisi server, serta blokir ulang operasi yang telah diterapkan. Pembersihan terlambat tidak menghapus draf lebih baru. |
| T04 | Konflik antar pengguna/perangkat/tab | CAS kelas/sesi dan hash preview; native dua commit bersamaan menghasilkan satu penulis. Rebase menjaga perubahan baru pengguna lain. Web Locks menjaga satu editor; pilihan grant tetap ada saat diubah aktor lain. |
| T05 | Retry aman dan rollback | Retry/double-click memakai operationKey yang sama. Probe native gagal setelah presensi delete/insert, ledger/proyeksi/kelas ditulis: transaksi memulihkan seluruh ID dan nilai. Probe sementara sudah dihapus. |
| T06 | Bulk jadwal terpilih | Unit + browser + native: subset +7/−7 hari, kabisat/pergantian tahun, preview stale, historical opt-in, job lintas request/reload, konflik, lewati yang tidak tersedia, cancel sisa dan undo kompensasi. |
| T07 | Batal/pulih dan rekap aktif | Lifecycle native/handler membandingkan status, jumlah praktikum/terkunci dan ringkasan cetak. Sesi batal keluar dari paket aktif; versi sebelum batal tetap dapat dicetak dengan revisionId. |
| T08 | Jenis pertemuan dua arah | Praktikum ↔ nonpraktikum mempertahankan data lama. UI/native meminta pulihkan presensi atau reset kosong secara eksplisit; reset tetap terbuka tanpa status hadir buatan. |
| T09 | Data kelas dan roster selektif | Native: ubah NIM/nonaktifkan dengan ID stabil, koreksi tanggal menjaga identitas lama; terapkan dosen/template tanpa mengganti roster, lalu roster593 dengan review dan status cocok dipertahankan. Impor UI memilih pembaruan/reaktivasi. |
| T10 | Hak Operator sesuai akses kelas | Unit16 dan native menolak eskalasi diri, target Admin/kelas asing, hak di luar pemberi, grant stale, serta pencabutan saat editor terbuka. Endpoint presensi lama, data kelas, template, job dan ekspor diperiksa server. |
| T11 | Restore append-only dan riwayat panjang | Pagination native mencapai 78 versi; pemulihan revisi1 menambah versi baru dan mempertahankan versi yang lebih baru. Legacy parsial tidak dapat dipulihkan otomatis; UI histori/diff dan pemilih versi paged. |
| T12 | Dokumen, paket, Mode Panggil dan offline | Regresi Mode Panggil/sidebar/search/PDF/offline termasuk verifier. Native Word/PDF, paket revisionId historis, draft offline, generation fencing dan snapshot terpin diuji. CSV/JSON memakai query dengan ACL. |
| T13 | Migrasi, kapasitas dan pemulihan parsial | Old main2a53d → backend baru; berhenti setelah2 halaman dan lanjut pada proses lain, ulang idempoten, hash arsip utuh. Native500 cohort diterima/501 ditolak;593 absen menjadi Word + PDF50 halaman. Payload/snapshot/batch dibatasi dengan arahan pembagian. |
| T14 | HP, keyboard, tema dan teks 200% | Chromium/WebKit 320/390/768/1280 pada flow baru; keyboard/fokus, terang/gelap, teks computed benar-benar2x, tanpa overflow halaman. Native build produksi memeriksa jadwal/pengaturan dan form/review. UI/UX global U01–U08 tetap scope terpisah. |

## Scope tambahan dan batas

- CSV jadwal/roster/presensi memakai tombol terpisah; Unicode/quoting/formula injection
  diperiksa. CSV menyimpan nol awal, tetapi Excel perlu impor kolom NIM sebagai Text.
- JSON backup berpaging, tanpa password/token/storage auth; file Word/PDF terpisah.
  Restore namespace/ID tervalidasi, lintas kelas eksplisit, dry-run+preview nilai
  sebelum–sesudah. Boolean string ditolak. Unlock tanpa kenaikan revisi membatalkan
  preview lama. ID peserta dan identitas historis dipetakan dengan aman.
- Maksimum500 peserta yang ditulis per cohort, satu versi sesi per restore,100 sesi
  aktif; UI memilih bagian/cohort. Sumber legacy parsial tidak direkonstruksi.
- Kelas arsip dipulihkan eksplisit dengan CAS; template terbit sebagai versi baru.
  Pengelola tidak dapat mengubah induk matkul yang memengaruhi kelas di luar aksesnya.
- Hak efektif memproteksi semua jalur baru dan lama; grant tidak hidup kembali
  setelah penugasan/peran dicabut. Pilihan grant stale tidak hilang secara diam-diam.
- Draf lokal dapat dipulihkan/diunduh/dimuat/dibuang. Operasi selesai tidak
  menghapus draf lebih baru dan tidak diterapkan ulang otomatis. Reuse memerlukan
  pilihan eksplisit dan preview baru.
- Flag default mati; setelah everEnabled, jalur replace-schedule/refresh snapshot
  legacy yang melewati ledger ditolak. Klien roster lama ditolak bila belum
  memberikan pilihan update; tidak boleh melaporkan sukses sambil melewati perubahan.
- Rollout/rollback mempertahankan pembaca ledger dan file immutable, dijelaskan pada
  [runbook implementasi](FULL-CONTROL-IMPLEMENTATION.md). Deploy/merge produksi menunggu
  instruksi pengguna, bukan bagian dari otorisasi preview ini.

## Reproduksi bukti

- `node scripts/verify-audit.mjs`: semua unit/invariant, dokumen dan suite browser
  regresi + flow baru, beserta digest source sebelum/sesudah.
- `node scripts/test-full-control-native.mjs --deployment TEAM:PROJECT:preview/BRANCH --credentials out/credentials/FILE.json`:
  menolak selector non-preview dan kredensial yang tidak sesuai, memakai data sintetis.
- Bukti native tambahan pada validation.json berasal dari preview terpisah:
  `admired-puma-858` (integrasi), `quick-goldfinch-724` (old-main migration). Probe
  rollback sementara dibatasi ke URL preview yang persis dan telah dihapus;
  ketidakhadirannya dikonfirmasi dari deployment.
- CI/Vercel setiap head PR diperiksa pada penyerahan. Screenshot aktual-base,
  desktop/mobile, dan manifest capture ada di docs/full-control.

Pengujian ini membuktikan skenario dan batas yang dicatat, bukan jaminan matematis
bahwa aplikasi bebas semua bug. Tidak ada roster produksi dalam fixture/artifact.
