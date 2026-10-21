import { ConvexError } from "convex/values";
import { requireClass } from "./access.js";
import { DEFAULT_TEMPLATE } from "../../bap-shared/management.js";
export function meetingSummary({snapshot,...meeting}) {return {...meeting,hasSnapshot:Boolean(snapshot)||Boolean(meeting.hasSnapshot),id:meeting._id};}
export async function classRows(ctx, table, kelasId) {
  if (table === "pertemuan" && (await ctx.db.get(kelasId))?.readModelReady) {
    return (await ctx.db.query("meetingView").withIndex("by_kelas", q => q.eq("kelasId", kelasId)).collect()).map(v => v.data);
  }
  return ctx.db
    .query(table)
    .withIndex("by_kelas", (q) => q.eq("kelasId", kelasId))
    .collect();
}
export async function classSnapshot(ctx, kelasId, meeting) {
  const kelas = await ctx.db.get(kelasId),
    matkul = await ctx.db.get(kelas.matkulId);
  const template = await ctx.db
    .query("template")
    .withIndex("by_kelas_version", (q) =>
      q.eq("kelasId", kelasId).eq("version", kelas.templateVersion),
    )
    .unique();
  const peserta = (await classRows(ctx, "peserta", kelasId))
    .filter((p) => p.aktif !== false)
    .sort((a, b) => a.golongan.localeCompare(b.golongan) || a.urut - b.urut)
    .map((p) => ({
      id: p._id,
      nim: p.nim,
      nama: p.nama,
      golongan: p.golongan,
      urut: p.urut,
    }));
  return {
    capturedAt: Date.now(),
    kelas: { ...Object.fromEntries(Object.entries(kelas).filter(([key])=>key!=="templateDraft")), matkulNama: kelas.courseOverride?.nama||matkul.nama, matkulKode: kelas.courseOverride?.kode||matkul.kode },
    template: template?.config || DEFAULT_TEMPLATE,
    templateVersion: `kelas-${kelasId}-v${kelas.templateVersion}`,
    peserta,
    tanggal: meeting.tanggal,
    tempat: meeting.tempat,
  };
}
export async function readableDetail(ctx, { token, pertemuanId }) {
  const meeting = await ctx.db.get(pertemuanId);
  if (!meeting) throw new ConvexError("PERTEMUAN_TIDAK_ADA");
  await requireClass(ctx, token, meeting.kelasId);
  const rows = await ctx.db
    .query("presensi")
    .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", pertemuanId))
    .collect();
  const snapshot =
    meeting.snapshot || (await classSnapshot(ctx, meeting.kelasId, meeting));
  return {
    pertemuan: { ...meeting, id: meeting._id },
    peserta: snapshot.peserta,
    kelas: snapshot.kelas,
    presensi: rows.map((r) => ({ pesertaId: r.pesertaId, status: r.status })),
  };
}
