# Bukti UI Mode Panggil

Base: `b1c7ee1c86f0fe90134c42a95c169f3585ab0a9e` (merge PR #6).
Sumber sebelum diekstrak langsung dari commit base oleh `git archive`, bukan
merekonstruksi tampilan lama lewat CSS pada kode sesudah.

Data: roster sintetis 93 mahasiswa, pertemuan 3, seluruhnya Hadir pada perbandingan
daftar. Tema gelap; desktop 1280 × 1000 px dan HP 390 × 844 px. Gambar kartu
terpisah menampilkan contoh pilihan Izin untuk nama pertama.

```sh
node scripts/ui/panggil.cjs --capture-only
```

| Layar | Sebelum | Sesudah |
| --- | --- | --- |
| Daftar desktop | ![Sebelum desktop](before-presensi-desktop.png) | ![Sesudah desktop](after-presensi-desktop.png) |
| Daftar HP | ![Sebelum HP](before-presensi-mobile.png) | ![Sesudah HP](after-presensi-mobile.png) |

![Kartu desktop](kartu-desktop.png)
![Kartu HP](kartu-mobile.png)

| Alur per golongan | Desktop | HP |
| --- | --- | --- |
| Pilihan dengan ikon | ![Golongan desktop](golongan-desktop.png) | ![Golongan HP](golongan-mobile.png) |
| Bantuan di popup | ![Bantuan desktop](bantuan-desktop.png) | ![Bantuan HP](bantuan-mobile.png) |
| Hasil setelah countdown dibatalkan | ![Selesai desktop](selesai-desktop.png) | ![Selesai HP](selesai-mobile.png) |

`results.json` adalah ringkasan 20 kelompok UI kartu yang lulus (10 per browser,
Chromium dan WebKit). Rincian cakupan serta batas verifikasi ada di
[`../MODE-PANGGIL.md`](../MODE-PANGGIL.md). Tes UI backend QA nyata terpisah lulus
24 kelompok, failure injection 6 kelompok, renderer PDF 2 browser dan responsif
layout kelas 144 kombinasi viewport/tema. Tes helper dan build juga lulus.
