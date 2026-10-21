import { v, ConvexError } from "convex/values";
import { internalMutation } from "./_generated/server.js";
import { READ_MODEL_VERSION, syncParticipant, syncMeeting, syncTemplate, syncClass, syncDocument } from "./lib/readModels.js";

// Owner-only deployment command. Resume each returned cursor, in phase order.
// Small byte-bounded pages also support legacy meetings with large snapshots.
export const rebuildReadModels = internalMutation({
  args: { phase: v.union(v.literal("peserta"), v.literal("pertemuan"), v.literal("template"), v.literal("bapDoc"), v.literal("kelas")), cursor: v.optional(v.string()) },
  handler: async (ctx, { phase, cursor }) => {
    const phases = ["peserta", "pertemuan", "template", "bapDoc", "kelas"];
    const done = async key => Boolean(await ctx.db.query("migrasi").withIndex("by_versi", q => q.eq("versi", key)).unique());
    const key = `${READ_MODEL_VERSION}:${phase}`;
    if (await done(key)) return { isDone: true, continueCursor: null, skipped: true };
    for (const previous of phases.slice(0, phases.indexOf(phase)))
      if (!await done(`${READ_MODEL_VERSION}:${previous}`)) throw new ConvexError("MIGRASI_URUTAN_SALAH");
    const page = await ctx.db.query(phase).paginate({ cursor: cursor || null, numItems: phase === "peserta" ? 100 : 5, maximumBytesRead: 2 * 1024 * 1024 });
    for (const row of page.page) {
      if (phase === "peserta") await syncParticipant(ctx, row._id);
      else if (phase === "pertemuan") await syncMeeting(ctx, row._id);
      else if (phase === "template") await syncTemplate(ctx, row._id);
      else if (phase === "bapDoc") await syncDocument(ctx, row._id);
      else {
        await ctx.db.patch(row._id, { readModelReady: true });
        await syncClass(ctx, row._id);
      }
    }
    if (page.isDone) {
      await ctx.db.insert("migrasi", { versi: key, pada: Date.now(), ringkas: "Read model backfill complete" });
      if (phase === "kelas" && !await done(READ_MODEL_VERSION))
        await ctx.db.insert("migrasi", { versi: READ_MODEL_VERSION, pada: Date.now(), ringkas: "Read models enabled" });
    }
    return { isDone: page.isDone, continueCursor: page.isDone ? null : page.continueCursor, count: page.page.length };
  },
});
