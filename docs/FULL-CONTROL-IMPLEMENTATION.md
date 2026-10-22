# Kendali penuh kelas: implementasi bertahap

Scope mengikuti draft plan 21 Oktober 2026, disetujui untuk dieksekusi: seluruh
empat tahap, dengan kontrol akademik mengikuti akses kelas. U01–U08 pada audit
awal tetap di luar scope kecuali bagian yang diperlukan oleh flow baru ini.

## Tahap 1 — fondasi revisi

- Ledger append-only menyimpan metadata, snapshot identitas/template dan seluruh
  status peserta. Payload dan baris peserta dipisahkan agar daftar riwayat tidak
  membaca template/snapshot besar.
- Lock, koreksi melalui unlock lama dan refresh snapshot mencatat versi. Arsip
  baru membekukan nomor/tanggal pada klaim; proyeksi arsip memakai metadata asal.
- Migrasi owner-only bertahap: pertemuan → bapDoc → kelas. Riwayat lama dengan
  status yang tidak tersedia ditandai parsial; nomor asal yang tidak diketahui
  tidak diisi dari data pertemuan terkini. Storage/file tidak ditulis ulang.
- Flag fitur default mati. Tidak ada tombol koreksi baru pada tahap fondasi.

Jalankan pada deployment preview yang dipilih eksplisit:

```sh
node scripts/backfill-revisions.mjs --deployment TEAM:PROJECT:preview/BRANCH
```

Aktifkan hanya setelah seluruh tahap aplikasi terpasang dan preview tervalidasi:

```sh
node scripts/backfill-revisions.mjs --deployment TEAM:PROJECT:preview/BRANCH --enable
```

`--disable` mematikan editor baru tanpa menghapus ledger atau dokumen. Setelah ada
revisi baru, pertahankan backend pembaca ledger; jangan rollback ke backend lama.

## Validasi fondasi

`node scripts/test-revision-foundation.mjs`: status lengkap, chunk peserta,
riwayat tanpa payload besar, metadata arsip immutable, migrasi ulang, data legacy
parsial, flag default mati dan ACL. `npm test` mencakup invariant aplikasi lama.
Handler in-memory bukan bukti transaksi native; deployment preview diuji sebelum
hasil seluruh tahap dinyatakan selesai.

## Tahap 2 — koreksi satu sesi

Editor dari Jadwal atau Presensi mengubah tanggal/nomor/ruang, memilih snapshot
terbaru per kategori, mengoreksi status dan memulihkan nilai revisi sebelumnya.
Preview baca-saja dipin oleh hash isi, versi kelas/sesi, pelaku dan catatan.
Commit memvalidasi ulang ACL, review roster, versi, hash dan idempotency key.
Sesi historis siap dipakai dalam satu commit; file sebelumnya tetap utuh.

Draf tersimpan per akun/kelas/sesi, memakai Web Lock yang sama dengan presensi.
Konflik dapat direbase dengan mempertahankan hanya perubahan pengguna, bukan
menimpa nilai lain yang sudah berubah di server. Offline tetap dapat menyunting;
publish hanya online. Kegagalan storage mempertahankan input di memori dan
menyediakan unduhan draf. Retry operation yang sudah berhasil tidak membuat
revisi kedua; izin yang dicabut tetap diperiksa.

`scripts/test-corrections.mjs`: sembilan kelompok handler. `scripts/ui/corrections.cjs`:
Chromium/WebKit untuk reload, konflik, restore, kuota storage, dua tab, offline,
responsivitas dan runtime error. `scripts/ui/audit.cjs` tetap lulus. Capture berasal
dari base PR sebenarnya `db39e48`, memakai 93 peserta sintetis dan sesi p3 yang
terkunci pada revisi 1. Bukti di `docs/full-control/corrections/`.

## Tahap 3 — jadwal massal, lifecycle dan versi cetak

Jadwal memakai pilihan sesi dan preview terikat versi. Batch kecil atomik; batch
besar memakai job satu sesi per transaksi, dapat dilanjutkan setelah reload.
Perubahan eksternal menghentikan sisa job untuk review; pengguna memilih melewati
sesi yang dibatalkan. Undo menerbitkan revisi kompensasi hanya untuk sesi yang
belum diedit lagi, dengan retry idempoten.

Pembatalan mempertahankan data/file dan mengecualikan sesi dari rekap aktif.
Perubahan jenis kembali ke praktikum meminta pilihan pulihkan presensi atau mulai
baru. Snapshot persiapan tidak dianggap bukti presensi; perubahan tanggal tidak
mengarang status hadir. Sesi kosong boleh ditambah/dihapus dengan CAS/idempotensi.

Riwayat dan pemilih versi paket memakai pagination. Generasi revisi historis dipin
ke revisionId, termasuk versi sebelum pembatalan/perubahan jenis. Paket memvalidasi
kelas, kelengkapan presensi dan anggaran payload; pesan meminta pilihan lebih kecil
bila melampaui batas. Summary memakai proyeksi jumlah, tidak membaca semua presensi.
Migrasi menjalankan read models, ledger dan counts secara resumable sebelum enable.
Setelah protokol pernah aktif, jalur legacy replace-schedule tetap ditolak.

Validasi tahap ini: npm test; build; corrections UI 14 dan lifecycle UI 16 pemeriksaan
Chromium/WebKit. Screenshot 12 gambar dari base sebenarnya 17a050e, data sintetis
yang sama, desktop 1280×900 dan HP 390×844: docs/full-control/lifecycle/captures.json.
Adapter browser menjalankan handler asli dengan transport file sintetis; hasil ini
belum membuktikan bytes DOCX/PDF atau rollback transaksi Convex native.

## Tahap 4 — data kelas, portabilitas dan delegasi

Hak Operator dihitung di server per kelas. Izin default presensi historis lama
dipertahankan ketika belum ada konfigurasi; konfigurasi kosong mencabutnya secara
eksplisit, termasuk pada endpoint unlock/save lama. Pemberian izin memiliki CAS,
melarang target diri sendiri/Admin/kelas yang tidak ditugaskan dan hak di luar
pemberi. Perubahan penugasan/peran menonaktifkan grant lama agar tidak hidup lagi.
Navigasi, data kelas, template, ekspor, koreksi dan job memeriksa hak efektifnya.

Nama/kode matkul dapat ditetapkan per kelas. Mengubah induk global oleh Pengelola
ditolak bila berdampak pada kelas di luar aksesnya. Identitas/roster/template kelas
berlaku ke depan; editor sesi menerapkan kategori terpilih secara eksplisit.
Impor peserta memilih identitas dan reaktivasi per NIM; edit NIM mempertahankan ID.
Arsip/pulih kelas memakai versi kelas. Riwayat menampilkan pelaku/waktu dan diff.

Ekspor jadwal, roster dan presensi memakai tombol CSV terpisah (WebKit membatasi
unduhan beruntun). Semua sel di-quote; Unicode, NIM teks dan formula injection
ditangani. Backup JSON dibaca per halaman dan dipin ke keadaan akademik; file
Word/PDF tetap diunduh terpisah. JSON menyertakan manifest hash, tanpa kredensial,
URL autentikasi atau bytes storage.

Restore memvalidasi format/namespace/ID, whitelist akademik, pemetaan peserta,
versi tujuan dan hash preview. Preview menampilkan nilai identitas/template,
jadwal/lifecycle dan status peserta sebelum–sesudah; boolean tidak dikoersi dari
string. Perubahan unlock tanpa kenaikan nomor revisi tetap membatalkan preview. Lintas kelas/deployment memerlukan pilihan eksplisit;
server tidak membaca ID sumber dari file. ID stabil diprioritaskan untuk kelas
yang sama; lintas kelas memakai NIM/pemetaan manual. Satu versi sesi per commit,
roster maksimal 500 peserta yang ditulis per kelompok; UI menyediakan pemilihan
kelompok. Batas snapshot/argumen diperiksa, dan pembuatan/pulih tetap maksimal 100
sesi aktif. Pemulihan menerbitkan revisi/pelaku/waktu baru; metadata penulis dari
file sumber tidak digunakan sebagai penulis baru. File dan ledger lama tidak ditimpa.

Draf koreksi/jadwal dapat diunduh dan dimuat kembali dengan namespace
akun/kelas/sesi/server. Import memeriksa operation yang sudah diterapkan untuk
mencegah duplikasi. Aksi Buang draf menghapus hanya draf lokal; data server tetap. Pembersihan operation
yang selesai tidak boleh menghapus draf lebih baru dari tab lain. Draf yang ternyata
sudah diterapkan dipertahankan dengan publikasi diblokir sampai pengguna memilih
buang atau memakai isinya sebagai operasi baru setelah preview. Pilihan izin juga
dipertahankan bila grant diubah oleh orang lain, dengan reload eksplisit.
Draf yang usang tetap perlu rebase dan preview; kegagalan
storage mempertahankan isi di memori.

Validasi tahap ini: unit kelas 16, lifecycle 5 dan batch 9 kelompok; browser koreksi
22 dan kontrol kelas 28 pemeriksaan di Chromium/WebKit. Native preview terpisah
`preview/preview-codex-full-control-data` menguji 9 kelompok integrasi dan 12 browser
produksi, hash/isi Word/PDF, konflik, ACL, backup/restore dan halaman 320/390/1280
dengan teks aktual 200%. Tambahan native membuktikan rollback setelah penulisan
ledger/proyeksi/presensi, >75 versi dengan restore lama, serta kelompok 500 peserta.
Probe internal sementara dibatasi ke URL preview yang persis dan telah dihapus.
Migrasi native memakai old main sebenarnya, checkpoint dua halaman lalu proses
terpisah melanjutkan hingga selesai; hash dokumen lama utuh dan riwayat parsial
tidak direkonstruksi. Uji dokumen593 absen menghasilkan Word serta PDF50 halaman,
dengan peserta terakhir diverifikasi. Lihat bukti final tersanitasi pada checklist.

Screenshot tahap 4 memakai archive base sebenarnya `24a6305`, data sintetis dan
viewport yang sama; manifest di `docs/full-control/data/captures.json`. Pengujian
source akhir dan CI head PR dipetakan pada checklist. Flag produksi belum diubah;
enable hanya setelah seluruh stack dipasang, migrasi dan validasi rollout selesai.

Kriteria T01–T14 pada plan penuh harus dipetakan ke hasil tes akhir dan native
preview, bukan hanya dinyatakan selesai berdasarkan fondasi ini.
