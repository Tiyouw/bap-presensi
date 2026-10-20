import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { requireClass } from "./lib/access.js";
import { classRows, meetingSummary } from "./lib/classLogic.js";
export const get = query({
  args: { token: v.string(), kelasId: v.id("kelas") },
  handler: async (ctx, { token, kelasId }) => {
    const { kelas } = await requireClass(ctx, token, kelasId),
      m = await ctx.db.get(kelas.matkulId);
    const [peserta, pertemuan] = await Promise.all([
      classRows(ctx, "peserta", kelasId),
      classRows(ctx, "pertemuan", kelasId),
    ]);
    return {
      diambilPada: Date.now(),
      kelas: {
        ...kelas,
        id: kelas._id,
        matkulNama: m.nama,
        matkulKode: m.kode,
      },
      peserta: peserta
        .filter((p) => p.aktif !== false)
        .map((p) => ({ ...p, id: p._id })),
      pertemuan: pertemuan
        .sort((a, b) => a.nomor - b.nomor)
        .map(meetingSummary),
    };
  },
});
