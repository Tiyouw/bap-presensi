import { ConvexError } from "convex/values";
import { requireSesi } from "./auth.js";
import { bahanGenerateLogic } from "./bapLogic.js";
import { jumlahForm, MAX_PRINT_MEETINGS } from "../../bap-shared/printPlan.js";
import { adaPraktikum } from "../../bap-shared/jadwal.js";

export async function ringkasanCetakLogic(ctx, { token }) {
  await requireSesi(ctx, token);
  const pertemuan = (await ctx.db.query("pertemuan").take(32))
    .filter((p) => adaPraktikum(p) && p.status === "KUNCI")
    .sort((a, b) => a.nomor - b.nomor);
  return Promise.all(
    pertemuan.map(async (p) => {
      const rows = await ctx.db
        .query("presensi")
        .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", p._id))
        .take(200);
      const jumlahAbsen = rows.filter((r) => r.status !== "HADIR").length;
      return {
        id: p._id,
        nomor: p.nomor,
        tanggal: p.tanggal,
        revision: p.revision,
        jumlahAbsen,
        jumlahForm: jumlahForm(jumlahAbsen),
      };
    }),
  );
}

/** One query supplies one consistent snapshot for the whole print job. */
export async function bahanPaketLogic(ctx, { token, items }) {
  await requireSesi(ctx, token);
  if (!items.length || items.length > MAX_PRINT_MEETINGS)
    throw new ConvexError("PILIH_PERTEMUAN");
  if (new Set(items.map((p) => p.pertemuanId)).size !== items.length)
    throw new ConvexError("PERTEMUAN_DOBEL");
  const result = [];
  for (const item of items) {
    const meeting = await ctx.db.get(item.pertemuanId);
    if (!meeting) throw new ConvexError("PERTEMUAN_TIDAK_ADA");
    if (!adaPraktikum(meeting)) throw new ConvexError("TANPA_PRAKTIKUM");
    if (meeting.status !== "KUNCI" || meeting.revision !== item.revision)
      throw new ConvexError("PAKET_BERUBAH");
    result.push(
      await bahanGenerateLogic(ctx, { pertemuanId: item.pertemuanId }),
    );
  }
  return result.sort((a, b) => a.pertemuan.nomor - b.pertemuan.nomor);
}
