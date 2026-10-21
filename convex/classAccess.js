import {v,ConvexError} from "convex/values";
import {query,mutation} from "./_generated/server.js";
import {requireClassControl,classCapabilities,audit} from "./lib/access.js";
import {CAPABILITIES} from "../bap-shared/control.js";
export const list=query({args:{token:v.string(),kelasId:v.id("kelas")},handler:async(ctx,a)=>{
 const{user,kelas}=await requireClassControl(ctx,a.token,a.kelasId,["delegate"],false);
 const users=await ctx.db.query("pengguna").collect(),result=[];
 for(const target of users.filter(u=>u.peran==="OPERATOR"&&u.kelasIds.includes(kelas._id))){
  const grant=await ctx.db.query("classCapability").withIndex("by_class_user",q=>q.eq("kelasId",kelas._id).eq("penggunaId",target._id)).unique();
  result.push({id:target._id,nama:target.nama,aktif:target.aktif,self:target._id===user._id,revision:grant?.revision||0,configured:Boolean(grant),capabilities:await classCapabilities(ctx,target,kelas)});
 }
 return result;
}});
export const setClassCapabilities=mutation({args:{token:v.string(),kelasId:v.id("kelas"),penggunaId:v.id("pengguna"),expectedRevision:v.number(),capabilities:v.array(v.string())},handler:async(ctx,a)=>{
 const{user,kelas}=await requireClassControl(ctx,a.token,a.kelasId,["delegate"]),target=await ctx.db.get(a.penggunaId),own=await classCapabilities(ctx,user,kelas);
 if(!target?.aktif||target.peran!=="OPERATOR"||!target.kelasIds.includes(kelas._id)||target._id===user._id)throw new ConvexError("AKSES_DITOLAK");
 if(a.capabilities.length>CAPABILITIES.length||new Set(a.capabilities).size!==a.capabilities.length||a.capabilities.some(c=>!CAPABILITIES.includes(c)||!own.includes(c)))throw new ConvexError("IZIN_KELAS_KURANG");
 const old=await ctx.db.query("classCapability").withIndex("by_class_user",q=>q.eq("kelasId",kelas._id).eq("penggunaId",target._id)).unique();
 if((old?.revision||0)!==a.expectedRevision)throw new ConvexError("KONFLIK_REVISI");
 const fields={capabilities:CAPABILITIES.filter(c=>a.capabilities.includes(c)),revision:a.expectedRevision+1};
 if(old)await ctx.db.patch(old._id,fields);else await ctx.db.insert("classCapability",{kelasId:kelas._id,penggunaId:target._id,...fields});
 await audit(ctx,user,"IZIN_KELAS_UBAH",`${target.nama}: ${fields.capabilities.join(", ")||"tanpa izin tambahan"}`,kelas._id);
 return fields;
}});
