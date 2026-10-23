// Synthetic browser harness runs the same correction handlers as the backend.
// It is only imported by the test Vite alias, never by the production client.
import {buatCtx} from "../test-context.mjs";
import {transaction} from "../revision-fixture.mjs";
import {hashToken} from "../../convex/lib/auth.js";
import {DEFAULT_TEMPLATE} from "../../bap-shared/management.js";
import {CAPABILITIES} from "../../bap-shared/control.js";
import {CONTROL_FLAG,appendRevision} from "../../convex/lib/revisionLedger.js";
import * as revisions from "../../convex/revisions.js";
const storageKey='ui-qa.control-engine';
export async function createControlEngine({kelas,participants,server,restore,lock=true}){
 const ctx=buatCtx(restore?Math.max(0,...restore.flatMap(([,rows])=>rows.map(([id])=>Number(/:(\d+)$/.exec(id)?.[1]||0)))):0);
 const put=(table,rows)=>ctx.tabel.set(table,new Map(rows.map(row=>{const{id,...fields}=row;return[row._id||id,fields]})));
 if(restore)for(const[table,rows]of restore)ctx.tabel.set(table,new Map(rows));
 else{
  put('pengguna',[{_id:'qa-user',username:'demo',nama:'Admin Demo',peran:'ADMIN',aktif:true,wajibGanti:false,kelasIds:['k1']}]);
  put('sesi',[{_id:'qa-session',token:await hashToken('ui-test-token'),penggunaId:'qa-user',kedaluwarsaPada:Date.now()+86400000}]);
  put('kelas',[{...kelas,revisionReady:true,draft:false,templateDraft:DEFAULT_TEMPLATE}]);
  put('matkul',[{_id:'m1',nama:kelas.matkulNama,kode:kelas.matkulKode,dibuatOleh:'qa-user'}]);
  put('template',[{_id:'qa-template',kelasId:'k1',version:1,config:DEFAULT_TEMPLATE}]);
  put('peserta',participants.map(p=>({...p,kelasId:'k1',aktif:p.aktif!==false})));
  put('pertemuan',server.pertemuan.map(p=>({...p,kelasId:'k1',...(lock&&p.id==='p3'?{status:'KUNCI',revision:1,snapshot:{capturedAt:1,kelas:{...kelas},template:DEFAULT_TEMPLATE,templateVersion:'kelas-k1-v1',tanggal:p.tanggal,tempat:p.tempat,peserta:participants.map(p=>({...p}))}}:{})})));
  const rows=[];for(const p of server.pertemuan)for(const s of server.presensi[p.id]||[])rows.push({...s,_id:'qa-presensi-'+rows.length,pertemuanId:p.id});
  if(lock&&!rows.some(s=>s.pertemuanId==='p3'))for(const[ i,p]of participants.entries())rows.push({_id:'qa-presensi-'+rows.length,pertemuanId:'p3',pesertaId:p.id,status:i===0?'ALPHA':'HADIR'});
  put('presensi',rows);put('featureFlag',[{_id:'qa-control-flag',key:CONTROL_FLAG,enabled:true}]);
  for(const p of await ctx.db.query('pertemuan').collect())if(p.id==='p3'||p._id==='p3')await appendRevision(ctx,p);
 }
 const cache=new Map();
 const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify([...ctx.tabel].map(([t,m])=>[t,[...m]])))}catch{}};
 async function refresh(){for(const p of await ctx.db.query('pertemuan').collect()){
   cache.set('revisions:editor:'+p._id,await revisions.editor._handler(ctx,{token:'ui-test-token',pertemuanId:p._id}));
   cache.set('revisions:history:'+p._id,await revisions.history._handler(ctx,{token:'ui-test-token',pertemuanId:p._id}));
  }persist();}
 const engine={ctx,cache,refresh,user:()=>ctx.tabel.get('pengguna').get('qa-user'),
  query:async(name,args)=>{if(!name.startsWith('revisions:')||!revisions[name.split(':')[1]]?._handler)throw Error('Unexpected test query '+name);return revisions[name.split(':')[1]]._handler(ctx,args)},
  mutate:async(name,args)=>{const result=await transaction(ctx,()=>revisions[name.split(':')[1]]._handler(ctx,args));await refresh();return result;},
  advance:async(id)=>{const p=await ctx.db.get(id),c=await ctx.db.get('k1'),args={token:'ui-test-token',pertemuanId:id,expectedMeetingRevision:p.revision,expectedClassRevision:c.revision,patch:{tanggal:new Date(Date.parse(p.tanggal+'T00:00:00Z')+86400000).toISOString().slice(0,10)},reason:'Koreksi pengguna lain dalam tes'};
   const preview=await revisions.previewCorrection._handler(ctx,args);await engine.mutate('revisions:commitCorrection',{...args,previewHash:preview.previewHash,operationKey:crypto.randomUUID()});},
  controls:()=>({enabled:true,capabilities:engine.user().peran==='OPERATOR'?ctx.tabel.get('classCapability')?.values().next().value?.capabilities||[]:[...CAPABILITIES]})
 };
 await refresh();return engine;
}
export const restoreControlEngine=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch{return null}};
