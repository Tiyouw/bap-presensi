import {v,ConvexError} from "convex/values";
import {mutation} from "./_generated/server.js";
import {requireCapability,audit} from "./lib/access.js";
import {controlEnabled} from "./lib/revisionLedger.js";
import {classRows} from "./lib/classLogic.js";
import {syncMeeting,syncClass} from "./lib/readModels.js";
import {hashToken} from "./lib/auth.js";
import {validDate,text,TYPES} from "../bap-shared/management.js";
const args={token:v.string(),kelasId:v.id("kelas"),expectedClassRevision:v.number(),operationKey:v.string()};
export async function classOperation(ctx,a,kind,payload,fn){
 const access=await requireCapability(ctx,a.token,a.kelasId,["schedule"]);
 if(!access.kelas.revisionReady||!await controlEnabled(ctx))throw new ConvexError("KOREKSI_BELUM_AKTIF");
 if(a.operationKey.length<16||a.operationKey.length>128)throw new ConvexError("KOREKSI_TIDAK_VALID");
 const requestHash=await hashToken(JSON.stringify({kind,payload,actor:access.user._id,base:a.expectedClassRevision}));
 const old=await ctx.db.query("classOperation").withIndex("by_class_operation",q=>q.eq("kelasId",a.kelasId).eq("operationKey",a.operationKey)).unique();
 if(old){if(old.actorId!==access.user._id||old.requestHash!==requestHash)throw new ConvexError("KUNCI_OPERASI_DIPAKAI");return old.result;}
 if(access.kelas.revision!==a.expectedClassRevision)throw new ConvexError("KONFLIK_REVISI");
 const result=await fn(access);
 await ctx.db.insert("classOperation",{kelasId:a.kelasId,actorId:access.user._id,operationKey:a.operationKey,requestHash,result});return result;
}
export const addMeeting=mutation({args:{...args,data:v.object({nomor:v.number(),tanggal:v.string(),tempat:v.string(),tipe:v.string()})},handler:async(ctx,a)=>classOperation(ctx,a,"ADD",a.data,async({kelas,user})=>{
 const data={nomor:a.data.nomor,tanggal:a.data.tanggal,tempat:text(a.data.tempat,"Ruang",80),tipe:a.data.tipe};validDate(data.tanggal);
 if(!Number.isInteger(data.nomor)||data.nomor<1||data.nomor>1000||!TYPES.includes(data.tipe))throw new ConvexError("JADWAL_TIDAK_VALID");
 const active=(await classRows(ctx,"pertemuan",kelas._id)).filter(p=>!p.cancelled);
 if(active.some(p=>p.nomor===data.nomor))throw new ConvexError("NOMOR_PERTEMUAN_DUPLIKAT");
 if(active.length>=100)throw new ConvexError("BATAS_SESI_AKTIF");
 const id=await ctx.db.insert("pertemuan",{...data,kelasId:kelas._id,status:"TERBUKA",revision:0,cancelled:false,hasAttendanceHistory:false});
 await ctx.db.patch(kelas._id,{revision:kelas.revision+1});await syncMeeting(ctx,id);await syncClass(ctx,kelas._id);
 await audit(ctx,user,"PERTEMUAN_TAMBAH",`Pertemuan ${data.nomor} · ${data.tanggal}`,kelas._id,id);return{id,revision:0};
})});
// A draft is committed in one transaction: invalid rows cannot leave a partial schedule.
export const addMeetings=mutation({args:{...args,items:v.array(v.object({nomor:v.number(),tanggal:v.string(),tempat:v.string(),tipe:v.string()}))},handler:async(ctx,a)=>classOperation(ctx,a,"ADD_MANY",a.items,async({kelas,user})=>{
 if(!a.items.length||a.items.length>100)throw new ConvexError("BATAS_SESI_AKTIF");
 const active=(await classRows(ctx,"pertemuan",kelas._id)).filter(p=>!p.cancelled);
 if(active.length+a.items.length>100)throw new ConvexError("BATAS_SESI_AKTIF");
 const numbers=new Set(active.map(p=>p.nomor));
 const rows=a.items.map(item=>{
  const row={...item,tempat:text(item.tempat,"Ruang",80)};validDate(row.tanggal);
  if(!Number.isInteger(row.nomor)||row.nomor<1||row.nomor>1000||!TYPES.includes(row.tipe))throw new ConvexError("JADWAL_TIDAK_VALID");
  if(numbers.has(row.nomor))throw new ConvexError("NOMOR_PERTEMUAN_DUPLIKAT");numbers.add(row.nomor);return row;
 });
 const created=[];
 for(const row of rows){
  const id=await ctx.db.insert("pertemuan",{...row,kelasId:kelas._id,status:"TERBUKA",revision:0,cancelled:false,hasAttendanceHistory:false});
  await syncMeeting(ctx,id);created.push({id,revision:0});
  await audit(ctx,user,"PERTEMUAN_TAMBAH",`Pertemuan ${row.nomor} · ${row.tanggal}`,kelas._id,id);
 }
 await ctx.db.patch(kelas._id,{revision:kelas.revision+1});await syncClass(ctx,kelas._id);
 return{created,classRevision:kelas.revision+1};
})});
export const deleteEmptyMeeting=mutation({args:{...args,pertemuanId:v.id("pertemuan"),expectedMeetingRevision:v.number()},handler:async(ctx,a)=>classOperation(ctx,a,"DELETE",{id:a.pertemuanId,revision:a.expectedMeetingRevision},async({kelas,user})=>{
 const p=await ctx.db.get(a.pertemuanId);if(!p||p.kelasId!==kelas._id)throw new ConvexError("AKSES_DITOLAK");
 if(p.revision!==a.expectedMeetingRevision)throw new ConvexError("KONFLIK_REVISI");
 const statuses=await ctx.db.query("presensi").withIndex("by_pertemuan",q=>q.eq("pertemuanId",p._id)).take(1),docs=await ctx.db.query("bapDoc").withIndex("by_key",q=>q.eq("pertemuanId",p._id)).take(1);
 if(p.revision>0||p.status!=="TERBUKA"||p.snapshot||statuses.length||docs.length)throw new ConvexError("GUNAKAN_PEMBATALAN_SESI");
 await ctx.db.delete(p._id);await syncMeeting(ctx,p._id);await ctx.db.patch(kelas._id,{revision:kelas.revision+1});await syncClass(ctx,kelas._id);
 await audit(ctx,user,"PERTEMUAN_KOSONG_HAPUS",`Pertemuan ${p.nomor} · ${p.tanggal}`,kelas._id);return{deleted:true,id:p._id};
})});
