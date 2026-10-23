import { classRows } from "./classLogic.js";
import { archiveMetadata } from "./revisionLedger.js";
export const READ_MODEL_VERSION = "audit-read-model-v1";
export async function readModelsReady(ctx) {
  return Boolean(await ctx.db.query("migrasi").withIndex("by_versi", q => q.eq("versi", READ_MODEL_VERSION)).unique());
}
async function put(ctx, table, index, field, value, data) {
  const old = await ctx.db.query(table).withIndex(index, q => q.eq(field, value)).unique();
  if (old) await ctx.db.patch(old._id, data);
  else await ctx.db.insert(table, data);
}
async function remove(ctx, table, sourceId) {
  const old = await ctx.db.query(table).withIndex("by_source", q => q.eq("sourceId", sourceId)).unique();
  if (old) await ctx.db.delete(old._id);
}
export async function syncParticipant(ctx, id) {
  const p = await ctx.db.get(id);
  if (!p?.kelasId) return;
  await put(ctx, "searchEntry", "by_source", "sourceId", `peserta:${id}`, {
    sourceId: `peserta:${id}`, kelasId: p.kelasId,
    text: `${p.nama} ${p.nim} ${p.golongan}`,
    data: { kind: "Mahasiswa", id, title: p.nama, nim: p.nim, path: `/kelas/${p.kelasId}?tab=mahasiswa&person=${id}` },
  });
}
export async function syncMeeting(ctx, id) {
  const p = await ctx.db.get(id);
  if (!p) {
    await remove(ctx, "meetingView", id);
    await remove(ctx, "searchEntry", `pertemuan:${id}`);
    return;
  }
  if (!p.kelasId) return;
  const { snapshot, ...data } = p;
  const recorded=await ctx.db.query("presensi").withIndex("by_pertemuan",q=>q.eq("pertemuanId",id)).collect();
  await put(ctx, "meetingView", "by_source", "sourceId", id, {
    sourceId: id, kelasId: p.kelasId,
    data: { ...data, hasSnapshot:Boolean(snapshot),jumlahAbsen:recorded.filter(r=>r.status!=="HADIR").length,jumlahTercatat:recorded.length, ...(snapshot?.tanggal ? { snapshotTanggal: snapshot.tanggal } : {}) },
  });
  await put(ctx, "searchEntry", "by_source", "sourceId", `pertemuan:${id}`, {
    sourceId: `pertemuan:${id}`, kelasId: p.kelasId,
    text: `minggu ${p.nomor} pertemuan ${p.nomor} ${p.tanggal}`,
    data: { kind: p.cancelled ? "Pertemuan dibatalkan" : p.status === "KUNCI" ? "Dokumen / pertemuan" : "Pertemuan", id, cancelled:Boolean(p.cancelled),
      title: `Pertemuan ${p.nomor} · ${p.tanggal}`,
      path: !p.cancelled && p.tipe === "REGULER" ? `/kelas/${p.kelasId}/pertemuan/${id}` : `/kelas/${p.kelasId}?tab=jadwal` },
  });
}
export async function syncTemplate(ctx, id) {
  const t = await ctx.db.get(id);
  if (!t) return;
  const { config, ...data } = t;
  await put(ctx, "templateView", "by_source", "sourceId", id, { sourceId: id, kelasId: t.kelasId, version: t.version, data });
}
export async function syncDocument(ctx, id) {
  const d = await ctx.db.get(id);
  if (!d || d.status !== "READY" || !d.storageId) return;
  const p = await ctx.db.get(d.pertemuanId);
  if (!p?.kelasId) return;
  const frozen = await archiveMetadata(ctx,d);
  await put(ctx, "documentView", "by_source", "sourceId", id, {
    sourceId: id, kelasId: p.kelasId, pertemuanId: p._id, format: d.format || "docx", revision: d.revision, pada: d.klaimPada,
    data: { id, pertemuanId: p._id, nomor: frozen.nomor, tanggal: frozen.tanggal, metadataVerified:frozen.metadataVerified, revision: d.revision,
      format: d.format || "docx", templateVersion: d.templateVersion, pada: d.klaimPada, sha256: d.sha256 || null },
  });
}
export async function syncClass(ctx, kelasId) {
  const c = await ctx.db.get(kelasId), m = await ctx.db.get(c.matkulId);
  const meetings = await classRows(ctx, "pertemuan", kelasId), participants = await classRows(ctx, "peserta", kelasId);
  const { templateDraft, ...data } = c;
  await put(ctx, "classView", "by_kelas", "kelasId", kelasId, {
    kelasId, matkulId: c.matkulId,
    data: { ...data, matkulNama: m.nama, matkulKode: m.kode,
      jumlahPeserta: participants.filter(p => p.aktif !== false).length,
      jumlahPraktikum: meetings.filter(p => !p.cancelled && p.tipe === "REGULER").length,
      jumlahTerkunci: meetings.filter(p => !p.cancelled && p.tipe === "REGULER" && p.status === "KUNCI").length,
      berikutnya: meetings.filter(p => !p.cancelled && p.tipe === "REGULER" && p.status !== "KUNCI")
        .sort((a,b) => a.tanggal.localeCompare(b.tanggal))[0]?.tanggal || null,
    },
  });
}
export async function visibleClasses(ctx, user) {
  if (user.peran === "ADMIN") {
    if (await readModelsReady(ctx)) return (await ctx.db.query("classView").collect()).map(v => v.data);
    return ctx.db.query("kelas").collect(); // Transitional fallback until the resumable backfill finishes.
  }
  return (await Promise.all([...new Set(user.kelasIds)].map(async id => {
    const view = await ctx.db.query("classView").withIndex("by_kelas", q => q.eq("kelasId", id)).unique();
    return view?.data || await ctx.db.get(id);
  }))).filter(Boolean);
}
