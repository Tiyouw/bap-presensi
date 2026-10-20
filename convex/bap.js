import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server.js";
import { requireMeeting, requireClass } from "./lib/access.js";
import { classRows, classSnapshot } from "./lib/classLogic.js";
import { bahanGenerateLogic, klaimLogic } from "./lib/bapLogic.js";
import { bahanPaketLogic, ringkasanCetakLogic } from "./lib/printLogic.js";
import { documentUrl } from "./lib/documentUrl.js";
export const fileAccess = internalQuery({
  args: { token: v.string(), id: v.id("bapDoc") },
  handler: async (ctx, a) => {
    const d = await ctx.db.get(a.id);
    if (!d || d.status !== "READY" || !d.storageId) return null;
    await requireMeeting(ctx, a.token, d.pertemuanId);
    return {
      storageId: d.storageId,
      format: d.format || "docx",
      revision: d.revision,
    };
  },
});
export const ringkasanCetak = query({
  args: { token: v.string(), kelasId: v.id("kelas") },
  handler: ringkasanCetakLogic,
});
export const bahanPaket = internalQuery({
  args: {
    token: v.string(),
    kelasId: v.id("kelas"),
    items: v.array(
      v.object({ pertemuanId: v.id("pertemuan"), revision: v.number() }),
    ),
  },
  handler: bahanPaketLogic,
});
export const bahanGenerate = internalQuery({
  args: { token: v.string(), pertemuanId: v.id("pertemuan") },
  handler: bahanGenerateLogic,
});
export const klaimInternal = internalMutation({
  args: {
    token: v.string(),
    pertemuanId: v.id("pertemuan"),
    revision: v.number(),
    format: v.string(),
  },
  handler: async (ctx, a) => {
    await requireMeeting(ctx, a.token, a.pertemuanId);
    return klaimLogic(ctx, a);
  },
});
export const selesai = internalMutation({
  args: { id: v.id("bapDoc"), storageId: v.id("_storage"), sha256: v.string() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, {
      status: "READY",
      storageId: a.storageId,
      sha256: a.sha256,
    });
  },
});
export const gagal = internalMutation({
  args: { id: v.id("bapDoc"), pesan: v.string() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, {
      status: "FAILED",
      pesan: a.pesan.slice(0, 1000),
    });
  },
});
export const docById = internalQuery({
  args: { token: v.string(), id: v.id("bapDoc") },
  handler: async (ctx, a) => {
    const d = await ctx.db.get(a.id);
    if (!d) return null;
    await requireMeeting(ctx, a.token, d.pertemuanId);
    return {
      url: d.storageId ? documentUrl(d._id) : null,
      sha256: d.sha256 || null,
    };
  },
});
export const forSesi = query({
  args: { token: v.string(), pertemuanId: v.id("pertemuan") },
  handler: async (ctx, a) => {
    const { meeting: p } = await requireMeeting(ctx, a.token, a.pertemuanId);
    if (p.tipe !== "REGULER") return null;
    const docs = (
      await ctx.db
        .query("bapDoc")
        .withIndex("by_key", (q) => q.eq("pertemuanId", p._id))
        .collect()
    )
      .filter(
        (d) =>
          d.status === "READY" &&
          d.storageId &&
          (!d.format || d.format === "docx"),
      )
      .sort((a, b) => b.revision - a.revision || b.klaimPada - a.klaimPada);
    const d = docs[0];
    return d
      ? {
          id: d._id,
          revision: d.revision,
          url: documentUrl(d._id),
          sha256: d.sha256 || null,
        }
      : null;
  },
});
export const history = query({
  args: { token: v.string(), kelasId: v.id("kelas") },
  handler: async (ctx, a) => {
    await requireClass(ctx, a.token, a.kelasId);
    const result = [];
    for (const p of await classRows(ctx, "pertemuan", a.kelasId))
      for (const d of await ctx.db
        .query("bapDoc")
        .withIndex("by_key", (q) => q.eq("pertemuanId", p._id))
        .collect())
        if (d.status === "READY" && d.storageId)
          result.push({
            id: d._id,
            pertemuanId: p._id,
            nomor: p.nomor,
            tanggal: p.tanggal,
            revision: d.revision,
            format: d.format || "docx",
            templateVersion: d.templateVersion,
            url: documentUrl(d._id),
            pada: d.klaimPada,
          });
    return result.sort((a, b) => b.pada - a.pada);
  },
});
export const previewData = internalQuery({
  args: { token: v.string(), kelasId: v.id("kelas") },
  handler: async (ctx, a) => {
    const { kelas } = await requireClass(ctx, a.token, a.kelasId, true);
    const m = {
      nomor: 1,
      tanggal: new Date().toISOString().slice(0, 10),
      tempat: kelas.tempat,
    };
    const snapshot = await classSnapshot(ctx, a.kelasId, m);
    snapshot.template = kelas.templateDraft;
    return {
      snapshot,
      pertemuan: m,
      absen: [{ nama: "Mahasiswa Contoh", gol: "A", ket: "I" }],
      jumlahAbsen: 1,
    };
  },
});
