import assert from "node:assert/strict";
import { buatCtx } from "./test-context.mjs";
import { hashToken } from "../convex/lib/auth.js";
import { simpanDanKunciLogic, bukaKunciLogic } from "../convex/lib/sesiLogic.js";
import { klaimLogic, finalisasiLogic, KLAIM_HIDUP_MS } from "../convex/lib/bapLogic.js";
import { saveCourse, saveClass, activate, refreshSnapshot, catalog, detail, search } from "../convex/kelola.js";
import { rebuildReadModels } from "../convex/maintenance.js";
import { READ_MODEL_VERSION, syncDocument } from "../convex/lib/readModels.js";
import { historyPage } from "../convex/bap.js";
import { ringkasanCetakLogic } from "../convex/lib/printLogic.js";
import { passwordInternal, update, prepareLogin } from "../convex/accounts.js";
import { assertSnapshotSize } from "../convex/lib/snapshotSize.js";
import { DEFAULT_TEMPLATE } from "../bap-shared/management.js";
import { reconcileDraft, rosterData } from "../src/lib/draft.js";
const token="audit-synthetic-token";
async function fixture() {
  const ctx=buatCtx();
  const user=await ctx.db.insert("pengguna",{username:"admin.demo",nama:"Admin Demo",peran:"ADMIN",aktif:true,wajibGanti:false,kelasIds:[],passwordHash:"old-hash",recoveryHashes:["old-code-hash"]});
  await ctx.db.insert("sesi",{token:await hashToken(token),penggunaId:user,kedaluwarsaPada:Date.now()+3600000});
  const matkulId=await ctx.db.insert("matkul",{nama:"Demo",kode:"DEMO",dibuatOleh:user});
  const kelasId=await ctx.db.insert("kelas",{matkulId,nama:"Kelas Demo",dosen:"Dosen Demo",asdos:"Asdos Demo",semester:"GASAL",tahunAkademik:"2026/2027",tingkat:"3",prodi:"Demo",tempat:"F6",arsip:false,draft:true,revision:1,templateVersion:1,templateDraft:DEFAULT_TEMPLATE});
  await ctx.db.insert("template",{kelasId,version:1,config:DEFAULT_TEMPLATE});
  const pesertaId=await ctx.db.insert("peserta",{kelasId,nim:"DEMO001",nama:"Demo Satu",golongan:"A",urut:1,aktif:true});
  const pertemuanId=await ctx.db.insert("pertemuan",{kelasId,nomor:1,tipe:"REGULER",tanggal:"2026-10-21",tempat:"F6",status:"TERBUKA",revision:0});
  return {ctx,user,matkulId,kelasId,pesertaId,pertemuanId};
}
let groups=0;
async function check(name,fn){await fn();groups++;console.log("OK audit",name);}
await check("F01 reconcile additions/removals/identity changes preserves statuses and requires review",()=>{
  const old=[{id:"a",nim:"001",nama:"A",golongan:"A"},{id:"b",nim:"002",nama:"B",golongan:"B"}];
  const draft={baseRevision:1,statuses:{a:"ALPHA",b:"SAKIT"},roster:rosterData(old)};
  const next=reconcileDraft(draft,[old[0],{id:"c",nim:"003",nama:"C",golongan:"A"}]);
  assert.deepEqual(next.statuses,{a:"ALPHA",c:"HADIR"});assert.deepEqual(next.rosterReviewIds,["c"]);assert.equal(next.needsRosterReview,true);
  assert.equal(draft.statuses.b,"SAKIT");assert.equal(reconcileDraft(draft,[...old]).needsRosterReview,false);
  assert.deepEqual(reconcileDraft(draft,[{...old[0],nama:"A baru"},old[1]]).rosterReviewIds,["a"]);
  assert.equal(reconcileDraft({baseRevision:1,statuses:{a:"toString"}},old),null);
  assert.equal(reconcileDraft({...draft,roster:"corrupt",rosterReviewIds:"corrupt"},old).statuses.a,"ALPHA");
});
await check("F04 stale unlock cannot reopen latest lock; matching retry is idempotent",async()=>{
  const f=await fixture(),a={token,pertemuanId:f.pertemuanId};await activate._handler(f.ctx,{token,kelasId:f.kelasId});
  const statuses=[{pesertaId:f.pesertaId,status:"ALPHA"}];
  await simpanDanKunciLogic(f.ctx,{...a,baseRevision:0,statuses});
  await bukaKunciLogic(f.ctx,{...a,expectedRevision:1});await bukaKunciLogic(f.ctx,{...a,expectedRevision:1});
  await simpanDanKunciLogic(f.ctx,{...a,baseRevision:1,statuses});
  await assert.rejects(()=>bukaKunciLogic(f.ctx,{...a,expectedRevision:1}),/KONFLIK_REVISI/);
  assert.equal((await f.ctx.db.get(f.pertemuanId)).status,"KUNCI");
});
await check("F07 course compare-and-set supports legacy revision 0",async()=>{
  const f=await fixture(),a={token,id:f.matkulId,nama:"Updated",kode:"UP",expectedRevision:0};
  assert.equal((await saveCourse._handler(f.ctx,a)).revision,1);
  await assert.rejects(()=>saveCourse._handler(f.ctx,{...a,nama:"Stale"}),/KONFLIK_REVISI/);
  assert.equal((await f.ctx.db.get(f.matkulId)).nama,"Updated");
});
await check("R01 password changes and demotion/disable invalidate old recovery codes",async()=>{
  const f=await fixture();await passwordInternal._handler(f.ctx,{token,id:f.user,hash:"new-hash",expectedHash:"old-hash"});
  assert.deepEqual((await prepareLogin._handler(f.ctx,{username:"admin.demo"})).recoveryHashes,[]);
  for(const action of[{peran:"PENGELOLA",aktif:true},{peran:"ADMIN",aktif:false}]) {
    const g=await fixture();await g.ctx.db.insert("pengguna",{peran:"ADMIN",aktif:true});
    await update._handler(g.ctx,{token,id:g.user,nama:"Admin",kelasIds:[],...action});
    assert.deepEqual((await g.ctx.db.get(g.user)).recoveryHashes,[]);
  }
});
await check("R02 class copy uses the published template",async()=>{
  const f=await fixture();await f.ctx.db.patch(f.kelasId,{templateDraft:{...DEFAULT_TEMPLATE,unit:"UNPUBLISHED"}});
  const id=await saveClass._handler(f.ctx,{token,copyId:f.kelasId,data:{nama:"Copy"}});
  assert.equal((await f.ctx.db.get(id)).templateDraft.unit,DEFAULT_TEMPLATE.unit);
});
await check("R03 oversized snapshot rejected before lock/refresh/activation writes",async()=>{
  const f=await fixture();const big={...DEFAULT_TEMPLATE,unit:"漢".repeat(400000)};
  await f.ctx.db.patch(f.kelasId,{templateDraft:big});
  const template=(await f.ctx.db.query("template").collect())[0];await f.ctx.db.patch(template._id,{config:big});
  await assert.rejects(()=>activate._handler(f.ctx,{token,kelasId:f.kelasId}),/SNAPSHOT_TERLALU_BESAR/);
  assert.equal((await f.ctx.db.get(f.kelasId)).draft,true);
  await f.ctx.db.patch(f.kelasId,{draft:false});
  await assert.rejects(()=>simpanDanKunciLogic(f.ctx,{token,pertemuanId:f.pertemuanId,baseRevision:0,statuses:[{pesertaId:f.pesertaId,status:"HADIR"}]}),/SNAPSHOT_TERLALU_BESAR/);
  assert.equal((await f.ctx.db.query("presensi").collect()).length,0);
  await assert.rejects(()=>refreshSnapshot._handler(f.ctx,{token,pertemuanId:f.pertemuanId,baseRevision:0}),/SNAPSHOT_TERLALU_BESAR/);
  assert.equal((await f.ctx.db.get(f.pertemuanId)).revision,0);
  assert.ok(assertSnapshotSize({small:true}));
});
await check("R05 stale generator completion/failure cannot replace a newer result",async()=>{
  const f=await fixture();await f.ctx.db.patch(f.pertemuanId,{status:"KUNCI",revision:1});
  const a={pertemuanId:f.pertemuanId,revision:1},first=await klaimLogic(f.ctx,a,1000),second=await klaimLogic(f.ctx,a,1000+KLAIM_HIDUP_MS+1);
  assert.equal(first.id,second.id);assert.notEqual(first.attempt,second.attempt);
  assert.equal((await finalisasiLogic(f.ctx,{id:first.id,attempt:first.attempt,storageId:"old",sha256:"old"})).accepted,false);
  assert.equal((await finalisasiLogic(f.ctx,{id:second.id,attempt:second.attempt,storageId:"new",sha256:"new"})).accepted,true);
  assert.equal((await finalisasiLogic(f.ctx,{id:first.id,attempt:first.attempt,pesan:"Late failure"})).accepted,false);
  assert.equal((await f.ctx.db.get(first.id)).storageId,"new");
});
await check("R04 resumable migration preserves source snapshots and enables bounded read models",async()=>{
  const f=await fixture();
  for(let i=0;i<500;i++)await f.ctx.db.insert("audit",{kelasId:f.kelasId,pada:i,jenis:"DEMO",ringkas:"Synthetic"});
  for(let i=0;i<60;i++)await f.ctx.db.insert("impor",{kelasId:f.kelasId,pada:i,source:"demo.csv",jumlah:1,actorId:f.user});
  const before=JSON.stringify(await f.ctx.db.get(f.pertemuanId));
  await assert.rejects(()=>rebuildReadModels._handler(f.ctx,{phase:"kelas"}),/MIGRASI_URUTAN_SALAH/);
  for(const phase of["peserta","pertemuan","template","bapDoc","kelas"]){let cursor;do{const result=await rebuildReadModels._handler(f.ctx,{phase,...(cursor?{cursor}:{})});cursor=result.continueCursor;}while(cursor);}
  assert.equal(JSON.stringify(await f.ctx.db.get(f.pertemuanId)),before);
  assert.ok((await f.ctx.db.query("migrasi").collect()).some(m=>m.versi===READ_MODEL_VERSION));
  f.ctx.reads.length=0;const data=await catalog._handler(f.ctx,{token});assert.equal(data.kelas.length,1);assert.equal(data.kelas[0].jumlahPeserta,1);
  assert.equal(f.ctx.reads.some(r=>["peserta","pertemuan","kelas"].includes(r.table)&&r.kind==="collect"),false);
  f.ctx.reads.length=0;const full=await detail._handler(f.ctx,{token,kelasId:f.kelasId});
  assert.equal(full.audit.length,50);assert.equal(full.audit[0].pada,499);assert.equal(full.impor.length,20);
  assert.equal(f.ctx.reads.some(r=>["audit","impor","template","pertemuan"].includes(r.table)&&r.kind==="collect"),false);
  assert.equal(full.templates[0].config,undefined);
  f.ctx.reads.length=0;const found=await search._handler(f.ctx,{token,q:"Demo Satu",includeArsip:false});
  assert.ok(found.some(r=>r.id===f.pesertaId));assert.equal(f.ctx.reads.some(r=>["peserta","pertemuan"].includes(r.table)),false);
  // A second run is safe and does not duplicate read models.
  assert.equal((await rebuildReadModels._handler(f.ctx,{phase:"kelas"})).skipped,true);
  assert.equal((await f.ctx.db.query("classView").collect()).length,1);
  await f.ctx.db.patch(f.pertemuanId,{status:"KUNCI",revision:1,snapshot:{tanggal:"2026-10-19"}});
  const {syncMeeting}=await import("../convex/lib/readModels.js");await syncMeeting(f.ctx,f.pertemuanId);
  assert.equal((await ringkasanCetakLogic(f.ctx,{token,kelasId:f.kelasId}))[0].tanggal,"2026-10-19");
  for(let i=0;i<65;i++) {
    const id=await f.ctx.db.insert("bapDoc",{pertemuanId:f.pertemuanId,revision:i+1,format:"docx",templateVersion:"demo",status:"READY",storageId:`synthetic-${i}`,klaimPada:i,percobaan:1,snapshot:{payload:"x".repeat(20000)}});
    await syncDocument(f.ctx,id);
  }
  f.ctx.reads.length=0;
  const first=await historyPage._handler(f.ctx,{token,kelasId:f.kelasId,paginationOpts:{cursor:null,numItems:1000}});
  assert.equal(first.page.length,50);assert.equal(first.page[0].revision,65);assert.equal(first.isDone,false);
  const last=await historyPage._handler(f.ctx,{token,kelasId:f.kelasId,paginationOpts:{cursor:first.continueCursor,numItems:50}});
  assert.equal(last.page.length,15);assert.equal(last.isDone,true);
  assert.equal(f.ctx.reads.some(r=>r.table==="bapDoc"),false);
});
console.log(`${groups} audit regression groups passed.`);
