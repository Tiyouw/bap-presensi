"use node";

import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { createHash } from "node:crypto";

import { renderBap } from "../bap-shared/bapRender.js";
import { hariTanggal } from "./lib/auth.js";
import { TEMPLATE_BASE64 } from "./lib/templateData.js";

const TAHUN_AKADEMIK = "2026/2027";
const SEMESTER = "GASAL";
const MATA_KULIAH = "Pengantar Pariwisata Budaya";
const SEM_GOL = "3 / A, B, C, D";

/**
 * Generate BAP. Idempoten:
 *  - klaim dulu (mutation, atomik) -> READY / BUSY / DIKLAIM
 *  - render di Node (docx-templates butuh API Node)
 *  - simpan ke storage + catat sha256
 *
 * Dirender di server, bukan di HP: JS lama di cache browser bisa menghasilkan
 * dokumen berbeda untuk data yang sama. sha256 + templateVersion membuat
 * "sumber sama -> dokumen sama" bisa dibuktikan.
 */
export const generate = action({
  args: { token: v.string(), pertemuanId: v.id("pertemuan") },
  handler: async (ctx, args) => {
    const bahan = await ctx.runQuery(internal.bap.bahanGenerate, {
      pertemuanId: args.pertemuanId,
    });

    const klaim = await ctx.runMutation(internal.bap.klaimInternal, {
      token: args.token,
      pertemuanId: args.pertemuanId,
      revision: bahan.pertemuan.revision,
    });

    if (klaim.status === "READY") {
      const doc = await ctx.runQuery(internal.bap.docById, { id: klaim.id });
      return { status: "READY", url: doc.url, sha256: doc.sha256, revision: bahan.pertemuan.revision };
    }
    if (klaim.status === "BUSY") {
      return { status: "BUSY" };
    }

    try {
      const template = Buffer.from(TEMPLATE_BASE64, "base64");
      const buf = Buffer.from(
        await renderBap(template, {
          mataKuliah: MATA_KULIAH,
          semester: SEMESTER,
          tahunAkademik: TAHUN_AKADEMIK,
          hariTanggal: hariTanggal(bahan.pertemuan.tanggal),
          tempat: bahan.pertemuan.tempat,
          semGol: SEM_GOL,
          absen: bahan.absen,
        })
      );
      const sha256 = createHash("sha256").update(buf).digest("hex");
      const storageId = await ctx.storage.store(
        new Blob([buf], {
          // Blob tanpa type -> header content-type invalid -> upload ditolak.
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      );
      await ctx.runMutation(internal.bap.selesai, { id: klaim.id, storageId, sha256 });
      const url = await ctx.storage.getUrl(storageId);
      return { status: "READY", url, sha256, revision: bahan.pertemuan.revision };
    } catch (err) {
      await ctx.runMutation(internal.bap.gagal, {
        id: klaim.id,
        pesan: err instanceof Error ? err.message : String(err),
      });
      throw new ConvexError("GENERATE_GAGAL");
    }
  },
});
