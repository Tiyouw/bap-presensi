import {v,ConvexError} from "convex/values";
import {internalMutation} from "./_generated/server.js";
import {appendRevision,archiveMetadata,LEDGER_VERSION,CONTROL_FLAG} from "./lib/revisionLedger.js";
import {syncDocument,syncClass,syncMeeting} from "./lib/readModels.js";

const phases=["pertemuan","bapDoc","kelas"];
const COUNTS_VERSION="full-control-counts-v1";
export const backfillCounts=internalMutation({args:{cursor:v.optional(v.string())},handler:async(ctx,a)=>{
 if(await ctx.db.query("migrasi").withIndex("by_versi",q=>q.eq("versi",COUNTS_VERSION)).unique())return{isDone:true,continueCursor:null,count:0};
 const page=await ctx.db.query("pertemuan").paginate({cursor:a.cursor||null,numItems:2,maximumBytesRead:1500000});
 for(const row of page.page){if(row.hasAttendanceHistory===undefined){const recorded=await ctx.db.query("presensi").withIndex("by_pertemuan",q=>q.eq("pertemuanId",row._id)).take(1);await ctx.db.patch(row._id,{hasAttendanceHistory:Boolean(row.status==="KUNCI"||row.dikunciPada||row.revision>0&&recorded.length)});}await syncMeeting(ctx,row._id);}
 if(page.isDone)await ctx.db.insert("migrasi",{versi:COUNTS_VERSION,pada:Date.now(),ringkas:"Bounded attendance summaries ready"});
 return{isDone:page.isDone,continueCursor:page.isDone?null:page.continueCursor,count:page.page.length};
}});
export const backfill = internalMutation({
  args:{phase:v.union(v.literal("pertemuan"),v.literal("bapDoc"),v.literal("kelas")),cursor:v.optional(v.string())},
  handler:async(ctx,{phase,cursor})=>{
    const done=async key=>Boolean(await ctx.db.query("migrasi").withIndex("by_versi",q=>q.eq("versi",key)).unique());
    const key=`${LEDGER_VERSION}:${phase}`;
    if(await done(key))return{isDone:true,continueCursor:null,count:0,skipped:true};
    for(const before of phases.slice(0,phases.indexOf(phase)))if(!await done(`${LEDGER_VERSION}:${before}`))throw new ConvexError("MIGRASI_URUTAN_SALAH");
    const page=await ctx.db.query(phase).paginate({cursor:cursor||null,numItems:2,maximumBytesRead:1500000});
    for(const row of page.page){
      // Unused/open revision-0 schedules are still editable by the old client
      // before rollout. Capture their baseline on the first tracked write,
      // rather than freezing a planning date while live migration is running.
      if(phase==="pertemuan"&&row.kelasId&&(row.revision>0||row.snapshot||row.status==="KUNCI"))await appendRevision(ctx,row,{legacyPartial:row.revision>0&&!row.snapshot});
      if(phase==="bapDoc"){
        const p=await ctx.db.get(row.pertemuanId);
        if(p?.kelasId&&row.snapshot?.peserta)await appendRevision(ctx,{...p,revision:row.revision,snapshot:row.snapshot,status:"KUNCI"},
          {snapshot:row.snapshot,statuses:[],legacyPartial:true,unknownNumber:true,action:"LEGACY_ARCHIVE",reason:"Arsip lama; status presensi historis tidak tersedia"});
        if(!row.archiveMetadata)await ctx.db.patch(row._id,{archiveMetadata:await archiveMetadata(ctx,row)});
        await syncDocument(ctx,row._id);
      }
      if(phase==="kelas"){await ctx.db.patch(row._id,{revisionReady:true});await syncClass(ctx,row._id);}
    }
    if(page.isDone){await ctx.db.insert("migrasi",{versi:key,pada:Date.now(),ringkas:"Revision ledger backfill complete"});
      if(phase==="kelas"&&!await done(LEDGER_VERSION))await ctx.db.insert("migrasi",{versi:LEDGER_VERSION,pada:Date.now(),ringkas:"Revision ledger ready; feature remains disabled"});}
    return{isDone:page.isDone,continueCursor:page.isDone?null:page.continueCursor,count:page.page.length};
  },
});
export const setEnabled = internalMutation({
  args:{enabled:v.boolean()},handler:async(ctx,{enabled})=>{
    if(enabled&&!await ctx.db.query("migrasi").withIndex("by_versi",q=>q.eq("versi",LEDGER_VERSION)).unique())throw new ConvexError("MIGRASI_BELUM_SELESAI");
    if(enabled&&!await ctx.db.query("migrasi").withIndex("by_versi",q=>q.eq("versi",COUNTS_VERSION)).unique())throw new ConvexError("MIGRASI_BELUM_SELESAI");
    const flag=await ctx.db.query("featureFlag").withIndex("by_key",q=>q.eq("key",CONTROL_FLAG)).unique();
    if(flag)await ctx.db.patch(flag._id,{enabled,...(enabled?{everEnabled:true}:{})});else await ctx.db.insert("featureFlag",{key:CONTROL_FLAG,enabled,...(enabled?{everEnabled:true}:{})});
    return{enabled};
  },
});
