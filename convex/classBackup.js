import {v,ConvexError,getConvexSize} from "convex/values";
import {paginationOptsValidator} from "convex/server";
import {query,mutation} from "./_generated/server.js";
import {requireCapability,audit} from "./lib/access.js";
import {classRows,classSnapshot} from "./lib/classLogic.js";
import {controlEnabled,readRevision,activeStatuses,appendRevision} from "./lib/revisionLedger.js";
import {syncParticipant,syncClass,syncMeeting,syncTemplate} from "./lib/readModels.js";
import {hashToken} from "./lib/auth.js";
import {assertSnapshotSize} from "./lib/snapshotSize.js";
import {BACKUP_FORMAT,BACKUP_VERSION,identityData,participantData,versionData,normalizeBackupSelection} from "../bap-shared/backup.js";
const namespace=()=>process.env.CONVEX_CLOUD_URL||process.env.CONVEX_SITE_URL||"local-handler-tests";
async function access(ctx,a,caps=["export"],write=false){
 const result=await requireCapability(ctx,a.token,a.kelasId,caps,write);
 if(!result.kelas.revisionReady||!await controlEnabled(ctx))throw new ConvexError("KOREKSI_BELUM_AKTIF");return result;
}
async function exportState(ctx,kelas){
 const meetings=await classRows(ctx,"pertemuan",kelas._id);
 const guard=await hashToken(JSON.stringify({revision:kelas.revision,meetings:meetings.map(p=>[p._id,p.revision,p.status,Boolean(p.cancelled)]).sort()}));
 return{meetings,guard};
}
export const manifest=query({args:{token:v.string(),kelasId:v.id("kelas")},handler:async(ctx,a)=>{
 const{kelas}=await access(ctx,a),{guard}=await exportState(ctx,kelas),course=await ctx.db.get(kelas.matkulId);
 const template=await ctx.db.query("template").withIndex("by_kelas_version",q=>q.eq("kelasId",kelas._id).eq("version",kelas.templateVersion)).unique();
 return{format:BACKUP_FORMAT,version:BACKUP_VERSION,source:{namespace:namespace(),kelasId:kelas._id},exportedAt:Date.now(),guard,classRevision:kelas.revision,
  identity:identityData({...kelas,matkulNama:kelas.courseOverride?.nama||course.nama,matkulKode:kelas.courseOverride?.kode||course.kode}),template:template.config,
  filesIncluded:false,fileNote:"JSON berisi data dan manifest hash. Unduh Word/PDF terpisah melalui arsip; file biner tidak dimasukkan."};
}});
export const page=query({args:{token:v.string(),kelasId:v.id("kelas"),guard:v.string(),section:v.union(v.literal("participants"),v.literal("meetings"),v.literal("versions"),v.literal("documents")),paginationOpts:paginationOptsValidator},handler:async(ctx,a)=>{
 const{kelas}=await access(ctx,a);if((await exportState(ctx,kelas)).guard!==a.guard)throw new ConvexError("BACKUP_DATA_BERUBAH");
 const table={participants:"peserta",meetings:"pertemuan",versions:"meetingRevision",documents:"documentView"}[a.section],index={participants:"by_kelas",meetings:"by_kelas",versions:"by_class",documents:"by_kelas_pada"}[a.section];
 const result=await ctx.db.query(table).withIndex(index,q=>q.eq("kelasId",kelas._id)).paginate({...a.paginationOpts,numItems:a.section==="meetings"||a.section==="versions"?1:Math.max(1,Math.min(100,a.paginationOpts.numItems)),maximumBytesRead:1500000});
 const rows=[];for(const row of result.page){
  if(a.section==="participants")rows.push(participantData(row));
  if(a.section==="meetings")rows.push({sourceId:row._id,version:versionData({...row,metadataVerified:true,snapshot:row.snapshot||await classSnapshot(ctx,kelas._id,row),statuses:await activeStatuses(ctx,row._id)})});
  if(a.section==="versions"){const r=await readRevision(ctx,row);rows.push({sourceId:row.pertemuanId,version:versionData(r)});}
  if(a.section==="documents"){const d=row.data;rows.push({meetingId:d.pertemuanId,nomor:d.nomor,tanggal:d.tanggal,revision:d.revision,format:d.format,sha256:d.sha256,templateVersion:d.templateVersion,metadataVerified:d.metadataVerified});}
 }
 return{...result,page:rows};
}});
const restoreArgs={token:v.string(),kelasId:v.id("kelas"),expectedClassRevision:v.number(),targetMeetingId:v.optional(v.id("pertemuan")),expectedMeetingRevision:v.optional(v.number()),crossClass:v.boolean(),updateRoster:v.boolean(),payload:v.any(),mapping:v.optional(v.array(v.object({sourceId:v.string(),targetId:v.id("peserta")}))),reason:v.string()};
async function prepare(ctx,a){
 if(getConvexSize(a.payload)>4000000)throw new ConvexError("BACKUP_PILIH_BAGIAN");
 let data;try{data=normalizeBackupSelection(a.payload);}catch(e){throw new ConvexError(e.data||e.message||"BACKUP_TIDAK_VALID");}
 const caps=["export",...(a.updateRoster?["roster"]:[]),...(data.identity?["identity"]:[]),...(data.template?["template"]:[]),...(data.meeting?["schedule","history","identity","roster","template","lifecycle"]:[])];
 const{kelas,user}=await access(ctx,a,[...new Set(caps)],true);
 if(kelas.revision!==a.expectedClassRevision)throw new ConvexError("KONFLIK_REVISI");
 const sameClass=data.source.namespace===namespace()&&data.source.kelasId===kelas._id;
 if(!sameClass&&!a.crossClass)throw new ConvexError("BACKUP_LINTAS_KELAS_KONFIRMASI");
 if(typeof a.reason!=="string"||!a.reason.trim()||a.reason.length>240)throw new ConvexError("CATATAN_KOREKSI_WAJIB");
 const existing=await classRows(ctx,"peserta",kelas._id),byId=new Map(existing.map(p=>[p._id,p])),byNim=new Map(existing.map(p=>[p.nim.toUpperCase(),p])),manual=new Map();
 for(const m of a.mapping||[]){if(manual.has(m.sourceId)||!data.participants.some(p=>p.id===m.sourceId)||!byId.has(m.targetId))throw new ConvexError("BACKUP_PESERTA_ASING");manual.set(m.sourceId,m.targetId);}
 const mappings=[],used=new Set();let newCount=0,touched=0;
 const needed=new Set(a.updateRoster?data.participants.map(p=>p.id):data.meeting?.version.snapshot.peserta.map(p=>p.id)||[]);
 for(const source of data.participants.filter(p=>needed.has(p.id))){
  const target=manual.has(source.id)?byId.get(manual.get(source.id)):sameClass&&byId.has(source.id)?byId.get(source.id):byNim.get(source.nim.toUpperCase());
  const id=target?target._id:`new:${source.id}`;
  if(used.has(id))throw new ConvexError("BACKUP_PESERTA_DOBEL");used.add(id);
  if(a.updateRoster&&existing.some(p=>p._id!==target?._id&&p.nim.toUpperCase()===source.nim.toUpperCase()))throw new ConvexError("NIM_SUDAH_ADA");
  if(!target)newCount++;if(!target||a.updateRoster)touched++;
  mappings.push({sourceId:source.id,targetId:target?._id||null,source,action:!target?"Tambah":a.updateRoster?"Perbarui":"Pertahankan identitas aktif"});
 }
 if(touched>500)throw new ConvexError("BACKUP_PILIH_BAGIAN");
 let meeting=null,snapshot=null;
 if(data.meeting){
  if(kelas.draft)throw new ConvexError("KELAS_BELUM_AKTIF");
  meeting=a.targetMeetingId?await ctx.db.get(a.targetMeetingId):null;
  if(a.targetMeetingId&&(!meeting||meeting.kelasId!==kelas._id))throw new ConvexError("AKSES_DITOLAK");
  if(meeting&&meeting.revision!==a.expectedMeetingRevision)throw new ConvexError("KONFLIK_REVISI");
  const r=data.meeting.version,peers=await classRows(ctx,"pertemuan",kelas._id);
  if(!r.cancelled&&(!meeting||meeting.cancelled)&&peers.filter(p=>!p.cancelled).length>=100)throw new ConvexError("BATAS_SESI_AKTIF");
  if(!r.cancelled&&peers.some(p=>p._id!==meeting?._id&&!p.cancelled&&p.nomor===r.nomor))throw new ConvexError("NOMOR_PERTEMUAN_DUPLIKAT");
  snapshot={...r.snapshot,kelas:{...r.snapshot.kelas,_id:kelas._id},templateVersion:`backup-${await hashToken(JSON.stringify(r.snapshot.template))}`,capturedAt:0};
  assertSnapshotSize(snapshot);
 }
 if(!a.updateRoster&&!data.identity&&!data.template&&!data.meeting)throw new ConvexError("KOREKSI_TANPA_PERUBAHAN");
 const previewHash=await hashToken(JSON.stringify({actor:user._id,kelasId:kelas._id,revision:kelas.revision,target:a.targetMeetingId||null,meetingRevision:meeting?.revision??null,data,mappings,crossClass:a.crossClass,updateRoster:a.updateRoster,reason:a.reason.trim()}));
 return{user,kelas,data,caps:[...new Set(caps)],meeting,snapshot,mappings,newCount,touched,previewHash,reason:a.reason.trim(),sameClass};
}
function summary(p){return{previewHash:p.previewHash,participants:p.mappings.map(({source,...m})=>({...m,nim:source.nim,nama:source.nama})),newCount:p.newCount,touched:p.touched,crossClass:!p.sameClass,
 changes:{identity:Boolean(p.data.identity),template:Boolean(p.data.template),roster:p.touched,meeting:p.data.meeting?{nomor:p.data.meeting.version.nomor,tanggal:p.data.meeting.version.tanggal,fromRevision:p.meeting?.revision??null,toRevision:(p.meeting?.revision||0)+1}:null},
 warning:"Simpan membuat revisi baru dengan pelaku dan waktu sekarang. File serta riwayat lama tidak ditimpa."};}
export const previewRestore=query({args:restoreArgs,handler:async(ctx,a)=>summary(await prepare(ctx,a))});
export const commitRestore=mutation({args:{...restoreArgs,previewHash:v.string(),operationKey:v.string()},handler:async(ctx,a)=>{
 if(a.operationKey.length<16||a.operationKey.length>128)throw new ConvexError("BACKUP_TIDAK_VALID");
 const{kelas,user}=await access(ctx,a,["export"],true),old=await ctx.db.query("classOperation").withIndex("by_class_operation",q=>q.eq("kelasId",kelas._id).eq("operationKey",a.operationKey)).unique();
 if(old){if(old.actorId!==user._id||old.requestHash!==a.previewHash)throw new ConvexError("KUNCI_OPERASI_DIPAKAI");await requireCapability(ctx,a.token,kelas._id,old.result.requiredCapabilities||["export"]);return old.result;}
 const p=await prepare(ctx,a);if(p.previewHash!==a.previewHash)throw new ConvexError("PREVIEW_KOREKSI_BERUBAH");
 // Everything below is one native mutation; write failures roll back the whole cohort.
 const mapped=new Map();let urut=Math.max(0,...(await classRows(ctx,"peserta",kelas._id)).map(p=>p.urut));
 for(const item of p.mappings){const {id,...fields}=item.source;let target=item.targetId;
  if(!target)target=await ctx.db.insert("peserta",{...fields,kelasId:kelas._id,urut:++urut});
  else if(a.updateRoster)await ctx.db.patch(target,{nim:fields.nim,nama:fields.nama,golongan:fields.golongan,aktif:fields.aktif});
  mapped.set(item.sourceId,target);if(!item.targetId||a.updateRoster)await syncParticipant(ctx,target);
 }
 const classPatch={revision:kelas.revision+1};
 if(p.data.identity){const {matkulNama,matkulKode,...identity}=p.data.identity;Object.assign(classPatch,identity,{courseOverride:{nama:matkulNama,kode:matkulKode}});}
 if(p.data.template){const version=kelas.templateVersion+1;await syncTemplate(ctx,await ctx.db.insert("template",{kelasId:kelas._id,version,config:p.data.template,dibuatPada:Date.now(),dibuatOleh:user._id}));Object.assign(classPatch,{templateVersion:version,templateDraft:p.data.template});}
 let resultMeetingId=null,revision=null;
 if(p.data.meeting){
  const r=p.data.meeting.version,snapshot={...p.snapshot,capturedAt:Date.now(),peserta:p.snapshot.peserta.map(person=>({...person,id:mapped.get(person.id)}))};
  const statuses=r.statuses.map(s=>({pesertaId:mapped.get(s.pesertaId),status:s.status}));
  const fields={kelasId:kelas._id,nomor:r.nomor,tanggal:r.tanggal,tempat:r.tempat,tipe:r.tipe,status:r.status,cancelled:r.cancelled,snapshot,hasAttendanceHistory:Boolean(p.meeting?.hasAttendanceHistory||p.meeting?.dikunciPada||r.status==="KUNCI"||statuses.length>0),revision:(p.meeting?.revision||0)+1,...(r.status==="KUNCI"?{dikunciPada:Date.now()}:{})};
  if(p.meeting){await appendRevision(ctx,p.meeting);resultMeetingId=p.meeting._id;await ctx.db.patch(resultMeetingId,fields);
   for(const row of await ctx.db.query("presensi").withIndex("by_pertemuan",q=>q.eq("pertemuanId",resultMeetingId)).collect())await ctx.db.delete(row._id);
  }else resultMeetingId=await ctx.db.insert("pertemuan",fields);
  for(const row of statuses)await ctx.db.insert("presensi",{pertemuanId:resultMeetingId,...row});
  revision=fields.revision;await appendRevision(ctx,await ctx.db.get(resultMeetingId),{snapshot,statuses,actorId:user._id,action:"RESTORE_BACKUP",reason:p.reason,parentRevision:p.meeting?.revision??0,operationKey:a.operationKey,operationHash:p.previewHash,requiredCapabilities:p.caps});await syncMeeting(ctx,resultMeetingId);
 }
 await ctx.db.patch(kelas._id,classPatch);await syncClass(ctx,kelas._id);
 await audit(ctx,user,"RESTORE_BACKUP",`${p.reason}; ${p.touched} peserta, sumber ${p.data.source.kelasId}${p.data.meeting?` revisi ${p.data.meeting.version.revision}`:""}`,kelas._id,resultMeetingId||undefined);
 const result={classRevision:classPatch.revision,meetingId:resultMeetingId,revision,requiredCapabilities:p.caps};
 await ctx.db.insert("classOperation",{kelasId:kelas._id,actorId:user._id,operationKey:a.operationKey,requestHash:p.previewHash,result});return result;
}});
