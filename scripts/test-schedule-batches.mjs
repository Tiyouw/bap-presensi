import assert from "node:assert/strict";
import {fixture,transaction} from "./revision-fixture.mjs";
import {CONTROL_FLAG} from "../convex/lib/revisionLedger.js";
import * as batches from "../convex/scheduleBatches.js";
import {simpanDanKunciLogic} from "../convex/lib/sesiLogic.js";
import {previewCorrection,commitCorrection} from "../convex/revisions.js";
let groups=0;const check=async(n,fn)=>{await fn();groups++;console.log('OK schedule batch',n)};
async function setup(){const f=await fixture(),ids=[];await f.ctx.db.insert('featureFlag',{key:CONTROL_FLAG,enabled:true});
 for(let n=4;n<=9;n++)ids.push(await f.ctx.db.insert('pertemuan',{kelasId:f.kelasId,nomor:n,tanggal:new Date(Date.UTC(2026,9,21+(n-3)*7)).toISOString().slice(0,10),tempat:'Ruang Demo',tipe:'REGULER',status:'TERBUKA',revision:0}));return{...f,ids};}
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
async function args(f,ids=f.ids,days=7){return{token:f.token,kelasId:f.kelasId,expectedClassRevision:(await f.ctx.db.get(f.kelasId)).revision,items:await Promise.all(ids.map(async id=>{const p=await f.ctx.db.get(id);return{pertemuanId:id,expectedRevision:p.revision,patch:{tanggal:shift(p.tanggal,days)}}})),includeHistorical:false,reason:'Geser praktikum sesuai pelaksanaan'};}
async function start(f,a,key=crypto.randomUUID()){const preview=await batches.previewScheduleBatch._handler(f.ctx,a);const request={...a,previewHash:preview.previewHash,operationKey:key};return{result:await transaction(f.ctx,()=>batches.commitScheduleBatch._handler(f.ctx,request)),request,preview};}
async function finish(f,id){let result;do{result=await transaction(f.ctx,()=>batches.advanceScheduleJob._handler(f.ctx,{token:f.token,jobId:id}));}while(result.status==='PENDING'||result.status==='RUNNING');return result;}
await check('small batch is atomic and changes only selected dates; start retry reuses job',async()=>{
 const f=await setup(),before=await f.ctx.db.get(f.ids[2]),a=await args(f,f.ids.slice(0,2)),{result,request}=await start(f,a);assert.equal(result.mode,'atomic');assert.equal(result.status,'DONE');assert.equal((await f.ctx.db.get(f.ids[0])).revision,1);assert.deepEqual(await f.ctx.db.get(f.ids[2]),before);
 assert.equal((await batches.commitScheduleBatch._handler(f.ctx,request)).jobId,result.jobId);assert.equal((await f.ctx.db.query('scheduleJob').collect()).length,1);
});
await check('large job resumes after abandoning a response without duplicate item revisions',async()=>{
 const f=await setup(),{result}=await start(f,await args(f));assert.equal(result.mode,'job');assert.equal(result.applied,0);await batches.advanceScheduleJob._handler(f.ctx,{token:f.token,jobId:result.jobId});const end=await finish(f,result.jobId);assert.equal(end.status,'DONE');assert.equal(end.applied,6);
 for(const id of f.ids)assert.equal((await f.ctx.db.get(id)).revision,1);
});
await check('external edits stop remaining work; explicit preview/resume preserves unrelated room changes',async()=>{
 const f=await setup(),{result}=await start(f,await args(f));await batches.advanceScheduleJob._handler(f.ctx,{token:f.token,jobId:result.jobId});
 const p=await f.ctx.db.get(f.ids[2]),c=await f.ctx.db.get(f.kelasId),a={token:f.token,pertemuanId:p._id,expectedMeetingRevision:p.revision,expectedClassRevision:c.revision,patch:{tempat:'Ruang Pengguna Lain'},reason:'Perubahan pengguna lain'},preview=await previewCorrection._handler(f.ctx,a);await commitCorrection._handler(f.ctx,{...a,previewHash:preview.previewHash,operationKey:crypto.randomUUID()});
 assert.equal((await batches.advanceScheduleJob._handler(f.ctx,{token:f.token,jobId:result.jobId})).status,'NEEDS_REVIEW');const resume=await batches.previewResumeJob._handler(f.ctx,{token:f.token,jobId:result.jobId});await batches.resumeScheduleJob._handler(f.ctx,{token:f.token,jobId:result.jobId,previewHash:resume.previewHash});assert.equal((await finish(f,result.jobId)).status,'DONE');assert.equal((await f.ctx.db.get(f.ids[2])).tempat,'Ruang Pengguna Lain');
});
await check('cancel job preserves applied rows; undo creates compensating revisions and marks originals',async()=>{
 const f=await setup(),a=await args(f),original=a.items[0].patch.tanggal,{result}=await start(f,a);await batches.advanceScheduleJob._handler(f.ctx,{token:f.token,jobId:result.jobId});await batches.cancelScheduleJob._handler(f.ctx,{token:f.token,jobId:result.jobId,reason:'Hentikan bagian yang belum diterapkan'});
 const request={token:f.token,jobId:result.jobId,reason:'Pulihkan hasil geser'},undo=await batches.previewUndoJob._handler(f.ctx,request);assert.equal(undo.eligibleIds.length,1);const commit={...request,selectedIds:undo.eligibleIds,previewHash:undo.previewHash,operationKey:crypto.randomUUID()},child=await batches.commitUndoJob._handler(f.ctx,commit);assert.equal(child.status,'DONE');assert.equal((await batches.commitUndoJob._handler(f.ctx,commit)).jobId,child.jobId);assert.equal((await f.ctx.db.get(f.ids[0])).tanggal,shift(original,-7));assert.equal((await f.ctx.db.get(f.ids[0])).revision,2);assert.equal((await batches.jobDetail._handler(f.ctx,{token:f.token,jobId:result.jobId})).items[0].undoRevision,2);
});
await check('undo excludes sessions edited after the job and reports conflicts explicitly',async()=>{
 const f=await setup(),{result}=await start(f,await args(f,f.ids.slice(0,2)));await f.ctx.db.patch(f.ids[0],{revision:2});const undo=await batches.previewUndoJob._handler(f.ctx,{token:f.token,jobId:result.jobId,reason:'Batalkan perubahan terpilih'});assert.deepEqual(undo.conflicts,[f.ids[0]]);assert.deepEqual(undo.eligibleIds,[f.ids[1]]);
});
await check('historical sessions require explicit inclusion and preserve attendance record IDs',async()=>{
 const f=await setup();await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});const before=await f.ctx.db.query('presensi').collect(),a=await args(f,[f.pertemuanId]);await assert.rejects(()=>start(f,a),/BATCH_RIWAYAT_BELUM_DIPILIH/);await start(f,{...a,includeHistorical:true});assert.deepEqual(await f.ctx.db.query('presensi').collect(),before);
});
await check('date shifts handle leap day/year boundaries and reject stale/mutated previews',async()=>{
 const f=await setup();await f.ctx.db.patch(f.ids[0],{tanggal:'2028-02-28'});await start(f,await args(f,[f.ids[0]],1));assert.equal((await f.ctx.db.get(f.ids[0])).tanggal,'2028-02-29');await f.ctx.db.patch(f.ids[1],{tanggal:'2026-12-31'});await start(f,await args(f,[f.ids[1]],1));assert.equal((await f.ctx.db.get(f.ids[1])).tanggal,'2027-01-01');
 const a=await args(f,[f.ids[2]]),preview=await batches.previewScheduleBatch._handler(f.ctx,a);await f.ctx.db.patch(f.kelasId,{revision:a.expectedClassRevision+1});await assert.rejects(()=>batches.commitScheduleBatch._handler(f.ctx,{...a,previewHash:preview.previewHash,operationKey:crypto.randomUUID()}),/KONFLIK_REVISI/);
});
await check('cancelled pending sessions can be skipped only after explicit review',async()=>{
 const f=await setup(),{result}=await start(f,await args(f));await batches.advanceScheduleJob._handler(f.ctx,{token:f.token,jobId:result.jobId});
 await f.ctx.db.patch(f.ids[1],{cancelled:true});await f.ctx.db.patch(f.kelasId,{revision:(await f.ctx.db.get(f.kelasId)).revision+1});await batches.advanceScheduleJob._handler(f.ctx,{token:f.token,jobId:result.jobId});
 const a={token:f.token,jobId:result.jobId},preview=await batches.previewResumeJob._handler(f.ctx,a);assert.ok(preview.remaining.some(i=>i.unavailable));await assert.rejects(()=>batches.resumeScheduleJob._handler(f.ctx,{...a,previewHash:preview.previewHash}),/BATCH_PILIH_LEWATI/);
 const reviewed=await batches.previewResumeJob._handler(f.ctx,{...a,skipIds:[f.ids[1]]});await batches.resumeScheduleJob._handler(f.ctx,{...a,skipIds:[f.ids[1]],previewHash:reviewed.previewHash});const end=await finish(f,result.jobId);assert.equal(end.status,'DONE');assert.equal(end.applied,5);assert.equal((await f.ctx.db.get(result.jobId)).skipped,1);assert.equal((await f.ctx.db.get(f.ids[1])).cancelled,true);
});
console.log(`${groups} schedule batch groups passed.`);
