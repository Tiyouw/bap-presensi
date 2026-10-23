import {v} from "convex/values";
import {query} from "./_generated/server.js";
import {requireMeeting} from "./lib/access.js";
import {revisionByNumber,readRevision,controlEnabled} from "./lib/revisionLedger.js";
export const history = query({
  args:{token:v.string(),pertemuanId:v.id("pertemuan")},
  handler:async(ctx,a)=>{
    await requireMeeting(ctx,a.token,a.pertemuanId);
    return(await ctx.db.query("meetingRevision").withIndex("by_meeting_revision",q=>q.eq("pertemuanId",a.pertemuanId)).order("desc").take(50))
      .map(({snapshot,...header})=>header);
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
