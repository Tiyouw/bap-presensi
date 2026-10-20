import { ConvexError } from "convex/values";
import { requireMeeting, audit } from "./access.js";
import { classSnapshot, readableDetail } from "./classLogic.js";
export const detailLogic = readableDetail;
export async function simpanDanKunciLogic(ctx, args) {
  const { meeting: p, user } = await requireMeeting(
    ctx,
    args.token,
    args.pertemuanId,
    true,
  );
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
    revision,
    dikunciPada: Date.now(),
    snapshot,
  });
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
  if (p.tipe !== "REGULER") throw new ConvexError("TANPA_PRAKTIKUM");
  if (p.status !== "KUNCI") return { ok: true, revision: p.revision };
  await ctx.db.patch(p._id, { status: "TERBUKA" });
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
