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

`scripts/test-corrections.mjs`: delapan kelompok handler. `scripts/ui/corrections.cjs`:
Chromium/WebKit untuk reload, konflik, restore, kuota storage, dua tab, offline,
responsivitas dan runtime error. `scripts/ui/audit.cjs` tetap lulus. Capture berasal
dari base PR sebenarnya `db39e48`, memakai 93 peserta sintetis dan sesi p3 yang
terkunci pada revisi 1. Bukti di `docs/full-control/corrections/`.

## Tahap berikutnya (belum selesai)

3. Jadwal massal, job resumable, batal/pulih, perubahan jenis dan rekap/paket.
4. Data kelas selektif, roster reaktivasi, portabilitas dan delegasi Operator.

Kriteria T01–T14 pada plan penuh harus dipetakan ke hasil tes akhir dan native
preview, bukan hanya dinyatakan selesai berdasarkan fondasi ini.
