import assert from "node:assert/strict";
import {fixture,transaction} from "./revision-fixture.mjs";
import {CONTROL_FLAG,appendRevision} from "../convex/lib/revisionLedger.js";
import {addMeeting,deleteEmptyMeeting} from "../convex/meetingCommands.js";
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
console.log(`${n} meeting command groups passed.`);
