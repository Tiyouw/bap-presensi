const state=ctx=>JSON.stringify([...ctx.tabel].map(([name,rows])=>[name,[...rows]]).filter(([,rows])=>rows.length).sort(([a],[b])=>a.localeCompare(b)));
import assert from "node:assert/strict";
import {fixture,transaction} from "./revision-fixture.mjs";
import {simpanDanKunciLogic} from "../convex/lib/sesiLogic.js";
import {CONTROL_FLAG,readRevision,revisionByNumber} from "../convex/lib/revisionLedger.js";
import {previewCorrection,commitCorrection} from "../convex/revisions.js";
import {refreshSnapshot} from "../convex/kelola.js";
let groups=0;const check=async(name,fn)=>{await fn();groups++;console.log('OK correction',name)};
async function ready(lock=true){const f=await fixture();await f.ctx.db.insert('featureFlag',{key:CONTROL_FLAG,enabled:true});if(lock)await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});return f;}
async function request(f,extra={}){const p=await f.ctx.db.get(f.pertemuanId),c=await f.ctx.db.get(f.kelasId);return{token:f.token,pertemuanId:f.pertemuanId,expectedMeetingRevision:p.revision,expectedClassRevision:c.revision,patch:{tanggal:'2026-10-23'},reason:'Koreksi tanggal aktual',...extra};}
async function save(f,args,key='synthetic-operation-001'){const preview=await previewCorrection._handler(f.ctx,args);return transaction(f.ctx,()=>commitCorrection._handler(f.ctx,{...args,previewHash:preview.previewHash,operationKey:key}));}
await check('date-only correction preserves roster/template/identity/statuses and stays locked',async()=>{
 const f=await ready(),before=await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,1));const args=await request(f);const preview=await previewCorrection._handler(f.ctx,args);assert.equal(preview.fields.length,1);assert.deepEqual(preview.refresh,[]);assert.equal(preview.statusChanged,false);
 await save(f,args);const after=await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,2));assert.equal(after.tanggal,'2026-10-23');assert.equal(after.status,'KUNCI');assert.deepEqual(after.statuses,before.statuses);assert.deepEqual(after.snapshot.kelas,before.snapshot.kelas);assert.deepEqual(after.snapshot.template,before.snapshot.template);assert.deepEqual(after.snapshot.peserta,before.snapshot.peserta);
});
await check('preview is read-only and retries are idempotent',async()=>{
 const f=await ready(),args=await request(f),before=state(f.ctx);const p=await previewCorrection._handler(f.ctx,args);assert.equal(state(f.ctx),before);
 const a={...args,previewHash:p.previewHash,operationKey:'synthetic-operation-002'};const first=await commitCorrection._handler(f.ctx,a),second=await commitCorrection._handler(f.ctx,a);assert.equal(first.id,second.id);assert.equal(second.replayed,true);
 await assert.rejects(()=>commitCorrection._handler(f.ctx,{...a,previewHash:'different'}),/KUNCI_OPERASI_DIPAKAI/);
});
await check('stale meeting/class revision and mutated preview cannot write',async()=>{
 const f=await ready(),args=await request(f),p=await previewCorrection._handler(f.ctx,args);
 await assert.rejects(()=>commitCorrection._handler(f.ctx,{...args,patch:{tanggal:'2026-10-24'},previewHash:p.previewHash,operationKey:'synthetic-operation-003'}),/PREVIEW_KOREKSI_BERUBAH/);
 await f.ctx.db.patch(f.kelasId,{revision:2});await assert.rejects(()=>save(f,args),/KONFLIK_REVISI/);assert.equal((await f.ctx.db.get(f.pertemuanId)).revision,1);
});
await check('future date edit does not snapshot/freeze roster or invent stored attendance',async()=>{
 const f=await ready(false),args=await request(f,{reason:''});const p=await previewCorrection._handler(f.ctx,args);await new Promise(r=>setTimeout(r,5));
 await commitCorrection._handler(f.ctx,{...args,previewHash:p.previewHash,operationKey:'synthetic-operation-004'});const meeting=await f.ctx.db.get(f.pertemuanId);assert.equal(meeting.status,'TERBUKA');assert.equal(meeting.snapshot,undefined);assert.equal((await f.ctx.db.query('presensi').collect()).length,0);
});
await check('a preparation snapshot is not proof of attendance; further date edits remain empty/open',async()=>{
 const f=await ready(false);const flag=await f.ctx.db.query('featureFlag').withIndex('by_key',q=>q.eq('key',CONTROL_FLAG)).unique();await f.ctx.db.patch(flag._id,{enabled:false});await f.ctx.db.patch(f.kelasId,{dosen:'Dosen Persiapan Demo'});await refreshSnapshot._handler(f.ctx,{token:f.token,pertemuanId:f.pertemuanId,baseRevision:0});await f.ctx.db.patch(flag._id,{enabled:true});
 assert.equal((await f.ctx.db.get(f.pertemuanId)).hasAttendanceHistory,false);assert.ok((await f.ctx.db.get(f.pertemuanId)).snapshot);
 await save(f,await request(f,{patch:{tanggal:'2026-10-25'},reason:''}),'synthetic-preparation-date');assert.equal((await f.ctx.db.query('presensi').collect()).length,0);assert.equal((await f.ctx.db.get(f.pertemuanId)).status,'TERBUKA');
});
await check('restore creates another revision and rejects incomplete legacy sources',async()=>{
 const f=await ready();await save(f,await request(f));await save(f,await request(f,{patch:{},restoreRevision:1}),'synthetic-operation-005');
 assert.equal((await f.ctx.db.get(f.pertemuanId)).revision,3);assert.equal((await f.ctx.db.get(f.pertemuanId)).tanggal,'2026-10-21');assert.ok(await revisionByNumber(f.ctx,f.pertemuanId,2));
 const r=await revisionByNumber(f.ctx,f.pertemuanId,1);await f.ctx.db.patch(r._id,{legacyPartial:true});
 await assert.rejects(async()=>save(f,await request(f,{patch:{},restoreRevision:1}),'synthetic-operation-006'),/REVISI_LAMA_PARSIAL/);
});
await check('roster refresh is selective and requires explicit review',async()=>{
 const f=await ready();const added=await f.ctx.db.insert('peserta',{kelasId:f.kelasId,nim:'QA-NEW',nama:'Peserta Baru Demo',golongan:'B',urut:5,aktif:true});
 const args=await request(f,{patch:{},refreshCategories:['roster']}),p=await previewCorrection._handler(f.ctx,args);assert.equal(p.needsRosterReview,true);assert.equal(p.statuses.find(s=>s.pesertaId===f.peserta[1]).status,'ALPHA');
 await assert.rejects(()=>commitCorrection._handler(f.ctx,{...args,previewHash:p.previewHash,operationKey:'synthetic-operation-007'}),/PERIKSA_ROSTER_KOREKSI/);
 await commitCorrection._handler(f.ctx,{...args,rosterReviewed:true,previewHash:p.previewHash,operationKey:'synthetic-operation-007'});assert.equal((await f.ctx.db.query('presensi').collect()).length,5);assert.ok(p.statuses.some(s=>s.pesertaId===added));
});
await check('server permissions and revocation protect new edits and successful-commit retries',async()=>{
 const f=await ready();await f.ctx.db.patch(f.user,{peran:'OPERATOR',kelasIds:[f.kelasId]});await assert.rejects(async()=>save(f,await request(f)),/IZIN_KELAS_KURANG/);
 const grant=await f.ctx.db.insert('classCapability',{kelasId:f.kelasId,penggunaId:f.user,capabilities:['schedule','history']});const args=await request(f),p=await previewCorrection._handler(f.ctx,args),a={...args,previewHash:p.previewHash,operationKey:'synthetic-operation-008'};
 await commitCorrection._handler(f.ctx,a);await f.ctx.db.patch(grant,{capabilities:[]});await assert.rejects(()=>commitCorrection._handler(f.ctx,a),/IZIN_KELAS_KURANG/);
});
await check('invalid date, duplicate number, missing reason and foreign status are rejected',async()=>{
 const f=await ready();await f.ctx.db.insert('pertemuan',{kelasId:f.kelasId,nomor:4,tanggal:'2026-10-28',tempat:'QA',tipe:'REGULER',status:'TERBUKA',revision:0});
 for(const extra of[{patch:{tanggal:'2026-02-30'}},{patch:{nomor:4}},{reason:''},{patch:{},statuses:[{pesertaId:'foreign',status:'HADIR'}]}])await assert.rejects(async()=>save(f,await request(f,extra)));
 assert.equal((await f.ctx.db.get(f.pertemuanId)).revision,1);
});
console.log(`${groups} correction groups passed.`);
