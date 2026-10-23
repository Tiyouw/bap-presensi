import {v} from "convex/values";
import {query,mutation} from "./_generated/server.js";
import {requireMeeting,classCapabilities} from "./lib/access.js";
import {classSnapshot} from "./lib/classLogic.js";
import {revisionByNumber,readRevision,controlEnabled,activeStatuses} from "./lib/revisionLedger.js";
import {prepareCorrection,publicCorrectionPreview,commitCorrectionLogic} from "./lib/correctionLogic.js";
export const correctionArgs={token:v.string(),pertemuanId:v.id("pertemuan"),expectedClassRevision:v.number(),expectedMeetingRevision:v.number(),
  patch:v.optional(v.any()),refreshCategories:v.optional(v.array(v.string())),templateVersion:v.optional(v.number()),
  restoreRevision:v.optional(v.number()),statuses:v.optional(v.array(v.object({pesertaId:v.id("peserta"),status:v.string()}))),
  rosterReviewed:v.optional(v.boolean()),reason:v.string()};
export const previewCorrection = query({args:correctionArgs,handler:async(ctx,a)=>publicCorrectionPreview(await prepareCorrection(ctx,a))});
export const commitCorrection = mutation({args:{...correctionArgs,previewHash:v.string(),operationKey:v.string()},handler:commitCorrectionLogic});
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
