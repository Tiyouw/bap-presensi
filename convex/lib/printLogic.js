import { ConvexError,getConvexSize } from "convex/values";
import { requireClass } from "./access.js";
import { classRows } from "./classLogic.js";
import { packetGenerationData } from "./bapLogic.js";
import { jumlahForm, MAX_PRINT_MEETINGS } from "../../bap-shared/printPlan.js";
export async function ringkasanCetakLogic(ctx, { token, kelasId }) {
  await requireClass(ctx, token, kelasId);
  const meetings = (await classRows(ctx, "pertemuan", kelasId))
    .filter((p) => !p.cancelled && p.tipe === "REGULER" && p.status === "KUNCI")
    .sort((a, b) => a.nomor - b.nomor);
  return Promise.all(
    meetings.map(async (p) => {
      const rows = Number.isInteger(p.jumlahAbsen)?null:await ctx.db
          .query("presensi")
          .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", p._id))
          .collect(),
        jumlahAbsen = Number.isInteger(p.jumlahAbsen)?p.jumlahAbsen:rows.filter((r) => r.status !== "HADIR").length;
      return {
        id: p._id,
        nomor: p.nomor,
        tanggal: p.snapshot?.tanggal || p.snapshotTanggal || p.tanggal,
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
  let bytes=0;
  for (const item of items) {
    const p = await ctx.db.get(item.pertemuanId);
    if (!p || p.kelasId !== kelasId) throw new ConvexError("AKSES_DITOLAK");
    if (!item.revisionId&&(p.cancelled || p.status !== "KUNCI" || p.revision !== item.revision))
      throw new ConvexError("PAKET_BERUBAH");
    const data=await packetGenerationData(ctx,p,item);
    if(data.pertemuan.revision!==item.revision)throw new ConvexError("PAKET_BERUBAH");
    bytes+=getConvexSize(data);if(bytes>4000000)throw new ConvexError("PAKET_TERLALU_BESAR");
    result.push(data);
  }
  return result.sort((a, b) => a.pertemuan.nomor - b.pertemuan.nomor);
}
