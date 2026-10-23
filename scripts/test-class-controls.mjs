const state=ctx=>JSON.stringify([...ctx.tabel].map(([name,rows])=>[name,[...rows]]).filter(([,rows])=>rows.length).sort(([a],[b])=>a.localeCompare(b)));
import assert from "node:assert/strict";
import {fixture,transaction} from "./revision-fixture.mjs";
import {hashToken} from "../convex/lib/auth.js";
import {CONTROL_FLAG,readRevision,revisionByNumber} from "../convex/lib/revisionLedger.js";
import {simpanDanKunciLogic,bukaKunciLogic} from "../convex/lib/sesiLogic.js";
import * as permissions from "../convex/classAccess.js";
import * as backup from "../convex/classBackup.js";
import * as classes from "../convex/kelola.js";
import {update as updateAccount} from "../convex/accounts.js";
import {CAPABILITIES} from "../bap-shared/control.js";
import {csv} from "../bap-shared/backup.js";
let groups=0;async function check(name,fn){await fn();groups++;console.log("OK class controls",name);}
async function ready(){const f=await fixture();await f.ctx.db.insert("featureFlag",{key:CONTROL_FLAG,enabled:true,everEnabled:true});return f;}
async function operator(f,kelasIds=[f.kelasId]){const id=await f.ctx.db.insert("pengguna",{username:"operator.qa",nama:"Operator Demo",peran:"OPERATOR",aktif:true,wajibGanti:false,kelasIds}),token="class-controls-operator";await f.ctx.db.insert("sesi",{token:await hashToken(token),penggunaId:id,kedaluwarsaPada:Date.now()+3600000});return{id,token};}
async function grant(f,u,caps,rev=0){return permissions.setClassCapabilities._handler(f.ctx,{token:f.token,kelasId:f.kelasId,penggunaId:u.id,expectedRevision:rev,capabilities:caps});}
async function exportAll(f){const manifest=await backup.manifest._handler(f.ctx,f),out={...manifest};for(const section of ["participants","meetings","versions","documents"]){let cursor=null;out[section]=[];do{const page=await backup.page._handler(f.ctx,{...f,section,guard:manifest.guard,paginationOpts:{cursor,numItems:100}});out[section].push(...page.page);cursor=page.isDone?null:page.continueCursor;}while(cursor);}return out;}
const request=(f,b,extras={})=>({token:f.token,kelasId:f.kelasId,expectedClassRevision:1,crossClass:false,updateRoster:false,reason:"Pemulihan data sintetis",payload:{format:b.format,version:b.version,source:b.source,participants:b.participants},...extras});
async function save(f,a){const preview=await backup.previewRestore._handler(f.ctx,a),args={...a,previewHash:preview.previewHash,operationKey:crypto.randomUUID()};return{result:await transaction(f.ctx,()=>backup.commitRestore._handler(f.ctx,args)),args,preview};}
await check("Operator keeps historical attendance by default; explicit revocation protects old endpoints",async()=>{
 const f=await ready(),u=await operator(f);await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});await bukaKunciLogic(f.ctx,{token:u.token,pertemuanId:f.pertemuanId,expectedRevision:1});await grant(f,u,[]);
 await assert.rejects(()=>simpanDanKunciLogic(f.ctx,{...f,token:u.token,baseRevision:1}),/IZIN_KELAS_KURANG/);await assert.rejects(()=>bukaKunciLogic(f.ctx,{token:u.token,pertemuanId:f.pertemuanId,expectedRevision:1}),/IZIN_KELAS_KURANG/);
 const id=await f.ctx.db.insert("pertemuan",{kelasId:f.kelasId,nomor:4,tanggal:"2026-10-28",tipe:"REGULER",tempat:"QA",status:"TERBUKA",revision:0});await simpanDanKunciLogic(f.ctx,{...f,token:u.token,pertemuanId:id,baseRevision:0});
});
await check("delegation has CAS, no self-escalation, no foreign class or Admin targets",async()=>{
 const f=await ready(),u=await operator(f);await grant(f,u,["roster","delegate"]);await assert.rejects(()=>grant(f,u,[],0),/KONFLIK_REVISI/);await assert.rejects(()=>permissions.setClassCapabilities._handler(f.ctx,{token:u.token,kelasId:f.kelasId,penggunaId:u.id,expectedRevision:1,capabilities:CAPABILITIES}),/AKSES_DITOLAK/);
 const other=await f.ctx.db.insert("pengguna",{nama:"Other",peran:"OPERATOR",aktif:true,kelasIds:[f.kelasId]});await assert.rejects(()=>permissions.setClassCapabilities._handler(f.ctx,{token:u.token,kelasId:f.kelasId,penggunaId:other,expectedRevision:0,capabilities:["export"]}),/IZIN_KELAS_KURANG/);
 await assert.rejects(()=>grant(f,{id:f.user},[]),/AKSES_DITOLAK/);await f.ctx.db.patch(u.id,{kelasIds:[]});await assert.rejects(()=>grant(f,u,[] ,1),/AKSES_DITOLAK/);
});
await check("assignment removal clears dormant capabilities, reassignment does not revive them",async()=>{
 const f=await ready(),u=await operator(f);await grant(f,u,["schedule","export"]);const args={token:f.token,id:u.id,nama:"Operator Demo",peran:"OPERATOR",aktif:true,kelasIds:[]};await updateAccount._handler(f.ctx,args);await updateAccount._handler(f.ctx,{...args,kelasIds:[f.kelasId]});const rows=await permissions.list._handler(f.ctx,f);assert.deepEqual(rows[0].capabilities,[]);assert.equal(rows[0].revision,2);
});
await check("scoped course identity cannot modify unassigned sibling classes; archive uses class CAS",async()=>{
 const f=await ready(),base=await f.ctx.db.get(f.kelasId),sibling=await f.ctx.db.insert("kelas",{...Object.fromEntries(Object.entries(base).filter(([k])=>!k.startsWith("_"))),nama:"Kelas lain"});await f.ctx.db.patch(f.user,{peran:"PENGELOLA",kelasIds:[f.kelasId]});
 await assert.rejects(()=>classes.saveCourse._handler(f.ctx,{token:f.token,id:f.matkulId,nama:"Global",kode:"X",expectedRevision:0}),/GUNAKAN_IDENTITAS_PER_KELAS/);
 await classes.saveClass._handler(f.ctx,{token:f.token,kelasId:f.kelasId,baseRevision:1,data:{...base,matkulNama:"Nama scoped",matkulKode:"SC"}});const catalog=await classes.catalog._handler(f.ctx,f);assert.equal(catalog.kelas[0].matkulNama,"Nama scoped");assert.equal((await f.ctx.db.get(f.matkulId)).nama,"Praktikum Demo");assert.equal((await f.ctx.db.get(sibling)).courseOverride,undefined);
 await assert.rejects(()=>classes.archive._handler(f.ctx,{...f,arsip:true,expectedRevision:1}),/KONFLIK_REVISI/);await classes.archive._handler(f.ctx,{...f,arsip:true,expectedRevision:2});await classes.archive._handler(f.ctx,{...f,arsip:false,expectedRevision:3});assert.equal((await f.ctx.db.get(f.kelasId)).revision,4);
});
await check("roster import updates only selected identities/reactivations and preserves participant IDs",async()=>{
 const f=await ready(),u=await operator(f);await grant(f,u,["roster"]);await f.ctx.db.patch(f.peserta[1],{aktif:false});await classes.importRoster._handler(f.ctx,{...f,token:u.token,baseRevision:1,source:"demo.csv",allowUpdate:true,updateNims:["QA1"],reactivateNims:["QA2"],rows:[{nim:"QA1",nama:"Updated",golongan:"B"},{nim:"QA2",nama:"Unselected",golongan:"C"}]});assert.equal((await f.ctx.db.get(f.peserta[0])).nama,"Updated");assert.equal((await f.ctx.db.get(f.peserta[1])).nama,"Peserta Demo 2");assert.equal((await f.ctx.db.get(f.peserta[1])).aktif,true);
});
await check("paged backup is sanitized, consistent and export ACL applies to direct queries",async()=>{
 const f=await ready();await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});const b=await exportAll(f),raw=JSON.stringify(b);assert.equal(b.participants.length,4);assert.deepEqual(b.versions.map(r=>r.version.revision).sort(),[0,1]);assert(!/passwordHash|recoveryHashes|storageId|operationKey|token"/.test(raw));assert.equal(b.filesIncluded,false);
 const u=await operator(f);await assert.rejects(()=>backup.manifest._handler(f.ctx,{...f,token:u.token}),/IZIN_KELAS_KURANG/);const m=await backup.manifest._handler(f.ctx,f);await bukaKunciLogic(f.ctx,{...f,expectedRevision:1});await assert.rejects(()=>backup.page._handler(f.ctx,{...f,guard:m.guard,section:"participants",paginationOpts:{cursor:null,numItems:20}}),/BACKUP_DATA_BERUBAH/);
});
await check("restore preview is read-only; restore is new revision, retry idempotent, source author ignored",async()=>{
 const f=await ready();await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});const b=await exportAll(f),r=b.meetings[0];r.version.tanggal="2026-10-23";r.version.snapshot.tanggal=r.version.tanggal;r.version.provenance={actor:"spoof",createdAt:1};const a=request(f,b,{targetMeetingId:f.pertemuanId,expectedMeetingRevision:1,payload:{...request(f,b).payload,meeting:r}}),before=state(f.ctx);await backup.previewRestore._handler(f.ctx,a);assert.equal(state(f.ctx),before);
 const{result,args}=await save(f,a);assert.equal(result.revision,2);assert.deepEqual(await backup.commitRestore._handler(f.ctx,args),result);assert.equal((await f.ctx.db.get(f.pertemuanId)).tanggal,"2026-10-23");const rev=await readRevision(f.ctx,await revisionByNumber(f.ctx,f.pertemuanId,2));assert.equal(rev.actorName,"Admin Demo");assert.notEqual(rev.createdAt,1);assert.ok(await revisionByNumber(f.ctx,f.pertemuanId,1));assert.deepEqual(rev.statuses,f.statuses);
});
await check("same-class stable ID survives changed NIM; cross-class matching needs explicit namespace review",async()=>{
 const f=await ready();await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});const b=await exportAll(f);await f.ctx.db.patch(f.peserta[0],{nim:"QA-CHANGED"});const a=request(f,b,{targetMeetingId:f.pertemuanId,expectedMeetingRevision:1,payload:{...request(f,b).payload,meeting:b.meetings[0]}});const{result}=await save(f,a);assert.equal(result.revision,2);assert.equal((await f.ctx.db.get(f.peserta[0])).nim,"QA-CHANGED");assert.equal((await f.ctx.db.get(f.pertemuanId)).snapshot.peserta[0].nim,"QA1");
 const foreign={...b.source,namespace:"https://other.convex.cloud"},other=request(f,b,{expectedClassRevision:2,updateRoster:true,payload:{...request(f,b).payload,source:foreign}});await assert.rejects(()=>backup.previewRestore._handler(f.ctx,other),/BACKUP_LINTAS_KELAS_KONFIRMASI/);const p=await backup.previewRestore._handler(f.ctx,{...other,crossClass:true});assert.equal(p.crossClass,true);assert.equal(p.newCount,1);
});
await check("stale/hash/foreign-ID/partial sources reject before writes and injected failure rolls back cohort",async()=>{
 const f=await ready(),b=await exportAll(f),a=request(f,b,{updateRoster:true});const preview=await backup.previewRestore._handler(f.ctx,a);await assert.rejects(()=>backup.commitRestore._handler(f.ctx,{...a,expectedClassRevision:99,previewHash:preview.previewHash,operationKey:crypto.randomUUID()}),/KONFLIK_REVISI/);await assert.rejects(()=>backup.commitRestore._handler(f.ctx,{...a,reason:"Different",previewHash:preview.previewHash,operationKey:crypto.randomUUID()}),/PREVIEW_KOREKSI_BERUBAH/);
 await assert.rejects(()=>backup.previewRestore._handler(f.ctx,{...a,mapping:[{sourceId:b.participants[0].id,targetId:"foreign-id"}]}),/BACKUP_PESERTA_ASING/);const partial=structuredClone(b.meetings[0]);partial.version.legacyPartial=true;await assert.rejects(()=>backup.previewRestore._handler(f.ctx,request(f,b,{payload:{...a.payload,meeting:partial}})),/REVISI_LAMA_PARSIAL/);
 const before=state(f.ctx),insert=f.ctx.db.insert;f.ctx.db.insert=async(t,d)=>{if(t==="audit")throw Error("Injected failure");return insert(t,d)};await assert.rejects(()=>transaction(f.ctx,()=>backup.commitRestore._handler(f.ctx,{...a,previewHash:preview.previewHash,operationKey:crypto.randomUUID()})),/Injected failure/);assert.equal(state(f.ctx),before);
});
await check("capacity has actionable cohorts, CSV quotes and formula escaping preserve Unicode",async()=>{
 const f=await ready(),b=await exportAll(f),participants=Array.from({length:501},(_,i)=>({id:`src-${i}`,nim:`NEW${i}`,nama:`Demo ${i}`,golongan:"A",aktif:true,urut:i+1}));await assert.rejects(()=>backup.previewRestore._handler(f.ctx,request(f,b,{updateRoster:true,payload:{...request(f,b).payload,participants}})),/BACKUP_PILIH_BAGIAN/);
 const value=csv([["=SUM(1,2)"," \t@formula","Dwi, \"Ä\"","line\nnext","00123"]]);assert(value.includes('"\'=SUM(1,2)"'));assert(value.includes('"\' \t@formula"'));assert(value.includes('"Dwi, ""Ä"""'));assert(value.includes('"00123"'));
});
await check("legacy roster clients cannot silently skip updates after protocol enable/disable",async()=>{
 const f=await ready(),flag=await f.ctx.db.query("featureFlag").withIndex("by_key",q=>q.eq("key",CONTROL_FLAG)).unique();await f.ctx.db.patch(flag._id,{enabled:false});const before=state(f.ctx);
 await assert.rejects(()=>classes.importRoster._handler(f.ctx,{...f,baseRevision:1,source:"legacy.csv",allowUpdate:true,rows:[{nim:"QA1",nama:"Legacy overwrite",golongan:"B"}]}),/GUNAKAN_EDITOR_ROSTER/);assert.equal(state(f.ctx),before);
});
await check("empty grants protect all class data mutations and template reads",async()=>{
 const f=await ready(),u=await operator(f);await grant(f,u,[]);const args={token:u.token,kelasId:f.kelasId,baseRevision:1};
 for(const fn of [()=>classes.saveParticipant._handler(f.ctx,{...args,id:f.peserta[0],data:{nim:"QA1",nama:"Bad",golongan:"B"}}),()=>classes.saveClass._handler(f.ctx,{...args,data:{nama:"Bad"}}),()=>classes.saveTemplate._handler(f.ctx,{...args,config:{},publish:true}),()=>classes.archive._handler(f.ctx,{...args,expectedRevision:1,arsip:true}),()=>classes.activate._handler(f.ctx,args),()=>classes.importRoster._handler(f.ctx,{...args,source:"x",rows:[],allowUpdate:false})])await assert.rejects(fn,/IZIN_KELAS_KURANG/);
 const template=(await f.ctx.db.query("template").collect())[0];await assert.rejects(()=>classes.templateConfig._handler(f.ctx,{token:u.token,id:template._id}),/IZIN_KELAS_KURANG/);
});
await check("backup creation respects the same 100 active session limit as ordinary creation",async()=>{
 const f=await ready(),b=await exportAll(f);for(let i=0;i<99;i++)await f.ctx.db.insert("pertemuan",{kelasId:f.kelasId,nomor:100+i,tanggal:"2026-12-01",tipe:"REGULER",tempat:"QA",status:"TERBUKA",revision:0});
 const a=request(f,b,{payload:{...request(f,b).payload,meeting:b.meetings[0]}});await assert.rejects(()=>backup.previewRestore._handler(f.ctx,a),/BATAS_SESI_AKTIF/);
});
await check("backup preview shows exact lifecycle, identity, template and attendance changes",async()=>{
 const f=await ready();await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});const b=await exportAll(f),source=structuredClone(b.meetings[0]);Object.assign(source.version,{tanggal:"2026-10-24",tipe:"LIBUR",status:"TERBUKA",cancelled:true});source.version.snapshot.kelas.dosen="Dosen Impor Demo";source.version.snapshot.template.judul="JUDUL IMPOR DEMO";source.version.statuses[1].status="SAKIT";
 const a=request(f,b,{targetMeetingId:f.pertemuanId,expectedMeetingRevision:1,payload:{...request(f,b).payload,meeting:source}}),p=await backup.previewRestore._handler(f.ctx,a);assert.deepEqual(p.impact.meeting.find(r=>r.field==="cancelled"),{field:"cancelled",before:false,after:true});assert.equal(p.impact.meeting.find(r=>r.field==="tanggal").after,"2026-10-24");assert.equal(p.impact.sessionIdentity.find(r=>r.field==="dosen").after,"Dosen Impor Demo");assert.equal(p.impact.sessionTemplate.find(r=>r.field==="judul").after,"JUDUL IMPOR DEMO");assert.equal(p.impact.attendance[1].before.status,"ALPHA");assert.equal(p.impact.attendance[1].after.status,"SAKIT");
});
await check("backup files reject string booleans instead of silently reactivating or cancelling",async()=>{
 const f=await ready(),b=await exportAll(f),a=request(f,b,{updateRoster:true}),bad=structuredClone(a);bad.payload.participants[0].aktif="false";await assert.rejects(()=>backup.previewRestore._handler(f.ctx,bad),/BACKUP_TIDAK_VALID/);const meeting=structuredClone(b.meetings[0]);meeting.version.cancelled="false";await assert.rejects(()=>backup.previewRestore._handler(f.ctx,request(f,b,{payload:{...a.payload,meeting}})),/BACKUP_TIDAK_VALID/);
});
await check("unlock invalidates a restore preview even when the numeric meeting revision is unchanged",async()=>{
 const f=await ready();await simpanDanKunciLogic(f.ctx,{...f,baseRevision:0});const b=await exportAll(f),a=request(f,b,{targetMeetingId:f.pertemuanId,expectedMeetingRevision:1,payload:{...request(f,b).payload,meeting:b.meetings[0]}}),p=await backup.previewRestore._handler(f.ctx,a);await bukaKunciLogic(f.ctx,{...f,expectedRevision:1});assert.equal((await f.ctx.db.get(f.pertemuanId)).revision,1);const before=state(f.ctx);await assert.rejects(()=>backup.commitRestore._handler(f.ctx,{...a,previewHash:p.previewHash,operationKey:crypto.randomUUID()}),/PREVIEW_KOREKSI_BERUBAH/);assert.equal(state(f.ctx),before);
});
console.log(`${groups} class control groups passed.`);
