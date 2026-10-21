import assert from "node:assert/strict";
import {fixture} from "./revision-fixture.mjs";
import {appendRevision,readRevision,revisionByNumber,controlEnabled} from "../convex/lib/revisionLedger.js";
import {simpanDanKunciLogic,bukaKunciLogic} from "../convex/lib/sesiLogic.js";
import {klaimLogic,finalisasiLogic} from "../convex/lib/bapLogic.js";
import {syncDocument} from "../convex/lib/readModels.js";
import {backfill,setEnabled,backfillCounts} from "../convex/revisionRollout.js";
import {history,detail} from "../convex/revisions.js";
let groups=0;const test=async(name,fn)=>{await fn();groups++;console.log('OK revision foundation',name)};
await test('complete statuses and frozen identity survive unlock and another revision',async()=>{
 const f=await fixture();await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});
 const r=await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,1));assert.deepEqual(r.statuses,f.statuses);assert.equal(r.snapshot.peserta.length,4);
 await bukaKunciLogic(f.ctx,{...f,expectedRevision:1});await simpanDanKunciLogic(f.ctx,{...f,baseRevision:1,statuses:f.statuses.map(s=>({...s,status:'IZIN'}))});
 const old=await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,1));assert.deepEqual(old,r);assert.equal((await f.ctx.db.query('meetingRevision').collect()).length,3);
});
await test('participant chunks are bounded and history does not read snapshot payloads',async()=>{
 const f=await fixture(1600);for(const id of f.peserta)await f.ctx.db.patch(id,{nama:'Nama Demo '.repeat(12)});
 const r=await appendRevision(f.ctx,await f.ctx.db.get(f.pertemuanId));assert.equal((await readRevision(f.ctx,r)).snapshot.peserta.length,1600);assert.ok((await f.ctx.db.query('revisionRows').collect()).length>1);
 f.ctx.reads.length=0;assert.equal((await history._handler(f.ctx,{token:f.token,pertemuanId:f.pertemuanId})).length,1);assert.equal(f.ctx.reads.some(r=>['revisionRows','revisionPayload'].includes(r.table)),false);
});
await test('archive metadata stays frozen even if meeting fields change later',async()=>{
 const f=await fixture();await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});const claim=await klaimLogic(f.ctx,{pertemuanId:f.pertemuanId,revision:1,format:'docx'});
 await finalisasiLogic(f.ctx,{id:claim.id,attempt:claim.attempt,storageId:'synthetic-storage',sha256:'synthetic-hash'});
 await f.ctx.db.patch(f.pertemuanId,{tanggal:'2026-11-01',nomor:8});await syncDocument(f.ctx,claim.id);
 const [view]=await f.ctx.db.query('documentView').collect();assert.equal(view.data.tanggal,'2026-10-21');assert.equal(view.data.nomor,3);assert.equal(view.data.sha256,'synthetic-hash');
});
await test('legacy backfill is resumable/idempotent, preserves files and marks incomplete history',async()=>{
 const f=await fixture();await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});
 const current=await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,1));await f.ctx.db.patch(f.pertemuanId,{revision:2});
 // Simulate an earlier deployment: remove the newly introduced ledger only.
 for(const table of['meetingRevision','revisionRows','revisionPayload'])for(const row of await f.ctx.db.query(table).collect())await f.ctx.db.delete(row._id);
 const doc=await f.ctx.db.insert('bapDoc',{pertemuanId:f.pertemuanId,revision:1,format:'docx',templateVersion:'legacy',snapshot:current.snapshot,status:'READY',storageId:'original-storage',sha256:'original-hash',klaimPada:1,percobaan:1});
 await assert.rejects(()=>setEnabled._handler(f.ctx,{enabled:true}),/MIGRASI_BELUM_SELESAI/);
 for(const phase of['pertemuan','bapDoc','kelas']){let cursor;do{const page=await backfill._handler(f.ctx,{phase,...(cursor?{cursor}:{})});cursor=page.continueCursor;}while(cursor);}
 const old=await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,1));assert.equal(old.legacyPartial,true);assert.equal(old.metadataVerified,false);assert.deepEqual(old.statuses,[]);
 const before=await f.ctx.db.get(doc);assert.equal(before.sha256,'original-hash');assert.equal(before.storageId,'original-storage');assert.equal(before.archiveMetadata.nomor,null);
 assert.equal(await controlEnabled(f.ctx),false);let countCursor;do{const p=await backfillCounts._handler(f.ctx,{...(countCursor?{cursor:countCursor}:{})});countCursor=p.continueCursor;}while(countCursor);await setEnabled._handler(f.ctx,{enabled:true});assert.equal(await controlEnabled(f.ctx),true);assert.equal((await backfill._handler(f.ctx,{phase:'kelas'})).skipped,true);
});
await test('history and revision payload are protected by class access',async()=>{
 const f=await fixture();await appendRevision(f.ctx,await f.ctx.db.get(f.pertemuanId));await f.ctx.db.patch(f.user,{peran:'OPERATOR',kelasIds:[]});
 await assert.rejects(()=>detail._handler(f.ctx,{token:f.token,pertemuanId:f.pertemuanId,revision:0}),/AKSES_DITOLAK/);
});
console.log(`${groups} revision foundation groups passed.`);
