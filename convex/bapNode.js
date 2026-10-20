"use node";

import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { createHash } from "node:crypto";

import { renderBap } from "../bap-shared/bapRender.js";
import { hariTanggal } from "./lib/auth.js";
import { TEMPLATE_BASE64 } from "./lib/templateData.js";
import { renderPrintPack } from "../bap-shared/printRender.js";

/** Download-only package: no new attendance, BAP archive, or orphan storage files. */
export const paketCetak = action({
  args: {
    token: v.string(),
    items: v.array(
      v.object({ pertemuanId: v.id("pertemuan"), revision: v.number() }),
    ),
  },
  handler: async (ctx, args) => {
    const snapshot = await ctx.runQuery(internal.bap.bahanPaket, args);
    const inputs = snapshot.map((bahan) => ({
      mataKuliah: MATA_KULIAH,
      semester: SEMESTER,
      tahunAkademik: TAHUN_AKADEMIK,
      hariTanggal: hariTanggal(bahan.pertemuan.tanggal),
      tempat: bahan.pertemuan.tempat,
      semGol: SEM_GOL,
      absen: bahan.absen,
    }));
    try {
      const buf = Buffer.from(
        await renderPrintPack(Buffer.from(TEMPLATE_BASE64, "base64"), inputs),
      );
      const nomor = snapshot
        .map((b) => String(b.pertemuan.nomor).padStart(2, "0"))
        .join("-");
      return {
        base64: buf.toString("base64"),
        fileName: `BAP_PPB_P${nomor}_2-form-folio.docx`,
        sha256: createHash("sha256").update(buf).digest("hex"),
        revisions: snapshot.map((b) => ({
          nomor: b.pertemuan.nomor,
          revision: b.pertemuan.revision,
        })),
      };
    } catch {
      throw new ConvexError("PAKET_GAGAL");
    }
  },
});

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
      return {
        status: "READY",
        url: doc.url,
        sha256: doc.sha256,
        revision: bahan.pertemuan.revision,
      };
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
        }),
      );
      const sha256 = createHash("sha256").update(buf).digest("hex");
      const storageId = await ctx.storage.store(
        new Blob([buf], {
          // Blob tanpa type -> header content-type invalid -> upload ditolak.
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
      await ctx.runMutation(internal.bap.selesai, {
        id: klaim.id,
        storageId,
        sha256,
      });
      const url = await ctx.storage.getUrl(storageId);
      return {
        status: "READY",
        url,
        sha256,
        revision: bahan.pertemuan.revision,
      };
    } catch (err) {
      await ctx.runMutation(internal.bap.gagal, {
        id: klaim.id,
        pesan: err instanceof Error ? err.message : String(err),
      });
      throw new ConvexError("GENERATE_GAGAL");
    }
  },
});
