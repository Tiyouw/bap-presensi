import { ConvexError, getConvexSize } from "convex/values";
import { classSnapshot } from "./classLogic.js";
import { assertSnapshotSize } from "./snapshotSize.js";

export const LEDGER_VERSION = "full-control-ledger-v1";
export const CONTROL_FLAG = "full-control-v1";
export const revisionByNumber = (ctx, pertemuanId, revision) => ctx.db.query("meetingRevision")
  .withIndex("by_meeting_revision", q => q.eq("pertemuanId", pertemuanId).eq("revision", revision)).unique();
export async function controlEnabled(ctx) {
  return Boolean((await ctx.db.query("featureFlag").withIndex("by_key", q => q.eq("key", CONTROL_FLAG)).unique())?.enabled);
}
export async function revisionProtocolEnabled(ctx){const flag=await ctx.db.query("featureFlag").withIndex("by_key",q=>q.eq("key",CONTROL_FLAG)).unique();return Boolean(flag?.enabled||flag?.everEnabled);}
export async function activeStatuses(ctx, pertemuanId) {
  return (await ctx.db.query("presensi").withIndex("by_pertemuan", q => q.eq("pertemuanId", pertemuanId)).collect())
    .map(({pesertaId,status}) => ({pesertaId,status}));
}
export async function readRevision(ctx, revision) {
  if (!revision) return null;
  const parts = await ctx.db.query("revisionRows").withIndex("by_revision", q => q.eq("revisionId", revision._id)).collect();
  const payload=await ctx.db.query("revisionPayload").withIndex("by_revision",q=>q.eq("revisionId",revision._id)).unique();
  if(!payload)throw new ConvexError("REVISI_TIDAK_LENGKAP");
  const rows = parts.sort((a,b) => a.part-b.part).flatMap(p => p.rows);
  if (rows.length !== revision.rowCount) throw new ConvexError("REVISI_TIDAK_LENGKAP");
  return { ...revision, snapshot: { ...payload.snapshot, peserta: rows.map(r => r.peserta) },
    statuses: rows.filter(r => r.status !== null).map(r => ({pesertaId:r.peserta.id,status:r.status})) };
}
// Append-only ledger. Participants/statuses are chunked independently of the
// template so no single document grows with the history or participant count.
export async function appendRevision(ctx, p, options = {}) {
  const existing = await revisionByNumber(ctx, p._id, p.revision);
  if (existing) return existing;
  if (!p.kelasId) throw new ConvexError("KELAS_TIDAK_ADA");
  const snapshot = options.snapshot || p.snapshot || await classSnapshot(ctx, p.kelasId, p);
  assertSnapshotSize(snapshot);
  const statuses = options.statuses || await activeStatuses(ctx, p._id), byId = new Map(statuses.map(s=>[s.pesertaId,s.status]));
  const {peserta,...metadata} = snapshot;
  const rows = peserta.map(person=>({peserta:person,status:byId.get(person.id) ?? null}));
  const incomplete = p.status === "KUNCI" && p.tipe === "REGULER" && (!rows.length||rows.some(r=>r.status===null));
  const header = {
    pertemuanId:p._id, kelasId:p.kelasId, revision:p.revision,
    ...(options.unknownNumber ? {} : {nomor:p.nomor}), tanggal:snapshot.tanggal || p.tanggal,
    tempat:snapshot.tempat || p.tempat, tipe:p.tipe, status:p.status, cancelled:Boolean(p.cancelled),
    rowCount:rows.length,legacyPartial:Boolean(options.legacyPartial || incomplete),
    metadataVerified:!options.unknownNumber, action:options.action || "BASELINE",reason:options.reason || "Baseline data tersimpan",
    createdAt:Date.now(), ...(options.actorId?{actorId:options.actorId}:{}),
    ...(options.parentRevision!==undefined?{parentRevision:options.parentRevision}:{}),
    ...(options.operationKey?{operationKey:options.operationKey}:{}),
    ...(options.operationHash?{operationHash:options.operationHash}:{}),
    ...(options.requiredCapabilities?{requiredCapabilities:options.requiredCapabilities}:{}),
  };
  if (getConvexSize(metadata)>800000) throw new ConvexError("REVISI_TERLALU_BESAR");
  const id=await ctx.db.insert("meetingRevision",header);
  await ctx.db.insert("revisionPayload",{revisionId:id,snapshot:metadata});
  let part=0,chunk=[],bytes=0;
  for(const row of rows){const size=getConvexSize(row);if(size>150000)throw new ConvexError("REVISI_TERLALU_BESAR");
    if(bytes+size>150000){await ctx.db.insert("revisionRows",{revisionId:id,part:part++,rows:chunk});chunk=[];bytes=0;}
    chunk.push(row);bytes+=size;
  }
  if(chunk.length)await ctx.db.insert("revisionRows",{revisionId:id,part,rows:chunk});
  return {_id:id,...header};
}
export async function archiveMetadata(ctx, doc) {
  if(doc.archiveMetadata)return doc.archiveMetadata;
  const r=await revisionByNumber(ctx,doc.pertemuanId,doc.revision);
  if(r)return {nomor:r.nomor ?? null,tanggal:r.tanggal,tempat:r.tempat,tipe:r.tipe,metadataVerified:r.metadataVerified};
  // A legacy file does not prove its meeting number or attendance. Never fill
  // those gaps using values from today's mutable meeting.
  return {nomor:null,tanggal:doc.snapshot?.tanggal || null,tempat:doc.snapshot?.tempat || null,tipe:"REGULER",metadataVerified:false};
}
