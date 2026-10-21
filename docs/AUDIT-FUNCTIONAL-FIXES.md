# Implementasi audit fungsi — 21 Oktober 2026

Acuan audit: main `5bd0d6f`. Ruang kerja: `codex/audit-functional-fixes`.
Pengguna mengizinkan implementasi hasil audit selain UI/UX. Rancangan U01–U08,
perubahan tata letak, wireframe, dan redesign tetap ditunda. Pesan kegagalan,
konfirmasi perubahan, serta read-only saat konflik adalah perilaku proteksi data,
bukan penerapan rancangan UI/UX.

## Checklist lingkup

- [x] F01: rekonsiliasi draf dengan roster berubah, cadangan dan review ID baru.
- [x] F02: koordinasi editor antar-tab; draf tidak saling menimpa.
- [x] F03: lindungi perubahan editor dari navigasi/reload.
- [x] F04: buka kunci mensyaratkan revisi yang dilihat pengguna.
- [x] F05: refresh snapshot mencadangkan dan mempertahankan koreksi lokal.
- [x] F06: workbook dengan sheet pertama kosong tetap bisa diimpor.
- [x] F07: version check pada matkul induk.
- [x] R01: cabut recovery code saat password diganti/reset, demosi, dan nonaktif.
- [x] R02: salin template yang sudah terbit, bukan draf sumber.
- [x] R03: preflight ukuran snapshot sebelum aktivasi/kunci/refresh.
- [x] R04: batasi pembacaan query, index ACL, pencarian dan riwayat.
- [x] R05: finalisasi generator hanya untuk percobaan klaim yang masih berlaku.
- [x] R06: kontrak offline yang dapat diverifikasi; app-shell cold start dan cache
  data tetap dipisahkan, tanpa menyimpan response berizin di cache publik.

## Verifikasi yang dibutuhkan

Tes regresi nyata untuk setiap item, suite yang ada, build, generator dokumen,
browser Chromium/WebKit, fault injection, dan cold start offline dari build.
Tidak ada mutasi/deploy produksi selama implementasi lokal. Perubahan schema
harus kompatibel dengan record lama. Hasil uji dan batas deploy dicatat di sini.

## Bukti dan perilaku

| Item | Implementasi | Regresi |
| --- | --- | --- |
| F01 | Rekonsiliasi per ID, backup, review perubahan roster sebelum lock; berlaku pula saat pertahankan draf setelah konflik. | Helper tambah/hapus/rename dan browser live/reload/conflict. |
| F02 | Web Locks per scope; tab kedua read-only; handoff memuat draf terbaru. Impor legacy menghormati lock dan tidak menimpa draf akun. | Dua halaman Chromium/WebKit mempertahankan dua status absen. |
| F03 | Dirty/busy guard editor identitas kelas/matkul, jadwal, template dan mahasiswa; beforeunload dan konfirmasi penutupan modal. | Pembatalan navigasi dan close mempertahankan input. |
| F04 | expectedRevision diwajibkan; dialog menyimpan revisi ketika dibuka. Retry pada revisi terbuka yang sama tetap idempoten. | Handler stale unlock dan revisi berubah saat dialog terbuka. |
| F05 | Backup wajib sebelum mutation; koreksi direkonsiliasi ke snapshot baru. Write failure memakai memori yang dibuang setelah persist/lock agar draf lama tidak bangkit. | Quota sebelum/sesudah mutation, relock/remount/reload. |
| F06 | Pilih sheet pertama berheader dan berdata. Persetujuan update direset saat file/sheet/mapping berubah. | XLSX sintetis: sheet pertama kosong, sheet kedua valid. |
| F07 | Revision matkul opsional (legacy=0), save compare-and-set. | Save kedua dari revision 0 ditolak tanpa penimpaan. |
| R01 | Password change/reset, demosi dan nonaktif menghapus recoveryHashes. | Kode lama tidak tersedia di prepareLogin; last-admin tetap dilindungi. |
| R02 | Copy memakai versi template terbit sumber. | Draf sumber berbeda tidak terbit di salinan. |
| R03 | getConvexSize membatasi snapshot 1.000.000 byte sebelum aktivasi/lock/refresh mengubah data. | Ukuran berlebih tidak mengubah presensi/revisi/status aktif. |
| R04 | Read model tanpa snapshot/logo; index ACL dan pencarian; audit/impor dibatasi sebelum read; konfigurasi template lazy; arsip 30 baris per halaman saat scroll. | Backfill resume/idempoten; 500 audit/60 impor/65 dokumen; pagination API dan scroll 95 dokumen. |
| R05 | Finalize memerlukan attempt aktif dan PENDING; hasil storage terlambat dibuang. | Completion/failure lama tidak menimpa READY attempt baru. |
| R06 | App-shell berversi; respons Convex/dokumen berizin tidak dicache. Data akun tetap scoped localStorage. | Cold start deep-link setelah tutup semua tab, draf bertahan dan cache tanpa roster/dokumen. |

Tes ada di `scripts/test-audit.mjs` dan `scripts/ui/audit.cjs`; runner final
`node scripts/verify-audit.mjs` menjalankan suite lama, dokumen, browser audit,
Mode Panggil, sidebar, faults, class layout, PDF viewer, serta build/cold start.
Log dan manifest di `out/audit/verification/`; fingerprint source sebelum/sesudah
harus sama. CI juga menjalankan dua suite audit baru. `npm audit` diperiksa terpisah.

## Rollout

1. Backup deployment/storage sesuai panduan yang ada; uji dev/preview sintetis.
2. Deploy schema/index/functions dan frontend dari commit yang sama. Record lama
   tetap kompatibel dengan field opsional. Klien lama tanpa argumen revision baru
   pada unlock/matkul ditolak; muat ulang klien. Klaim lama dapat diulang setelah
   lease 120 detik berakhir.
3. Bootstrap Management v2 harus selesai sebelum backfill owner-only:

   ```sh
   node scripts/backfill-read-models.mjs --deployment TEAM:PROJECT:preview/BRANCH
   ```

   Server memaksakan urutan `peserta → pertemuan → template → bapDoc → kelas`.
   Paging dibatasi byte; cursor di `out/audit/` dapat dilanjutkan dengan perintah
   yang sama. Jalur lama tersedia sampai model kelas siap; katalog admin beralih
   sesudah marker akhir. Source snapshot/arsip tidak ditulis ulang.
4. Verifikasi login/ACL, konflik, dua tab, lock/koreksi dan Word/PDF pada preview
   sebelum produksi. Migrasi/deploy produksi belum dijalankan oleh perubahan lokal.
5. Setelah password berubah/reset atau admin didemosi/nonaktif, buat kode pemulihan
   baru dan simpan privat bila pemulihan masih diperlukan.

Rollback: kembalikan frontend/backend kompatibel sebelumnya; pertahankan tabel
turunan, source snapshot dan storage. Jangan hapus arsip. Untuk menghapus app-shell
secara darurat, unregister worker dan hapus cache `bap-shell-`; **jangan hapus
localStorage/draf**. Penghapusan cache bukan rollback data. Uji offline di origin
preview terpisah. Batas snapshot menyisakan ruang metadata di bawah
[limit dokumen Convex 1 MiB](https://docs.convex.dev/production/state/limits).

## Kontrak offline dan batas bukti

- App-shell tersedia setelah build produksi pernah dimuat online dan pemasangan
  service worker selesai. Vite development tidak mendaftarkan service worker.
- Hanya akun/kelas/pertemuan yang sudah dicache dapat dibuka. Login baru, manajemen,
  lock dan generate membutuhkan server. Logout mempertahankan scoped cache/draf.
- Pengeditan lokal membutuhkan Web Locks pada HTTPS/localhost dan browser modern.
  Browser tanpa dukungan membaca saja agar tidak menimpa draf tab lain.
- Chromium memakai `browserContext.setOffline(true)`. WebKit memakai origin yang
  dihentikan; respons navigasi dibuktikan berasal dari service worker. Emulasi
  offline WebKit terkena [Playwright #42775](https://github.com/microsoft/playwright/issues/42775),
  bahkan untuk respons worker literal. Kontrol outage ini bukan klaim pengujian
  airplane mode Safari/Mac atau perangkat fisik.
- Tidak ada pentest/mutasi produksi, native Word/printer fisik atau load test cloud
  dalam suite lokal. Read instrumentation membuktikan index/batas query, bukan
  angka latensi deployment. Ukur latensi di preview sebelum rollout.

## UI/UX ditunda

U01–U08 tetap menunggu review. CSS, font, warna, toolbar, review per golongan,
checklist aktivasi, label versi arsip, panel restore backup, reaktivasi impor,
desain pesan umum dan jalan keluar forced-password tidak diubah.
Pilihan memasukkan draf template saat copy, tombol hapus cache perangkat dan
tampilan pelaku/filter riwayat juga ditunda sebagai UI/UX.
Konfirmasi dirty state, notifikasi konflik dan persetujuan roster adalah proteksi
fungsi/data yang diperlukan untuk F01–F05.
