# Bantuan kontekstual dan tur BAP

Scope: seluruh PLAN.md dan TOUR-LIBRARIES.md pada draft23 Oktober2026, kini
diotorisasi untuk implementasi. Base aktual PR: `1b2cc52`. Perubahan UI terpisah
dari empat PR full-control; belum merge/produksi. Data pengujian sintetis.

## Matriks requirement dan bukti implementasi

| ID  | Requirement                                                              | Implementasi / bukti verifikasi                             |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| H01 | Katalog tunggal untuk keterangan singkat/detail/panduan/tur              | Teruji — helpContent.js; test-help.mjs; kecocokan konten UI |
| H02 | Keterangan penting terlihat; (?) selektif per konsep                     | Teruji — Form, heading grup, review; audit layar dan screenshot |
| H03 | Hover/fokus + klik/tap; tooltip tanpa kontrol interaktif                 | Teruji — Help.jsx; browser pointer/keyboard/touch |
| H04 | Panel detail dan pusat bantuan bisa dibuka/ditutup tanpa data berubah    | Teruji — snapshot form/draf/state/calls; Escape/top-layer/focus |
| H05 | Presensi, status, draf, lock, undo, Mode Panggil                         | Teruji — 6 topik utama; bantuan inline + panduan; regresi Mode Panggil |
| H06 | Koreksi tanggal/nomor/ruang, alasan, snapshot selektif dan revisi        | Teruji — editor; tur koreksi; preview nyata lalu publish tetap eksplisit |
| H07 | Konflik/offline/izin/lock dan alasan tombol tertahan                     | Teruji — pesan keadaan aktual; browser perubahan versi dan pencabutan grant |
| H08 | Bulk, historical opt-in, job parsial/resume/cancel/undo                  | Teruji — topik bulk/batchRecovery; panel jadwal |
| H09 | Batal/pulih, jenis dua arah, reset/pulih presensi, denominator           | Teruji — topik lifecycle/meetingType; review konsisten dengan backend |
| H10 | Identitas/roster/impor/reaktivasi/template/arsip/delegasi                | Teruji — form dan heading; operator/admin/legacy variants |
| H11 | Word/PDF historis, paket lintas versi, folio/form lanjutan               | Teruji — dokumen, PrintPack; bantuan nested di modal |
| H12 | CSV/JSON/namespace/cohort/restore baru dan limit                         | Teruji — ClassBackup; konten500/100/satu versi dan file terpisah |
| H13 | Akun, recovery dan bantuan login sesuai peran                            | Teruji — halaman login/profil/akun; tidak memuat data rahasia |
| H14 | Bantuan halaman, pencarian topik, link detail ke topik                   | Teruji — Guide.jsx/Help.jsx; tidak query data privat melalui pencarian bantuan |
| H15 | Panduan legacy vs fitur revisi sesuai flag                               | Teruji — helpTopic lock; fixture flagoff/on; teks tidak bertentangan |
| H16 | Driver.js satu mesin; tiga tur pendek dapat diulang/dilewati             | Teruji — lazy import, pin1.10.2; class/attendance/correction; browser UI/native |
| H17 | Tur baca-saja; tidak click target/mutation/download otomatis             | Teruji — disableActiveInteraction; invariants API/form/draf/riwayat |
| H18 | Tur sesuai DOM/peran; menunggu siap/missing target tanpa sukses palsu    | Teruji — required anchors, bounded observer, cancellation/context cleanup |
| H19 | Status tur lokal per akun/server/versi; no external telemetry            | Teruji — progress helper + browser reload/quota; network checks |
| H20 | Fokus/Tab/Escape/modal/timer dan shortcut Mode Panggil                   | Teruji — window capture/layer protocol; browser nested dialog/tur |
| H21 | 320/390/1280, keyboard/touch, gelap/terang, teks200%, reduced motion     | Teruji otomatis/visual; penerimaan manusia pending — browser layout/axe/semantic tree + manual visual inspection |
| H22 | Offline penjelasan dan lazy tour diprecache, tidak cache credentials     | Teruji — build app-shell manifest + production offline browser |
| H23 | Screenshot actual-base sebelum/sesudah desktop/HP                        | Teruji — docs/contextual-help/captures.json + inline PR template |
| H24 | Cek ulang semua scope dan perbaiki bug; final summary + preview/artifact | Bukti penyerahan akhir di artifact — checklist hasil akhir, source digest, CI/Vercel exact head |

`src/lib/helpContent.js` berisi konten statis, bukan data kelas. Izin query/mutation
tetap diperiksa backend. Scope bantuan membaca peran/capability/flag yang sudah
tersedia; tidak menambah endpoint atau model server.

Driver.js dimuat saat diminta dan masuk precache build app-shell. Library tur tidak
memberikan izin, menekan Simpan, membuat preview server, atau menghapus draf.

Pemeriksaan pembaca layar manual dengan pengguna serta uji pemahaman calon pengguna
memerlukan manusia/perangkat bantu yang benar-benar digunakan. Hasil aksesibilitas
otomatis, keyboard dan semantic tree harus dilaporkan terpisah dari bukti uji manusia;
jangan menyatakan tes manusia selesai berdasarkan otomasi.

## Hasil verifikasi 23 Oktober 2026

- **Cakupan28 suite unik**:26 suite baseline lulus sebelum perbaikan CSS terakhir;4 suite UI terdampak diperiksa ulang pada sumber akhir (bantuan, kontrol kelas, sidebar, layout kelas). Backend dan JavaScript aplikasi tidak berubah. Bukti baseline dan pemeriksaan ulang dipisahkan pada validation.json; bukan klaim satu run penuh28 suite pada CSS akhir.
- **40 pemeriksaan bantuan lulus**, masing-masing 20 di Chromium dan WebKit. Ini bagian dari 28 suite, bukan angka tambahan yang dijumlahkan. Mencakup hover/fokus/keyboard/tap, sidebar, modal bertingkat, pencarian/izin, tiga tur, missing target, quota, reload, timer 700 ms dan countdown 3 detik, tema, teks 200%, viewport 320/390/1280 serta axe.
- **6 pemeriksaan build produksi +backend demo terisolasi lulus**: login aktual, tidak ada request Action/Mutation ketika memakai bantuan, snapshot akademik/riwayat tetap identik, draf tetap ada setelah reload, dan tur lazy pertama tersedia saat origin tidak tersedia.
- **18 screenshot actual-base** dalam contextual-help/captures.json: koreksi, presensi, pengaturan dan pusat bantuan pada desktop/HP sebelum–sesudah, ditambah tur baru di dua viewport. Semua data sintetis.
- Driver.js dipin 1.10.2, dimuat lazy, notice MIT disediakan lokal dan diprecache. npm audit: 0 kerentanan saat verifikasi.

Matriks H01–H20, H22–H23 tercakup implementasi dan bukti otomatis di atas. H21 mencakup pemeriksaan otomatis +visual, dengan uji pembaca layar manusia masih perlu dilakukan. H24 meliputi penyerahan draft PR/preview/artifact; bukti exact-head CI/Vercel dan review preview dikumpulkan dalam evidence.json artifact akhir, bukan klaim persetujuan merge.

### Bug yang ditemukan dan diperbaiki

1. Popover Driver meluber pada layar sempit: box-sizing dan lebar dibatasi viewport.
2. Anchor bergeser saat teks 200%: posisi panel dijepit viewport dan dihitung ulang memakai ResizeObserver.
3. Tap backdrop di WebKit dibatalkan pointerdown: penutupan berpindah ke click tanpa preventDefault pada pointerdown.
4. Bantuan dari sidebar terpasang pada drawer inert: portal memakai body atau modal sebenarnya; fokus memakai pemicu eksplisit dan fallback menu sesudah teardown.
5. Beberapa pemilik scroll-lock dapat melepas kunci terlalu awal/meninggalkannya aktif: kunci memakai daftar pemilik bersama.
6. Shortcut/timer Mode Panggil berjalan di balik bantuan: lapisan bantuan menghentikan timer tertunda dan countdown; tidak memulai ulang secara implisit.
7. Operator tanpa capability masih melihat tautan koreksi: tautan mengikuti izin relevan kelas.
8. Judul antartab bergeser setelah penambahan ikon bantuan: alignment dan tinggi minimum diseragamkan; 144 keadaan viewport/tema lulus pada kedua engine.

### Metode offline dan batas bukti

Chromium memakai browser context offline. WebKit Playwright 1.62.1 mengembalikan internal error untuk fetch yang ditangani service worker ketika setOffline(true), sekalipun resource berada di Cache API. Lihat https://github.com/microsoft/playwright/issues/42775.

Pada WebKit, origin aplikasi benar-benar dihentikan; koneksi origin serta resource tak dicache dipastikan gagal sebagai kontrol negatif. Tur pertama kemudian dimuat dari precache. Backend tetap tersambung dalam metode WebKit ini; hasilnya bukan bukti seluruh jaringan WebKit offline. Tidak ada tes yang diam-diam dilewati atau library yang diimpor sebelum kondisi outage.

Skrip historis scripts/ui/run.cjs masih mengasumsikan daftar pertemuan pada route / dan kunci draf tanpa namespace, sehingga tidak cocok dengan navigasi yang sudah berubah pada base PR. Percobaan terhadap skrip tersebut gagal menunggu .meeting-row di beranda; skrip tidak diubah atau dihitung sebagai suite lulus. Skenario bantuan/pengenalan pertama, draf dan presensi diuji melalui suite aktif help/audit/panggil/faults/offline yang mengikuti route sekarang.

### Penerimaan manusia yang masih perlu review

- NVDA/VoiceOver: baca judul, ringkasan, detail, tombol tutup, indikator langkah; periksa urutan fokus dan pengumuman saat topik berpindah.
- Pengguna baru: cari arti tanggal, jelaskan apa yang dipertahankan, jalankan tur, lalu jelaskan dampak sebelum menyimpan sendiri pada demo.
- Bandingkan Pengelola dan Operator pada kelas demo; minta pengguna mengenali alasan aksi tertahan.

Pengujian manusia ini tidak dinyatakan lulus dari axe, semantic tree atau otomatisasi keyboard. Keputusan merge dan penerimaan produk menunggu review pengguna.

### Reproduksi

- node scripts/verify-audit.mjs
- node scripts/test-help-native.cjs --credentials out/credentials/explicit-synthetic-preview.json

Tes native menolak kredensial non-demo dan selector di luar preview. Kredensial, token serta diagnostik privat tetap berada dalam out/ yang diabaikan Git. Ringkasan bukti publik: contextual-help/validation.json.

## Revisi berdasarkan review pengguna

- Bantuan halaman menjadi satu ikon (?) di header atas, dengan nama aksesibel, fokus keyboard dan target minimal44×44px. Baris Bantuan halaman ini/Tunjukkan caranya di badan konten dihapus pada semua halaman. Tur dibuka dari panel bantuan. Layar wajib ganti password menggunakan ikon di baris judul karena tidak memiliki header ruang kerja.
- Koreksi sesi ini diganti Tanggal & data sesi di toolbar presensi. Editor menjelaskan tanggal, ruang, nomor dan data sesi, serta pemeriksaan dampak sebelum menyimpan revisi. Membuka editor bukan langkah wajib presensi dan tidak langsung mengubah data.
- Akses schedule/history, pengamanan navigasi saat draf belum tersimpan, dan penguncian saat proses berjalan tetap berlaku. Operator tanpa izin tidak mendapat tombol ini.
- Regresi memeriksa satu ikon dalam header, tidak ada baris bantuan tambahan, navigasi ke editor yang benar, target sentuh serta overflow header/toolbar pada320/390/1280px di Chromium dan WebKit. Tes sidebar mengikuti urutan fokus header yang baru.
- Hasil verifikasi ulang dan fingerprint sumber ada di contextual-help/validation.json. Uji manusia tetap pending.
