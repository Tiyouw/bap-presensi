import assert from "node:assert/strict";
import {fixture,transaction} from "./revision-fixture.mjs";
import {CONTROL_FLAG,revisionByNumber,readRevision} from "../convex/lib/revisionLedger.js";
import {simpanDanKunciLogic} from "../convex/lib/sesiLogic.js";
import {previewCorrection,commitCorrection} from "../convex/revisions.js";
import {ringkasanCetakLogic,bahanPaketLogic} from "../convex/lib/printLogic.js";
import {bahanGenerateLogic,klaimLogic,finalisasiLogic} from "../convex/lib/bapLogic.js";
let groups=0;const check=async(n,f)=>{await f();groups++;console.log('OK lifecycle',n)};
async function setup(){const f=await fixture();await f.ctx.db.insert('featureFlag',{key:CONTROL_FLAG,enabled:true});await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});return f;}
async function apply(f,extra){const p=await f.ctx.db.get(f.pertemuanId),c=await f.ctx.db.get(f.kelasId),a={token:f.token,pertemuanId:f.pertemuanId,expectedMeetingRevision:p.revision,expectedClassRevision:c.revision,patch:{},reason:'Perubahan operasional demo',...extra},preview=await previewCorrection._handler(f.ctx,a);return transaction(f.ctx,()=>commitCorrection._handler(f.ctx,{...a,previewHash:preview.previewHash,operationKey:crypto.randomUUID()}));}
await check('cancel/restore preserves statuses and files but changes active counts and print eligibility',async()=>{
 const f=await setup(),claim=await klaimLogic(f.ctx,{pertemuanId:f.pertemuanId,revision:1,format:'docx'});await finalisasiLogic(f.ctx,{id:claim.id,attempt:claim.attempt,storageId:'original-file',sha256:'original-hash'});
 await apply(f,{lifecycleAction:'cancel'});assert.equal((await ringkasanCetakLogic(f.ctx,{token:f.token,kelasId:f.kelasId})).length,0);assert.equal((await f.ctx.db.query('classView').collect())[0].data.jumlahPraktikum,0);
 await assert.rejects(()=>bahanGenerateLogic(f.ctx,{token:f.token,pertemuanId:f.pertemuanId}),/PERTEMUAN_DIBATALKAN/);await assert.rejects(()=>simpanDanKunciLogic(f.ctx,{...f,baseRevision:2}),/PERTEMUAN_DIBATALKAN/);
 await assert.rejects(()=>bahanPaketLogic(f.ctx,{token:f.token,kelasId:f.kelasId,items:[{pertemuanId:f.pertemuanId,revision:1}]}),/PAKET_BERUBAH/);
 await apply(f,{lifecycleAction:'restore'});const r=await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,3));assert.deepEqual(r.statuses,f.statuses);assert.equal(r.cancelled,false);assert.equal((await f.ctx.db.get(claim.id)).sha256,'original-hash');assert.equal((await ringkasanCetakLogic(f.ctx,{token:f.token,kelasId:f.kelasId})).length,1);assert.equal((await f.ctx.db.query('classView').collect())[0].data.jumlahPraktikum,1);
});
await check('practical to nonpractical and back requires an explicit attendance decision',async()=>{
 const f=await setup();await apply(f,{patch:{tipe:'LIBUR'}});assert.equal((await ringkasanCetakLogic(f.ctx,{token:f.token,kelasId:f.kelasId})).length,0);await assert.rejects(()=>apply(f,{patch:{tipe:'REGULER'}}),/PILIH_PRESENSI_KEMBALI/);
 await apply(f,{patch:{tipe:'REGULER'},attendanceMode:'restore'});assert.deepEqual((await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,3))).statuses,f.statuses);
 await apply(f,{patch:{tipe:'TEORI'}});await apply(f,{patch:{tipe:'REGULER'},attendanceMode:'reset'});assert.equal((await f.ctx.db.get(f.pertemuanId)).status,'TERBUKA');assert.equal((await f.ctx.db.query('presensi').collect()).length,0);
 assert.deepEqual((await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,4))).statuses,f.statuses);
 await apply(f,{patch:{tanggal:'2026-10-26'}});assert.equal((await f.ctx.db.query('presensi').collect()).length,0);assert.equal((await f.ctx.db.get(f.pertemuanId)).status,'TERBUKA');
});
await check('restore detects active number collisions and permits an explicit new number',async()=>{
 const f=await setup();await apply(f,{lifecycleAction:'cancel'});await f.ctx.db.insert('pertemuan',{kelasId:f.kelasId,nomor:3,tanggal:'2026-11-02',tempat:'QA',tipe:'REGULER',status:'TERBUKA',revision:0});await assert.rejects(()=>apply(f,{lifecycleAction:'restore'}),/NOMOR_PERTEMUAN_DUPLIKAT/);await apply(f,{lifecycleAction:'restore',patch:{nomor:5}});assert.equal((await f.ctx.db.get(f.pertemuanId)).nomor,5);
});
await check('explicit revision generation/packet remains pinned after cancellation and type changes',async()=>{
 const f=await setup(),source=await revisionByNumber(f.ctx,f.pertemuanId,1),before=await bahanGenerateLogic(f.ctx,{token:f.token,pertemuanId:f.pertemuanId,revisionId:source._id});
 await apply(f,{patch:{tanggal:'2026-10-24',tipe:'LIBUR'}});await apply(f,{lifecycleAction:'cancel'});
 const old=await bahanGenerateLogic(f.ctx,{token:f.token,pertemuanId:f.pertemuanId,revisionId:source._id});assert.deepEqual(old,before);
 const packet=await bahanPaketLogic(f.ctx,{token:f.token,kelasId:f.kelasId,items:[{pertemuanId:f.pertemuanId,revision:1,revisionId:source._id}]});assert.equal(packet[0].pertemuan.tanggal,'2026-10-21');assert.equal(packet[0].jumlahAbsen,1);
 const claim=await klaimLogic(f.ctx,{pertemuanId:f.pertemuanId,revision:1,revisionId:source._id,format:'docx'});assert.equal((await f.ctx.db.get(claim.id)).archiveMetadata.tanggal,'2026-10-21');
});
console.log(`${groups} lifecycle groups passed.`);
