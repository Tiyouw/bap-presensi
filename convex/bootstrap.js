import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { requireSesi } from "./lib/auth.js";
import { tipePertemuan } from "../bap-shared/jadwal.js";

/**
 * Satu query untuk semua yang dibutuhkan layar presensi:
 * daftar pertemuan + 93 peserta + status presensi yang sudah tersimpan.
 *
 * Client menyimpan hasil query ini di localStorage ("cache bootstrap") supaya
 * layar tetap bisa dibuka saat wifi ruang kelas mati. Cache dipakai hanya untuk
 * MEMBACA; menyimpan tetap butuh jaringan.
 */
export const get = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireSesi(ctx, token);

    const [peserta, pertemuan] = await Promise.all([
      ctx.db.query("peserta").withIndex("by_gol").take(200),
      ctx.db.query("pertemuan").withIndex("by_nomor").take(40),
    ]);

    return {
      diambilPada: Date.now(),
      peserta: peserta.map((p) => ({
        id: p._id,
        nim: p.nim,
        nama: p.nama,
        golongan: p.golongan,
        urut: p.urut,
      })),
      pertemuan: pertemuan
        .sort((a, b) => a.nomor - b.nomor)
        .map((p) => ({
          id: p._id,
          nomor: p.nomor,
          tipe: tipePertemuan(p),
          tanggal: p.tanggal,
          tempat: p.tempat,
          status: p.status,
          revision: p.revision,
        })),
    };
  },
});
