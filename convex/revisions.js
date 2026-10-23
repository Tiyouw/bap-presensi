import {v} from "convex/values";
import {query,mutation} from "./_generated/server.js";
import {paginationOptsValidator} from "convex/server";
import {requireMeeting,requireClass,classCapabilities} from "./lib/access.js";
import {classSnapshot} from "./lib/classLogic.js";
import {revisionByNumber,readRevision,controlEnabled,activeStatuses} from "./lib/revisionLedger.js";
import {prepareCorrection,publicCorrectionPreview,commitCorrectionLogic} from "./lib/correctionLogic.js";
export const correctionArgs={token:v.string(),pertemuanId:v.id("pertemuan"),expectedClassRevision:v.number(),expectedMeetingRevision:v.number(),
  patch:v.optional(v.any()),refreshCategories:v.optional(v.array(v.string())),templateVersion:v.optional(v.number()),
  restoreRevision:v.optional(v.number()),statuses:v.optional(v.array(v.object({pesertaId:v.id("peserta"),status:v.string()}))),
  lifecycleAction:v.optional(v.union(v.literal("cancel"),v.literal("restore"))),
  attendanceMode:v.optional(v.union(v.literal("restore"),v.literal("reset"))),
  rosterReviewed:v.optional(v.boolean()),reason:v.string()};
export const previewCorrection = query({args:correctionArgs,handler:async(ctx,a)=>publicCorrectionPreview(await prepareCorrection(ctx,a))});
export const commitCorrection = mutation({args:{...correctionArgs,previewHash:v.string(),operationKey:v.string()},handler:commitCorrectionLogic});
export const cancelMeeting = mutation({args:{...correctionArgs,previewHash:v.string(),operationKey:v.string()},handler:(ctx,a)=>commitCorrectionLogic(ctx,{...a,lifecycleAction:"cancel"})});
export const restoreMeeting = mutation({args:{...correctionArgs,previewHash:v.string(),operationKey:v.string()},handler:(ctx,a)=>commitCorrectionLogic(ctx,{...a,lifecycleAction:"restore"})});
export const editor = query({
  args:{token:v.string(),pertemuanId:v.id("pertemuan"),operationKey:v.optional(v.string())},handler:async(ctx,a)=>{
    const{meeting,kelas,user}=await requireMeeting(ctx,a.token,a.pertemuanId);
    const latest=await revisionByNumber(ctx,meeting._id,meeting.revision);
    const completed=a.operationKey&&a.operationKey.length<=128?await ctx.db.query("meetingRevision").withIndex("by_operation",q=>q.eq("pertemuanId",meeting._id).eq("operationKey",a.operationKey)).unique():null;
    return{meeting:{...meeting,id:meeting._id},classRevision:kelas.revision,
      snapshot:meeting.snapshot||{...await classSnapshot(ctx,kelas._id,meeting),capturedAt:meeting._creationTime||0},
      statuses:await activeStatuses(ctx,meeting._id),enabled:Boolean(kelas.revisionReady)&&await controlEnabled(ctx),
      capabilities:await classCapabilities(ctx,user,kelas),archived:kelas.arsip,
      completedOperation:completed?.actorId===user._id?{operationKey:completed.operationKey,revision:completed.revision,date:completed.tanggal}:null,
      lastOperationKey:latest?.actorId===user._id?latest.operationKey||null:null};
  },
});
export const history = query({
  args:{token:v.string(),pertemuanId:v.id("pertemuan")},
  handler:async(ctx,a)=>{
    await requireMeeting(ctx,a.token,a.pertemuanId);
    return(await ctx.db.query("meetingRevision").withIndex("by_meeting_revision",q=>q.eq("pertemuanId",a.pertemuanId)).order("desc").take(50))
      .map(({snapshot,operationHash,operationKey,requiredCapabilities,...header})=>header);
  },
});
export const detail = query({
  args:{token:v.string(),pertemuanId:v.id("pertemuan"),revision:v.number()},
  handler:async(ctx,a)=>{await requireMeeting(ctx,a.token,a.pertemuanId);return readRevision(ctx,await revisionByNumber(ctx,a.pertemuanId,a.revision));},
});
export const availability = query({
  args:{token:v.string(),pertemuanId:v.id("pertemuan")},
  handler:async(ctx,a)=>{const{kelas}=await requireMeeting(ctx,a.token,a.pertemuanId);return{enabled:await controlEnabled(ctx)&&Boolean(kelas.revisionReady)};},
});
export const classAvailability=query({args:{token:v.string(),kelasId:v.id("kelas")},handler:async(ctx,a)=>{const{kelas}=await requireClass(ctx,a.token,a.kelasId);return{enabled:Boolean(kelas.revisionReady)&&await controlEnabled(ctx)};}});
export const historyPage=query({args:{token:v.string(),pertemuanId:v.id("pertemuan"),paginationOpts:paginationOptsValidator},handler:async(ctx,a)=>{
 await requireMeeting(ctx,a.token,a.pertemuanId);const p=await ctx.db.query("meetingRevision").withIndex("by_meeting_revision",q=>q.eq("pertemuanId",a.pertemuanId)).order("desc").paginate({...a.paginationOpts,numItems:Math.max(1,Math.min(30,a.paginationOpts.numItems)),maximumBytesRead:256000});
 return{...p,page:p.page.map(({operationKey,operationHash,requiredCapabilities,...header})=>header)};
}});
export const printVersionsPage=query({args:{token:v.string(),kelasId:v.id("kelas"),paginationOpts:paginationOptsValidator},handler:async(ctx,a)=>{
 await requireClass(ctx,a.token,a.kelasId);const p=await ctx.db.query("meetingRevision").withIndex("by_class",q=>q.eq("kelasId",a.kelasId)).order("desc").paginate({...a.paginationOpts,numItems:Math.max(1,Math.min(30,a.paginationOpts.numItems)),maximumBytesRead:256000});
 return{...p,page:p.page.filter(r=>r.status==="KUNCI"&&r.tipe==="REGULER"&&!r.cancelled&&!r.legacyPartial&&r.metadataVerified).map(({operationKey,operationHash,requiredCapabilities,...header})=>header)};
}});
