import {buatCtx} from "./test-context.mjs";
import {hashToken} from "../convex/lib/auth.js";
import {DEFAULT_TEMPLATE} from "../bap-shared/management.js";
export async function fixture(count=4){
 const ctx=buatCtx(),token="revision-synthetic-token";
 const user=await ctx.db.insert("pengguna",{username:"qa.admin",nama:"Admin Demo",aktif:true,wajibGanti:false,peran:"ADMIN",kelasIds:[]});
 await ctx.db.insert("sesi",{token:await hashToken(token),penggunaId:user,kedaluwarsaPada:Date.now()+3600000});
 const matkulId=await ctx.db.insert("matkul",{nama:"Praktikum Demo",kode:"QA",dibuatOleh:user});
 const kelasId=await ctx.db.insert("kelas",{matkulId,nama:"Kelas Demo",dosen:"Dosen Demo",asdos:"Asisten Demo",dosenId:"",asdosId:"",semester:"GASAL",tahunAkademik:"2026/2027",tingkat:"3",prodi:"Demo",tempat:"Ruang Demo",arsip:false,draft:false,revision:1,templateVersion:1,templateDraft:DEFAULT_TEMPLATE,revisionReady:true});
 await ctx.db.insert("template",{kelasId,version:1,config:DEFAULT_TEMPLATE});
 const peserta=[];for(let i=0;i<count;i++)peserta.push(await ctx.db.insert("peserta",{kelasId,nim:`QA${i+1}`,nama:`Peserta Demo ${i+1}`,golongan:"A",urut:i+1,aktif:true}));
 const pertemuanId=await ctx.db.insert("pertemuan",{kelasId,nomor:3,tanggal:"2026-10-21",tempat:"Ruang Demo",tipe:"REGULER",status:"TERBUKA",revision:0});
 return{ctx,token,user,kelasId,matkulId,peserta,pertemuanId,statuses:peserta.map((id,i)=>({pesertaId:id,status:i===1?"ALPHA":"HADIR"}))};
}
// Explicit rollback adapter for handler tests. Native preview separately checks
// the real Convex transaction semantics; this adapter is not proof of the server.
export async function transaction(ctx,fn){const backup=structuredClone([...ctx.tabel]);try{return await fn();}catch(e){ctx.tabel.clear();for(const[k,v]of backup)ctx.tabel.set(k,v);throw e;}}
