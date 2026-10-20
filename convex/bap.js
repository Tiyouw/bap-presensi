import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server.js";
import { TEMPLATE_VERSION, requireSesi } from "./lib/auth.js";
import { bahanGenerateLogic, klaimLogic } from "./lib/bapLogic.js";
import { bahanPaketLogic, ringkasanCetakLogic } from "./lib/printLogic.js";
import { adaPraktikum } from "../bap-shared/jadwal.js";

export const ringkasanCetak = query({
  args: { token: v.string() },
  handler: ringkasanCetakLogic,
});

export const bahanPaket = internalQuery({
  args: {
    token: v.string(),
    items: v.array(
      v.object({ pertemuanId: v.id("pertemuan"), revision: v.number() }),
    ),
  },
  handler: bahanPaketLogic,
});

const klaimArgs = {
  token: v.string(),
  pertemuanId: v.id("pertemuan"),
  revision: v.number(),
};

async function klaimTerverifikasi(ctx, args) {
  await requireSesi(ctx, args.token);
  return klaimLogic(ctx, args);
}

/** Publik: dipakai tombol "Buat BAP" di klien. */
export const klaim = mutation({ args: klaimArgs, handler: klaimTerverifikasi });

/** Internal: action hanya boleh memanggil internal mutation/query. */
export const klaimInternal = internalMutation({
  args: klaimArgs,
  handler: klaimTerverifikasi,
});

export const bahanGenerate = internalQuery({
  args: { pertemuanId: v.id("pertemuan") },
  handler: bahanGenerateLogic,
});

export const docById = internalQuery({
  args: { id: v.id("bapDoc") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || !doc.storageId) return { url: null, sha256: null };
    return {
      url: await ctx.storage.getUrl(doc.storageId),
      sha256: doc.sha256 ?? null,
    };
  },
});

export const selesai = internalMutation({
  args: { id: v.id("bapDoc"), storageId: v.id("_storage"), sha256: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "READY",
      storageId: args.storageId,
      sha256: args.sha256,
    });
    return { ok: true };
  },
});

export const gagal = internalMutation({
  args: { id: v.id("bapDoc"), pesan: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "FAILED", pesan: args.pesan });
    return { ok: true };
  },
});

/** Dokumen BAP terbaru untuk satu pertemuan (unduh + penanda usang). */
export const forSesi = query({
  args: { token: v.string(), pertemuanId: v.id("pertemuan") },
  handler: async (ctx, args) => {
    await requireSesi(ctx, args.token);
    const meeting = await ctx.db.get(args.pertemuanId);
    if (!meeting || !adaPraktikum(meeting)) return null;
    const docs = await ctx.db
      .query("bapDoc")
      .withIndex("by_key", (q) => q.eq("pertemuanId", args.pertemuanId))
      .take(50);
    const siap = docs
      .filter(
        (d) =>
          d.status === "READY" &&
          d.storageId &&
          d.templateVersion === TEMPLATE_VERSION,
      )
      .sort((a, b) => b.revision - a.revision);
    const terbaru = siap[0];
    if (!terbaru) return null;
    return {
      id: terbaru._id,
      revision: terbaru.revision,
      url: await ctx.storage.getUrl(terbaru.storageId),
      sha256: terbaru.sha256,
      templateVersion: terbaru.templateVersion,
    };
  },
});

/** Baca pesan gagal generate terbaru (untuk diagnosa, token-protected). */
export const pesanGagal = query({
  args: { token: v.string(), pertemuanId: v.id("pertemuan") },
  handler: async (ctx, args) => {
    await requireSesi(ctx, args.token);
    const docs = await ctx.db
      .query("bapDoc")
      .withIndex("by_key", (q) => q.eq("pertemuanId", args.pertemuanId))
      .take(50);
    const gagal = docs
      .filter((d) => d.status === "FAILED")
      .sort((a, b) => b.klaimPada - a.klaimPada);
    const docsAll = docs
      .filter((d) => d.status === "FAILED" || d.status === "PENDING")
      .map((d) => ({
        status: d.status,
        pesan: d.pesan ?? null,
        percobaan: d.percobaan,
        klaimPada: d.klaimPada,
      }));
    return { jumlahGagal: gagal.length, detail: docsAll };
  },
});
