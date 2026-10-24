import assert from "node:assert/strict";
import {fixture,transaction} from "./revision-fixture.mjs";
import {CONTROL_FLAG,appendRevision} from "../convex/lib/revisionLedger.js";
import {addMeeting,addMeetings,deleteEmptyMeeting} from "../convex/meetingCommands.js";
import {saveSchedule} from "../convex/kelola.js";
import {historyPage} from "../convex/revisions.js";
let n=0;const check=async(name,fn)=>{await fn();n++;console.log('OK meeting command',name)};
async function setup(){const f=await fixture();f.flag=await f.ctx.db.insert('featureFlag',{key:CONTROL_FLAG,enabled:true,everEnabled:true});return f;}
await check('creation and empty deletion are idempotent, including retries after the row is gone',async()=>{
 const f=await setup(),a={token:f.token,kelasId:f.kelasId,expectedClassRevision:1,operationKey:crypto.randomUUID(),data:{nomor:4,tanggal:'2026-10-28',tempat:'Ruang QA',tipe:'REGULER'}},created=await addMeeting._handler(f.ctx,a);assert.deepEqual(await addMeeting._handler(f.ctx,a),created);
 const d={token:f.token,kelasId:f.kelasId,expectedClassRevision:2,pertemuanId:created.id,expectedMeetingRevision:0,operationKey:crypto.randomUUID()},removed=await deleteEmptyMeeting._handler(f.ctx,d);assert.deepEqual(await deleteEmptyMeeting._handler(f.ctx,d),removed);assert.equal(await f.ctx.db.get(created.id),null);
});
await check('historical sessions cannot use empty deletion; rollback keeps data intact',async()=>{
 const f=await setup();await f.ctx.db.patch(f.pertemuanId,{revision:1});await assert.rejects(()=>transaction(f.ctx,()=>deleteEmptyMeeting._handler(f.ctx,{token:f.token,kelasId:f.kelasId,expectedClassRevision:1,pertemuanId:f.pertemuanId,expectedMeetingRevision:1,operationKey:crypto.randomUUID()})),/GUNAKAN_PEMBATALAN_SESI/);assert.ok(await f.ctx.db.get(f.pertemuanId));
});
await check('legacy replace-schedule remains blocked after the editor flag is disabled',async()=>{
 const f=await setup();await f.ctx.db.patch(f.flag,{enabled:false});await assert.rejects(()=>saveSchedule._handler(f.ctx,{token:f.token,kelasId:f.kelasId,baseRevision:1,rows:[]}),/GUNAKAN_EDITOR_JADWAL/);
});
await check('history pagination reaches versions older than fifty without reading payloads',async()=>{
 const f=await setup(),p=await f.ctx.db.get(f.pertemuanId);for(let i=0;i<75;i++)await appendRevision(f.ctx,{...p,revision:i});f.ctx.reads.length=0;
 let cursor=null,count=0;do{const result=await historyPage._handler(f.ctx,{token:f.token,pertemuanId:f.pertemuanId,paginationOpts:{cursor,numItems:20}});count+=result.page.length;cursor=result.isDone?null:result.continueCursor;}while(cursor);
 assert.equal(count,75);assert.equal(f.ctx.reads.some(r=>r.table==='revisionPayload'||r.table==='revisionRows'),false);
});

await check('batch creation is atomic, scoped, bounded, and retry-safe after a lost response',async()=>{
 const f=await setup(),items=[4,5,6].map(n=>({nomor:n,tanggal:'2026-12-28',tempat:'QA',tipe:'REGULER'})),a={token:f.token,kelasId:f.kelasId,expectedClassRevision:1,operationKey:crypto.randomUUID(),items};
 const result=await transaction(f.ctx,()=>addMeetings._handler(f.ctx,a));assert.equal(result.created.length,3);assert.equal(result.classRevision,2);assert.deepEqual(await addMeetings._handler(f.ctx,a),result);assert.equal((await f.ctx.db.query('pertemuan').collect()).length,4);
 await assert.rejects(()=>addMeetings._handler(f.ctx,{...a,items:[...items,{...items[0],nomor:7}]}),/KUNCI_OPERASI_DIPAKAI/);
 const before=JSON.stringify([...f.ctx.tabel].map(([t,m])=>[t,[...m]]));
 await assert.rejects(()=>transaction(f.ctx,()=>addMeetings._handler(f.ctx,{...a,expectedClassRevision:2,operationKey:crypto.randomUUID(),items:[{...items[0],nomor:7},{...items[1],nomor:4}]})),/NOMOR_PERTEMUAN_DUPLIKAT/);
 assert.equal(JSON.stringify([...f.ctx.tabel].map(([t,m])=>[t,[...m]])),before);
 await assert.rejects(()=>addMeetings._handler(f.ctx,{...a,expectedClassRevision:2,operationKey:crypto.randomUUID(),items:Array.from({length:97},(_,i)=>({...items[0],nomor:i+7}))}),/BATAS_SESI_AKTIF/);
 await assert.rejects(()=>addMeetings._handler(f.ctx,{...a,operationKey:crypto.randomUUID(),items:[{...items[0],nomor:7}]}),/KONFLIK_REVISI/);
 await f.ctx.db.patch(f.user,{peran:'OPERATOR',kelasIds:[f.kelasId]});await assert.rejects(()=>addMeetings._handler(f.ctx,{...a,expectedClassRevision:2,operationKey:crypto.randomUUID(),items:[{...items[0],nomor:7}]}),/IZIN_KELAS_KURANG/);
});

console.log(`${n} meeting command groups passed.`);
