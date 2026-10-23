import {ConvexError} from "convex/values";
import {requireCapability,requireMeeting,audit} from "./access.js";
import {classSnapshot,classRows} from "./classLogic.js";
import {activeStatuses,appendRevision,readRevision,revisionByNumber,controlEnabled} from "./revisionLedger.js";
import {syncMeeting,syncClass} from "./readModels.js";
import {hashToken} from "./auth.js";
import {assertSnapshotSize} from "./snapshotSize.js";
import {MEETING_FIELDS,SNAPSHOT_CATEGORIES} from "../../bap-shared/control.js";
import {TYPES,text,validDate} from "../../bap-shared/management.js";

const codes=new Set(["HADIR","ALPHA","SAKIT","IZIN"]);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function correctionAccess(ctx,a,caps=[]){
  const {meeting}=await requireMeeting(ctx,a.token,a.pertemuanId);
  const access=await requireCapability(ctx,a.token,meeting.kelasId,caps);
  if(!access.kelas.revisionReady||!await controlEnabled(ctx))throw new ConvexError("KOREKSI_BELUM_AKTIF");
  return{...access,meeting};
}
export async function prepareCorrection(ctx,a){
  const access=await correctionAccess(ctx,a),{meeting:p,kelas,user}=access;
  if(kelas.revision!==a.expectedClassRevision||p.revision!==a.expectedMeetingRevision)throw new ConvexError("KONFLIK_REVISI");
  const patch=a.patch||{},categories=a.refreshCategories||[];
  if(!patch||Array.isArray(patch)||typeof patch!=="object"||Object.keys(patch).some(k=>!MEETING_FIELDS.includes(k)))throw new ConvexError("KOREKSI_TIDAK_VALID");
  if(categories.some(k=>!SNAPSHOT_CATEGORIES.includes(k))||new Set(categories).size!==categories.length)throw new ConvexError("KOREKSI_TIDAK_VALID");
  const previousStatuses=await activeStatuses(ctx,p._id);
  const wasPublished=p.hasAttendanceHistory!==undefined?Boolean(p.hasAttendanceHistory)||p.status==="KUNCI":Boolean(p.status==="KUNCI"||p.dikunciPada||p.revision>0&&previousStatuses.length);
  const historical=wasPublished||previousStatuses.length>0;
  const caps=[...(Object.keys(patch).length?["schedule"]:[]),...categories.map(k=>k==="roster"?"roster":k),...(historical||a.restoreRevision!==undefined||a.statuses?["history"]:[])];
  if(a.templateVersion!==undefined)caps.push("template");
  if(a.lifecycleAction)caps.push("lifecycle");
  await requireCapability(ctx,a.token,p.kelasId,[...new Set(caps)]);
  if(p.cancelled&&a.lifecycleAction!=="restore"&&a.restoreRevision===undefined)throw new ConvexError("PERTEMUAN_DIBATALKAN");
  const previousSnapshot=p.snapshot||{...await classSnapshot(ctx,p.kelasId,p),capturedAt:p._creationTime||0};
  let snapshot=structuredClone(previousSnapshot),statuses=previousStatuses.map(s=>({...s})),next={...p};
  if(a.restoreRevision!==undefined){
    if(categories.length||Object.keys(patch).length||a.statuses||a.templateVersion!==undefined)throw new ConvexError("KOREKSI_TIDAK_VALID");
    const source=await readRevision(ctx,await revisionByNumber(ctx,p._id,a.restoreRevision));
    if(!source||source.legacyPartial||!source.metadataVerified)throw new ConvexError("REVISI_LAMA_PARSIAL");
    await requireCapability(ctx,a.token,p.kelasId,["history","schedule","identity","roster","template","lifecycle"]);
    snapshot=structuredClone(source.snapshot);statuses=source.statuses;next={...next,nomor:source.nomor,tanggal:source.tanggal,tempat:source.tempat,tipe:source.tipe,cancelled:source.cancelled,status:source.status};
  }else{
    if(categories.length){const fresh=await classSnapshot(ctx,p.kelasId,p);
      if(categories.includes("identity"))snapshot.kelas=fresh.kelas;
      if(categories.includes("roster"))snapshot.peserta=fresh.peserta;
      if(categories.includes("template")){snapshot.template=fresh.template;snapshot.templateVersion=fresh.templateVersion;}
    }
    if(a.templateVersion!==undefined){const t=await ctx.db.query("template").withIndex("by_kelas_version",q=>q.eq("kelasId",p.kelasId).eq("version",a.templateVersion)).unique();
      if(!t)throw new ConvexError("TEMPLATE_TIDAK_ADA");snapshot.template=t.config;snapshot.templateVersion=`kelas-${p.kelasId}-v${t.version}`;}
    Object.assign(next,patch);
  }
  if(a.lifecycleAction){if(a.restoreRevision!==undefined)throw new ConvexError("KOREKSI_TIDAK_VALID");next.cancelled=a.lifecycleAction==="cancel";}
  if(!Number.isInteger(next.nomor)||next.nomor<1||next.nomor>1000||!TYPES.includes(next.tipe))throw new ConvexError("JADWAL_TIDAK_VALID");
  try{validDate(next.tanggal);}catch{throw new ConvexError({code:"TANGGAL_TIDAK_VALID",message:"Tanggal tidak valid. Pilih tanggal kalender yang benar."});}next.tempat=text(next.tempat,"Ruang",80);
  snapshot.tanggal=next.tanggal;snapshot.tempat=next.tempat;
  const peers=(await classRows(ctx,"pertemuan",p.kelasId)).map(x=>a.peerOverrides?.[x._id]?{...x,...a.peerOverrides[x._id]}:x).filter(x=>x._id!==p._id&&!x.cancelled);
  if(!next.cancelled&&p.cancelled&&peers.length>=100)throw new ConvexError("BATAS_SESI_AKTIF");
  if(!next.cancelled&&peers.some(x=>x.nomor===next.nomor))throw new ConvexError("NOMOR_PERTEMUAN_DUPLIKAT");
  const rosterChanged=!same(previousSnapshot.peserta,snapshot.peserta),oldStatuses=new Map(statuses.map(s=>[s.pesertaId,s.status]));
  const returning=a.restoreRevision===undefined&&p.tipe!=="REGULER"&&next.tipe==="REGULER"&&historical;
  if(returning&&!a.attendanceMode)throw new ConvexError("PILIH_PRESENSI_KEMBALI");
  if(returning&&a.attendanceMode==="reset"&&a.statuses)throw new ConvexError("KOREKSI_TIDAK_VALID");
  const resetAttendance=returning&&a.attendanceMode==="reset";
  const shouldHaveStatuses=resetAttendance?false:a.restoreRevision!==undefined?statuses.length>0:previousStatuses.length>0||Boolean(a.statuses);
  if(resetAttendance)statuses=[];
  if(a.statuses){
    const ids=new Set(snapshot.peserta.map(p=>p.id));if(a.statuses.length!==ids.size||new Set(a.statuses.map(s=>s.pesertaId)).size!==ids.size||a.statuses.some(s=>!ids.has(s.pesertaId)||!codes.has(s.status)))throw new ConvexError("PRESENSI_KOREKSI_TIDAK_LENGKAP");
    statuses=a.statuses;
  }else if(shouldHaveStatuses){const oldIds=new Set(previousSnapshot.peserta.map(p=>p.id));statuses=snapshot.peserta.flatMap(person=>oldStatuses.has(person.id)?[{pesertaId:person.id,status:oldStatuses.get(person.id)}]:rosterChanged&&!oldIds.has(person.id)?[{pesertaId:person.id,status:"HADIR"}]:[]);}
  const missingHistorical=historical&&(p.status==="KUNCI"||previousStatuses.length>0)&&previousSnapshot.peserta.some(person=>!previousStatuses.some(s=>s.pesertaId===person.id));
  const needsRosterReview=rosterChanged||missingHistorical;
  if(kelas.draft&&shouldHaveStatuses)throw new ConvexError("KELAS_BELUM_AKTIF");
  if(a.restoreRevision===undefined)next.status=shouldHaveStatuses&&next.tipe==="REGULER"&&snapshot.peserta.length>0&&statuses.length===snapshot.peserta.length&&(wasPublished||a.statuses)?"KUNCI":"TERBUKA";
  if(resetAttendance)next.status="TERBUKA";
  const reason=text(a.reason||"","Catatan",240,false);
  if((historical||a.restoreRevision!==undefined||a.lifecycleAction)&&!reason)throw new ConvexError("CATATAN_KOREKSI_WAJIB");
  const fields=MEETING_FIELDS.filter(k=>next[k]!==p[k]).map(k=>({field:k,before:p[k],after:next[k]}));
  if(next.status!==p.status)fields.push({field:"status",before:p.status,after:next.status});
  if(Boolean(next.cancelled)!==Boolean(p.cancelled))fields.push({field:"cancelled",before:Boolean(p.cancelled),after:Boolean(next.cancelled)});
  const refresh=SNAPSHOT_CATEGORIES.filter(k=>k==="identity"?!same(previousSnapshot.kelas,snapshot.kelas):k==="roster"?rosterChanged:!same(previousSnapshot.template,snapshot.template)||previousSnapshot.templateVersion!==snapshot.templateVersion);
  const statusChanged=!same([...previousStatuses].sort((a,b)=>a.pesertaId.localeCompare(b.pesertaId)),[...statuses].sort((a,b)=>a.pesertaId.localeCompare(b.pesertaId)));
  if(!fields.length&&!refresh.length&&!statusChanged&&a.restoreRevision===undefined)throw new ConvexError("KOREKSI_TANPA_PERUBAHAN");
  assertSnapshotSize(snapshot);
  const warnings=[];if(peers.some(x=>x.tanggal===next.tanggal))warnings.push("Tanggal sama dengan pertemuan lain; pastikan pelaksanaannya benar.");
  if(peers.some(x=>x.nomor<next.nomor&&x.tanggal>next.tanggal||x.nomor>next.nomor&&x.tanggal<next.tanggal))warnings.push("Urutan tanggal berbeda dengan nomor minggu; periksa sebelum menyimpan.");
  const previewHash=await hashToken(JSON.stringify({actor:user._id,meeting:p._id,base:p.revision,classRevision:kelas.revision,fields,refresh,snapshot,statuses,reason,restore:a.restoreRevision??null,lifecycle:a.lifecycleAction||null,attendanceMode:a.attendanceMode||null}));
  return{...access,next,snapshot,statuses,reason,previewHash,historical,wasPublished,needsRosterReview,fields,refresh,statusChanged,warnings,requiredCapabilities:[...new Set(a.restoreRevision!==undefined?[...caps,"schedule","identity","roster","template","lifecycle"]:caps)],
    keepLiveSnapshot:shouldHaveStatuses||Boolean(p.snapshot)||categories.length>0||a.templateVersion!==undefined};
}
export function publicCorrectionPreview(p){return{previewHash:p.previewHash,fields:p.fields,refresh:p.refresh,statusChanged:p.statusChanged,
  needsRosterReview:p.needsRosterReview,warnings:p.warnings,previousRevision:p.meeting.revision,nextRevision:p.meeting.revision+1,
  snapshot:p.snapshot,statuses:p.statuses,historical:p.historical,reason:p.reason};}
export async function commitCorrectionLogic(ctx,a){
  const access=await correctionAccess(ctx,a);
  if(typeof a.operationKey!=="string"||a.operationKey.length<16||a.operationKey.length>128)throw new ConvexError("KOREKSI_TIDAK_VALID");
  const previous=await ctx.db.query("meetingRevision").withIndex("by_operation",q=>q.eq("pertemuanId",a.pertemuanId).eq("operationKey",a.operationKey)).unique();
  if(previous){if(previous.operationHash!==a.previewHash||previous.actorId!==access.user._id)throw new ConvexError("KUNCI_OPERASI_DIPAKAI");
    // Recheck permissions on a retry, including grants revoked after the first commit.
    await requireCapability(ctx,a.token,access.kelas._id,previous.requiredCapabilities||["history"]);return{revision:previous.revision,id:previous._id,replayed:true};}
  const prepared=await prepareCorrection(ctx,a);
  if(prepared.previewHash!==a.previewHash)throw new ConvexError("PREVIEW_KOREKSI_BERUBAH");
  if(prepared.needsRosterReview&&!a.rosterReviewed)throw new ConvexError("PERIKSA_ROSTER_KOREKSI");
  return applyCorrection(ctx,prepared,a);
}
export async function applyCorrection(ctx,p,a){
  await appendRevision(ctx,p.meeting);
  const next={nomor:p.next.nomor,tanggal:p.next.tanggal,tempat:p.next.tempat,tipe:p.next.tipe,status:p.next.status,
    hasAttendanceHistory:Boolean(p.wasPublished||p.next.status==="KUNCI"),
    cancelled:Boolean(p.next.cancelled),revision:p.meeting.revision+1,...(p.keepLiveSnapshot?{snapshot:p.snapshot}:{})};
  if(p.next.status==="KUNCI")next.dikunciPada=Date.now();
  await ctx.db.patch(p.meeting._id,next);
  if(p.statusChanged){
    for(const row of await ctx.db.query("presensi").withIndex("by_pertemuan",q=>q.eq("pertemuanId",p.meeting._id)).collect())await ctx.db.delete(row._id);
    for(const row of p.statuses)await ctx.db.insert("presensi",{pertemuanId:p.meeting._id,pesertaId:row.pesertaId,status:row.status});
  }
  const saved=await appendRevision(ctx,await ctx.db.get(p.meeting._id),{snapshot:p.snapshot,statuses:p.statuses,reason:p.reason||"Penyesuaian jadwal",
    action:a.restoreRevision!==undefined?"PULIHKAN_REVISI":a.lifecycleAction==="cancel"?"BATALKAN_SESI":a.lifecycleAction==="restore"?"PULIHKAN_SESI":"KOREKSI",actorId:p.user._id,parentRevision:p.meeting.revision,
    operationKey:a.operationKey,operationHash:p.previewHash,requiredCapabilities:p.requiredCapabilities});
  await ctx.db.patch(p.kelas._id,{revision:p.kelas.revision+1});await syncMeeting(ctx,p.meeting._id);await syncClass(ctx,p.kelas._id);
  await audit(ctx,p.user,a.restoreRevision!==undefined?"PULIHKAN_REVISI":"KOREKSI_SESI",`Revisi ${saved.revision}: ${p.reason||"penyesuaian jadwal"}`,p.kelas._id,p.meeting._id);
  return{revision:saved.revision,id:saved._id,replayed:false};
}
