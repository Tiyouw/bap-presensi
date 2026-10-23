import {v,ConvexError} from "convex/values";
import {paginationOptsValidator} from "convex/server";
import {query,mutation} from "./_generated/server.js";
import {requireCapability,requireClass,audit} from "./lib/access.js";
import {classRows} from "./lib/classLogic.js";
import {controlEnabled,revisionByNumber} from "./lib/revisionLedger.js";
import {prepareCorrection,applyCorrection} from "./lib/correctionLogic.js";
import {hashToken} from "./lib/auth.js";
import {validDate,text} from "../bap-shared/management.js";
import {meetingHadAttendance} from "../bap-shared/control.js";
const fields=["nomor","tanggal","tempat"],meta=p=>Object.fromEntries(fields.map(k=>[k,p[k]]));
const itemValidator=v.object({pertemuanId:v.id("pertemuan"),expectedRevision:v.number(),patch:v.any()});
const batchArgs={token:v.string(),kelasId:v.id("kelas"),expectedClassRevision:v.number(),items:v.array(itemValidator),includeHistorical:v.boolean(),reason:v.string()};
async function access(ctx,a,caps=["schedule"]){const result=await requireCapability(ctx,a.token,a.kelasId,caps);
 if(!result.kelas.revisionReady||!await controlEnabled(ctx))throw new ConvexError("KOREKSI_BELUM_AKTIF");return result;}
async function prepareBatch(ctx,a){
 const result=await access(ctx,a),{kelas,user}=result;
 if(kelas.revision!==a.expectedClassRevision)throw new ConvexError("KONFLIK_REVISI");
 if(!a.items.length||a.items.length>100||new Set(a.items.map(i=>i.pertemuanId)).size!==a.items.length)throw new ConvexError("BATCH_TIDAK_VALID");
 const reason=text(a.reason,"Catatan perubahan massal",240),meetings=await classRows(ctx,"pertemuan",kelas._id),normalized=[];
 let historical=false,rowCount=0,unknownCount=false;
 for(const item of a.items){const p=meetings.find(p=>p._id===item.pertemuanId);
  if(!p||p.cancelled)throw new ConvexError("PERTEMUAN_DIBATALKAN");
  if(p.revision!==item.expectedRevision)throw new ConvexError("KONFLIK_REVISI");
  if(!item.patch||typeof item.patch!=="object"||Array.isArray(item.patch)||Object.keys(item.patch).some(k=>!["tanggal","tempat"].includes(k)))throw new ConvexError("BATCH_TIDAK_VALID");
  const after={...meta(p),...item.patch};validDate(after.tanggal);after.tempat=text(after.tempat,"Ruang",80);
  if(!Number.isInteger(after.nomor)||after.nomor<1||after.nomor>1000)throw new ConvexError("JADWAL_TIDAK_VALID");
  const patch=Object.fromEntries(fields.filter(k=>p[k]!==after[k]).map(k=>[k,after[k]]));
  if(!Object.keys(patch).length)continue;
  const old=meetingHadAttendance(p);
  if(old&&!a.includeHistorical)throw new ConvexError("BATCH_RIWAYAT_BELUM_DIPILIH");historical=historical||old;
  const header=await revisionByNumber(ctx,p._id,p.revision);if(header)rowCount+=header.rowCount;else unknownCount=true;
  normalized.push({pertemuanId:p._id,expectedRevision:p.revision,before:meta(p),patch,after,historical:Boolean(old)});
 }
 if(!normalized.length)throw new ConvexError("KOREKSI_TANPA_PERUBAHAN");
 const caps=historical?["schedule","history"]:["schedule"];await requireCapability(ctx,a.token,kelas._id,caps);
 const overrides=new Map(normalized.map(i=>[i.pertemuanId,i.after])),final=meetings.filter(p=>!p.cancelled).map(p=>({...p,...overrides.get(p._id)}));
 if(new Set(final.map(p=>p.nomor)).size!==final.length)throw new ConvexError("NOMOR_PERTEMUAN_DUPLIKAT");
 const warnings=[];if(new Set(final.map(p=>p.tanggal)).size!==final.length)warnings.push("Ada pertemuan dengan tanggal sama. Periksa benturannya.");
 const ordered=[...final].sort((a,b)=>a.nomor-b.nomor);if(ordered.some((p,i)=>i&&p.tanggal<ordered[i-1].tanggal))warnings.push("Urutan tanggal berbeda dengan nomor minggu.");
 if(unknownCount)rowCount+=(await ctx.db.query("peserta").withIndex("by_kelas",q=>q.eq("kelasId",kelas._id)).take(501)).length*normalized.length;
 const mode=normalized.length<=3&&rowCount<=500?"atomic":"job";
 const previewHash=await hashToken(JSON.stringify({actor:user._id,kelas:kelas._id,classRevision:kelas.revision,reason,items:normalized,includeHistorical:a.includeHistorical}));
 return{...result,items:normalized,reason,previewHash,requiredCapabilities:caps,mode,warnings};
}
const publicPreview=p=>({items:p.items,previewHash:p.previewHash,mode:p.mode,warnings:p.warnings,count:p.items.length});
export const previewScheduleBatch=query({args:batchArgs,handler:async(ctx,a)=>publicPreview(await prepareBatch(ctx,a))});
async function createJob(ctx,a,undoLinks){
 const actor=await access(ctx,a);
 if(a.operationKey.length<16||a.operationKey.length>80)throw new ConvexError("BATCH_TIDAK_VALID");
 const old=await ctx.db.query("scheduleJob").withIndex("by_class_operation",q=>q.eq("kelasId",a.kelasId).eq("operationKey",a.operationKey)).unique();
 if(old){if(old.actorId!==actor.user._id||old.requestHash!==a.previewHash)throw new ConvexError("KUNCI_OPERASI_DIPAKAI");await access(ctx,a,old.requiredCapabilities);return{jobId:old._id,mode:old.mode,status:old.status,applied:old.applied,replayed:true};}
 const p=await prepareBatch(ctx,a);if(p.previewHash!==a.previewHash)throw new ConvexError("PREVIEW_KOREKSI_BERUBAH");
 const peerOverrides=Object.fromEntries(p.items.map(i=>[i.pertemuanId,i.after]));
 const prepared=[];
 if(p.mode==="atomic")for(const item of p.items)prepared.push(await prepareCorrection(ctx,{token:a.token,pertemuanId:item.pertemuanId,expectedMeetingRevision:item.expectedRevision,expectedClassRevision:a.expectedClassRevision,patch:item.patch,reason:p.reason,peerOverrides}));
 const jobId=await ctx.db.insert("scheduleJob",{kelasId:a.kelasId,actorId:p.user._id,operationKey:a.operationKey,requestHash:a.previewHash,expectedClassRevision:a.expectedClassRevision,reason:p.reason,status:p.mode==="atomic"?"DONE":"PENDING",mode:p.mode,createdAt:Date.now(),count:p.items.length,applied:0,skipped:0,requiredCapabilities:p.requiredCapabilities,...(undoLinks?{sourceJobId:undoLinks.sourceJobId}:{})});
 let index=0;
 for(const item of p.items){const itemId=await ctx.db.insert("scheduleJobItem",{jobId,position:index,pertemuanId:item.pertemuanId,expectedRevision:item.expectedRevision,before:item.before,patch:item.patch,status:"PENDING",...(undoLinks?.byMeeting[item.pertemuanId]?{undoItemId:undoLinks.byMeeting[item.pertemuanId]}:{})});
  if(p.mode==="atomic"){const draft=prepared[index];draft.kelas=await ctx.db.get(a.kelasId);const saved=await applyCorrection(ctx,draft,{operationKey:`${a.operationKey}:${index}`});await finishItem(ctx,await ctx.db.get(itemId),saved.revision);}
  index++;
 }
 if(p.mode==="atomic")await ctx.db.patch(jobId,{applied:p.items.length,expectedClassRevision:(await ctx.db.get(a.kelasId)).revision});
 await audit(ctx,p.user,"JADWAL_BATCH",`${p.items.length} sesi; ${p.mode}; ${p.reason}`,a.kelasId);
 return{jobId,mode:p.mode,status:p.mode==="atomic"?"DONE":"PENDING",applied:p.mode==="atomic"?p.items.length:0,replayed:false};
}
async function finishItem(ctx,item,revision){await ctx.db.patch(item._id,{status:"APPLIED",resultRevision:revision});if(item.undoItemId)await ctx.db.patch(item.undoItemId,{undoRevision:revision});}
export const commitScheduleBatch=mutation({args:{...batchArgs,previewHash:v.string(),operationKey:v.string()},handler:createJob});
async function jobAccess(ctx,token,jobId){const job=await ctx.db.get(jobId);if(!job)throw new ConvexError("BATCH_TIDAK_ADA");
 const result=await access(ctx,{token,kelasId:job.kelasId},job.requiredCapabilities);if(job.actorId!==result.user._id&&result.user.peran!=="ADMIN")throw new ConvexError("AKSES_DITOLAK");return{...result,job};}
export const advanceScheduleJob=mutation({args:{token:v.string(),jobId:v.id("scheduleJob")},handler:async(ctx,a)=>{
 const p=await jobAccess(ctx,a.token,a.jobId),{job,kelas}=p;
 if(job.status==="DONE"||job.status==="CANCELLED")return{status:job.status,applied:job.applied,count:job.count};
 if(job.status==="NEEDS_REVIEW")throw new ConvexError("BATCH_PERIKSA_ULANG");
 const item=(await ctx.db.query("scheduleJobItem").withIndex("by_job_status",q=>q.eq("jobId",job._id).eq("status","PENDING")).take(1))[0];
 if(!item){await ctx.db.patch(job._id,{status:"DONE"});return{status:"DONE",applied:job.applied,count:job.count};}
 let correction;
 try{
  if(kelas.revision!==job.expectedClassRevision)throw new ConvexError("KONFLIK_REVISI");
  correction=await prepareCorrection(ctx,{token:a.token,pertemuanId:item.pertemuanId,expectedMeetingRevision:item.expectedRevision,expectedClassRevision:job.expectedClassRevision,patch:item.patch,reason:job.reason});
 }catch(error){
  // Only readonly validation is caught. Any exception after writes propagates
  // so Convex rolls back the whole item transaction instead of committing half.
  await ctx.db.patch(item._id,{status:"CONFLICT",error:String(error.data||error.message)});await ctx.db.patch(job._id,{status:"NEEDS_REVIEW"});return{status:"NEEDS_REVIEW",applied:job.applied,count:job.count};
 }
 const saved=await applyCorrection(ctx,correction,{operationKey:`${job.operationKey}:${item.position}`});await finishItem(ctx,item,saved.revision);
 const applied=job.applied+1,status=applied+job.skipped===job.count?"DONE":"RUNNING";
 await ctx.db.patch(job._id,{applied,status,expectedClassRevision:(await ctx.db.get(kelas._id)).revision});
 return{status,applied,count:job.count};
}});
async function resumePreview(ctx,a){const p=await jobAccess(ctx,a.token,a.jobId),items=await ctx.db.query("scheduleJobItem").withIndex("by_job_position",q=>q.eq("jobId",a.jobId)).take(100),remaining=[];
 if(p.job.status!=="NEEDS_REVIEW")throw new ConvexError("BATCH_TIDAK_VALID");
 const meetings=await classRows(ctx,"pertemuan",p.kelas._id);
 for(const item of items.filter(i=>i.status==="PENDING"||i.status==="CONFLICT")){const m=meetings.find(m=>m._id===item.pertemuanId),unavailable=!m||Boolean(m.cancelled);
  remaining.push({id:item._id,pertemuanId:item.pertemuanId,expectedRevision:m?.revision??item.expectedRevision,before:m?meta(m):item.before,patch:item.patch,unavailable,skip:Boolean(a.skipIds?.includes(item.pertemuanId))||!unavailable&&fields.every(k=>item.patch[k]===undefined||item.patch[k]===m[k])});}
 if(a.skipIds&&(new Set(a.skipIds).size!==a.skipIds.length||a.skipIds.some(id=>!remaining.some(r=>r.pertemuanId===id))))throw new ConvexError("BATCH_TIDAK_VALID");
 const previewHash=await hashToken(JSON.stringify({job:p.job._id,actor:p.user._id,classRevision:p.kelas.revision,remaining}));return{...p,remaining,previewHash};}
export const previewResumeJob=query({args:{token:v.string(),jobId:v.id("scheduleJob"),skipIds:v.optional(v.array(v.id("pertemuan")))},handler:async(ctx,a)=>{const p=await resumePreview(ctx,a);return{remaining:p.remaining,previewHash:p.previewHash,applied:p.job.applied};}});
export const resumeScheduleJob=mutation({args:{token:v.string(),jobId:v.id("scheduleJob"),previewHash:v.string(),skipIds:v.optional(v.array(v.id("pertemuan")))},handler:async(ctx,a)=>{
 const p=await resumePreview(ctx,a);if(p.previewHash!==a.previewHash)throw new ConvexError("PREVIEW_KOREKSI_BERUBAH");if(p.remaining.some(i=>i.unavailable&&!i.skip))throw new ConvexError("BATCH_PILIH_LEWATI");let skipped=p.job.skipped;
 for(const item of p.remaining){if(item.skip)skipped++;await ctx.db.patch(item.id,{expectedRevision:item.expectedRevision,before:item.before,status:item.skip?"SKIPPED":"PENDING",error:undefined});}
 const status=p.job.applied+skipped===p.job.count?"DONE":"RUNNING";await ctx.db.patch(p.job._id,{expectedClassRevision:p.kelas.revision,status,skipped});return{status};
}});
export const cancelScheduleJob=mutation({args:{token:v.string(),jobId:v.id("scheduleJob"),reason:v.string()},handler:async(ctx,a)=>{
 const p=await jobAccess(ctx,a.token,a.jobId),reason=text(a.reason,"Catatan penghentian",240);
 if(p.job.status==="DONE")throw new ConvexError("BATCH_SUDAH_SELESAI");
 for(const item of await ctx.db.query("scheduleJobItem").withIndex("by_job_position",q=>q.eq("jobId",a.jobId)).take(100))if(item.status==="PENDING"||item.status==="CONFLICT")await ctx.db.patch(item._id,{status:"CANCELLED"});
 await ctx.db.patch(a.jobId,{status:"CANCELLED",cancelReason:reason});return{status:"CANCELLED",applied:p.job.applied};
}});
export const jobsPage=query({args:{token:v.string(),kelasId:v.id("kelas"),paginationOpts:paginationOptsValidator},handler:async(ctx,a)=>{await requireClass(ctx,a.token,a.kelasId);return ctx.db.query("scheduleJob").withIndex("by_class_created",q=>q.eq("kelasId",a.kelasId)).order("desc").paginate({...a.paginationOpts,numItems:Math.min(20,Math.max(1,a.paginationOpts.numItems)),maximumBytesRead:256000});}});
export const jobDetail=query({args:{token:v.string(),jobId:v.id("scheduleJob")},handler:async(ctx,a)=>{const job=await ctx.db.get(a.jobId);if(!job)throw new ConvexError("BATCH_TIDAK_ADA");await requireClass(ctx,a.token,job.kelasId);return{job,items:await ctx.db.query("scheduleJobItem").withIndex("by_job_position",q=>q.eq("jobId",job._id)).take(100)};}});
async function undoPreview(ctx,a){const p=await jobAccess(ctx,a.token,a.jobId),items=await ctx.db.query("scheduleJobItem").withIndex("by_job_position",q=>q.eq("jobId",a.jobId)).take(100),meetings=await classRows(ctx,"pertemuan",p.kelas._id),eligible=[],conflicts=[];
 for(const item of items.filter(i=>i.status==="APPLIED"&&!i.undoRevision)){const current=meetings.find(m=>m._id===item.pertemuanId);if(!current||current.cancelled||current.revision!==item.resultRevision){conflicts.push(item.pertemuanId);continue;}
  eligible.push({pertemuanId:item.pertemuanId,expectedRevision:current.revision,patch:Object.fromEntries(Object.keys(item.patch).map(k=>[k,item.before[k]])),undoItemId:item._id});}
 const selected=a.selectedIds?eligible.filter(i=>a.selectedIds.includes(i.pertemuanId)):eligible;
 if(a.selectedIds&&selected.length!==a.selectedIds.length)throw new ConvexError("KONFLIK_REVISI");
 if(!selected.length)throw new ConvexError("BATCH_TIDAK_ADA_YANG_DIPULIHKAN");
 const args={token:a.token,kelasId:p.kelas._id,expectedClassRevision:p.kelas.revision,reason:a.reason,includeHistorical:true,items:selected.map(({undoItemId,...i})=>i)},preview=await prepareBatch(ctx,args);
 return{...p,args,preview,eligible:selected,conflicts};}
export const previewUndoJob=query({args:{token:v.string(),jobId:v.id("scheduleJob"),reason:v.string(),selectedIds:v.optional(v.array(v.id("pertemuan")))},handler:async(ctx,a)=>{const p=await undoPreview(ctx,a);return{...publicPreview(p.preview),eligibleIds:p.eligible.map(i=>i.pertemuanId),conflicts:p.conflicts};}});
export const commitUndoJob=mutation({args:{token:v.string(),jobId:v.id("scheduleJob"),reason:v.string(),selectedIds:v.array(v.id("pertemuan")),previewHash:v.string(),operationKey:v.string()},handler:async(ctx,a)=>{
 const source=await jobAccess(ctx,a.token,a.jobId),old=await ctx.db.query("scheduleJob").withIndex("by_class_operation",q=>q.eq("kelasId",source.kelas._id).eq("operationKey",a.operationKey)).unique();
 if(old){if(old.actorId!==source.user._id||old.requestHash!==a.previewHash||old.sourceJobId!==a.jobId)throw new ConvexError("KUNCI_OPERASI_DIPAKAI");await access(ctx,{token:a.token,kelasId:old.kelasId},old.requiredCapabilities);return{jobId:old._id,mode:old.mode,status:old.status,applied:old.applied,replayed:true};}
 const p=await undoPreview(ctx,a);return createJob(ctx,{...p.args,previewHash:a.previewHash,operationKey:a.operationKey},{sourceJobId:a.jobId,byMeeting:Object.fromEntries(p.eligible.map(i=>[i.pertemuanId,i.undoItemId]))});
}});

export const findOperation=query({args:{token:v.string(),kelasId:v.id("kelas"),operationKey:v.string()},handler:async(ctx,a)=>{
 const {user}=await requireCapability(ctx,a.token,a.kelasId,[],false);
 const job=await ctx.db.query("scheduleJob").withIndex("by_class_operation",q=>q.eq("kelasId",a.kelasId).eq("operationKey",a.operationKey)).unique();
 if(job&&job.actorId!==user._id)throw new ConvexError("AKSES_DITOLAK");return job;
}});
