import { ConvexError } from "convex/values";
import { requireMeeting, audit, requireHistoricalAttendance } from "./access.js";
import { classSnapshot, readableDetail } from "./classLogic.js";
import { assertSnapshotSize } from "./snapshotSize.js";
import { syncClass, syncMeeting } from "./readModels.js";
import { appendRevision } from "./revisionLedger.js";
export const detailLogic = readableDetail;
export async function simpanDanKunciLogic(ctx, args) {
  const { meeting: p, user } = await requireMeeting(
    ctx,
    args.token,
    args.pertemuanId,
    true,
  );
  await requireHistoricalAttendance(ctx,args.token,p);
  if (p.tipe !== "REGULER") throw new ConvexError("TANPA_PRAKTIKUM");
  if (p.revision !== args.baseRevision) throw new ConvexError("KONFLIK_REVISI");
  if (p.status !== "TERBUKA") throw new ConvexError("SUDAH_DIKUNCI");
  const snapshot = p.snapshot || (await classSnapshot(ctx, p.kelasId, p)),
    registered = new Set(snapshot.peserta.map((p) => p.id)),
    sent = new Set();
  if (!registered.size) throw new ConvexError("PESERTA_KURANG");
  for (const s of args.statuses) {
    if (!registered.has(s.pesertaId)) throw new ConvexError("PESERTA_ASING");
    if (sent.has(s.pesertaId)) throw new ConvexError("PESERTA_DOBEL");
    if (!["HADIR", "ALPHA", "SAKIT", "IZIN"].includes(s.status))
      throw new ConvexError("STATUS_TIDAK_VALID");
    sent.add(s.pesertaId);
  }
  if (sent.size !== registered.size) throw new ConvexError("PESERTA_KURANG");
  assertSnapshotSize(snapshot);
  await appendRevision(ctx, p);
  const old = await ctx.db
    .query("presensi")
    .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", p._id))
    .collect();
  for (const row of old) await ctx.db.delete(row._id);
  for (const row of args.statuses)
    await ctx.db.insert("presensi", { ...row, pertemuanId: p._id });
  const revision = p.revision + 1;
  await ctx.db.patch(p._id, {
    status: "KUNCI",
    hasAttendanceHistory:true,
    revision,
    dikunciPada: Date.now(),
    snapshot,
  });
  await appendRevision(ctx, await ctx.db.get(p._id), { snapshot, statuses:args.statuses,
    actorId:user._id,action:"SIMPAN_KUNCI",reason:"Simpan dan kunci presensi",parentRevision:p.revision });
  await syncMeeting(ctx, p._id);
  await syncClass(ctx, p.kelasId);
  await audit(
    ctx,
    user,
    "SIMPAN_KUNCI",
    `Revisi ${revision}; ${args.statuses.filter((s) => s.status !== "HADIR").length} tidak hadir`,
    p.kelasId,
    p._id,
  );
  return { ok: true, revision };
}
export async function bukaKunciLogic(ctx, args) {
  const { meeting: p, user } = await requireMeeting(
    ctx,
    args.token,
    args.pertemuanId,
    true,
  );
  await requireHistoricalAttendance(ctx,args.token,p);
  if (p.tipe !== "REGULER") throw new ConvexError("TANPA_PRAKTIKUM");
  if (p.revision !== args.expectedRevision)
    throw new ConvexError("KONFLIK_REVISI");
  if (p.status !== "KUNCI") return { ok: true, revision: p.revision };
  await appendRevision(ctx, p);
  await ctx.db.patch(p._id, { status: "TERBUKA",hasAttendanceHistory:true });
  await syncMeeting(ctx, p._id);
  await syncClass(ctx, p.kelasId);
  await audit(
    ctx,
    user,
    "BUKA_KUNCI",
    `Revisi ${p.revision}`,
    p.kelasId,
    p._id,
  );
  return { ok: true, revision: p.revision };
}
