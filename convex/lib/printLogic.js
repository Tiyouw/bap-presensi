import { ConvexError } from "convex/values";
import { requireClass } from "./access.js";
import { classRows } from "./classLogic.js";
import { bahanGenerateLogic } from "./bapLogic.js";
import { jumlahForm, MAX_PRINT_MEETINGS } from "../../bap-shared/printPlan.js";
export async function ringkasanCetakLogic(ctx, { token, kelasId }) {
  await requireClass(ctx, token, kelasId);
  const meetings = (await classRows(ctx, "pertemuan", kelasId))
    .filter((p) => p.tipe === "REGULER" && p.status === "KUNCI")
    .sort((a, b) => a.nomor - b.nomor);
  return Promise.all(
    meetings.map(async (p) => {
      const rows = await ctx.db
          .query("presensi")
          .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", p._id))
          .collect(),
        jumlahAbsen = rows.filter((r) => r.status !== "HADIR").length;
      return {
        id: p._id,
        nomor: p.nomor,
        tanggal: p.snapshot?.tanggal || p.tanggal,
        revision: p.revision,
        jumlahAbsen,
        jumlahForm: jumlahForm(jumlahAbsen),
      };
    }),
  );
}
export async function bahanPaketLogic(ctx, { token, kelasId, items }) {
  await requireClass(ctx, token, kelasId);
  if (!items.length || items.length > MAX_PRINT_MEETINGS)
    throw new ConvexError("PILIH_PERTEMUAN");
  if (new Set(items.map((p) => p.pertemuanId)).size !== items.length)
    throw new ConvexError("PERTEMUAN_DOBEL");
  const result = [];
  for (const item of items) {
    const p = await ctx.db.get(item.pertemuanId);
    if (!p || p.kelasId !== kelasId) throw new ConvexError("AKSES_DITOLAK");
    if (p.status !== "KUNCI" || p.revision !== item.revision)
      throw new ConvexError("PAKET_BERUBAH");
    result.push(await bahanGenerateLogic(ctx, { token, pertemuanId: p._id }));
  }
  return result.sort((a, b) => a.pertemuan.nomor - b.pertemuan.nomor);
}
