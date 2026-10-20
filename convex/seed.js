import { mutation } from "./_generated/server.js";
import { PESERTA } from "./lib/pesertaData.js";

/**
 * Seed idempoten: hanya mengisi kalau tabel kosong.
 *
 * Publik (bukan internal) supaya bisa dipanggil app sendiri saat pertama kali
 * dibuka — tidak ada langkah CLI manual. Aman: isinya statis (93 peserta +
 * 16 pertemuan), hanya jalan kalau tabel masih kosong, dan tidak bisa dipakai
 * menimpa data yang sudah ada.
 */

// 16 pertemuan, semua Senin. Pertemuan ke-5 memakai 28 Sep 2026 karena
// 27 Sep 2026 jatuh pada hari Minggu (cacat template lama).
const JADWAL = [
  { nomor: 1, tanggal: "2026-08-31", tipe: "TEORI" },
  { nomor: 2, tanggal: "2026-09-07", tipe: "REGULER" },
  { nomor: 3, tanggal: "2026-09-14", tipe: "REGULER" },
  { nomor: 4, tanggal: "2026-09-21", tipe: "REGULER" },
  { nomor: 5, tanggal: "2026-09-28", tipe: "REGULER" },
  { nomor: 6, tanggal: "2026-10-05", tipe: "REGULER" },
  { nomor: 7, tanggal: "2026-10-12", tipe: "REGULER" },
  { nomor: 8, tanggal: "2026-10-19", tipe: "UTS" },
  { nomor: 9, tanggal: "2026-10-26", tipe: "REGULER" },
  { nomor: 10, tanggal: "2026-11-02", tipe: "REGULER" },
  { nomor: 11, tanggal: "2026-11-09", tipe: "REGULER" },
  { nomor: 12, tanggal: "2026-11-16", tipe: "REGULER" },
  { nomor: 13, tanggal: "2026-11-23", tipe: "REGULER" },
  { nomor: 14, tanggal: "2026-11-30", tipe: "REGULER" },
  { nomor: 15, tanggal: "2026-12-07", tipe: "REGULER" },
  { nomor: 16, tanggal: "2026-12-14", tipe: "UAS" },
];

export const jalan = mutation({
  args: {},
  handler: async (ctx) => {
    const adaPeserta = await ctx.db.query("peserta").take(1);
    if (adaPeserta.length > 0) {
      return { dilewati: true, alasan: "peserta sudah terisi" };
    }

    for (const p of PESERTA) {
      await ctx.db.insert("peserta", {
        nim: p.nim,
        nama: p.nama,
        golongan: p.golongan,
        urut: p.urut,
      });
    }

    for (const j of JADWAL) {
      await ctx.db.insert("pertemuan", {
        nomor: j.nomor,
        tipe: j.tipe,
        tanggal: j.tanggal,
        tempat: "F6",
        status: "TERBUKA",
        revision: 0,
      });
    }

    return { dilewati: false, peserta: PESERTA.length, pertemuan: JADWAL.length };
  },
});
