# Completion audit: kendali penuh

Dokumen ini memetakan seluruh scope plan, bukan hanya perubahan yang sudah lolos
tes. Status belum selesai harus ditutup oleh bukti pada source akhir dan preview
native sebelum goal dinyatakan selesai. UI/UX audit lama di luar flow ini tetap
terpisah. Target empat PR bertumpuk: fondasi → koreksi → lifecycle/bulk → data/izin.

| Kriteria | Bukti yang sudah ada | Bukti yang masih diperlukan |
| --- | --- | --- |
| T01 tanggal tanpa reset data | handler koreksi tanggal; browser publish | Word/PDF native tanggal baru dan nilai lama tetap |
| T02 arsip immutable | claim metadata beku; handler proyeksi setelah perubahan | hash dan metadata native sesudah revisi/backfill/restore |
| T03 draf & storage gagal | UI reload/kuota/export draf | interaksi batal editor, retry response hilang, tidak ada resurrection |
| T04 konflik dua perangkat/tab | CAS handler, Web Locks/rebase UI | race native dan status pengguna lain tetap setelah rebase |
| T05 idempotensi/atomic | handler retry operationKey; preview tanpa tulis | rollback transaksi native, retry/double-click, response hilang |
| T06 bulk tanggal | belum diimplementasikan | pilihan subset, ± hari, tanggal kabisat/akhir tahun, preview stale, batch resume |
| T07 batal/pulih | belum diimplementasikan | lifecycle, denominator/rekap/print, draf, hash arsip |
| T08 jenis dua arah | komposisi koreksi memiliki validasi jenis | UI pilihan status lama/baru dan rekap/print native |
| T09 data kelas selektif | handler roster selectif/review; UI kategori | identitas/template selektif, reaktivasi/impor terpilih, ID NIM tetap |
| T10 capability per kelas | ACL service dan handler pencabutan | UI delegasi, batas penugasan/delegasi, akses langsung/export |
| T11 restore versi | handler/UI new revision; partial ditolak | seluruh riwayat >50 versi dengan pagination; restore native |
| T12 seluruh alur/doc/offline | existing audit UI lulus, correction offline draft | paket revisionId historis, batal/nonpraktikum, daftar/search/sidebar/panggil; fencing lama |
| T13 migrasi/kapasitas | chunk header/payload, migration handler ulang | resume native, dokumen besar, batch besar/parsial/undo, source hashes |
| T14 layout/aksesibilitas | UI 320/390/768/1280; screenshot base sebenarnya | tema gelap, keyboard/fokus, 200% teks untuk seluruh flow baru |

Additional scope dari plan: CSV jadwal/roster/presensi, JSON backup dan restore
dry-run tervalidasi namespace/ID (termasuk pilihan lintas kelas eksplisit), kelas
arsip dipulihkan eksplisit, semua jalur tulis lama melewati revision service atau
menolak klien yang tidak kompatibel, flag rollout default mati, runbook rollback
mempertahankan pembaca revision-compatible, catatan pelaku/waktu/diff.

Belum ada klaim bahwa keseluruhan scope selesai. Validasi akhir harus memeriksa
checkout, source fingerprint, CI setiap head PR, artifacts screenshot dan native
preview, lalu mengganti tabel ini dengan pemetaan bukti final.
