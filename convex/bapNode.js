"use node";
import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v, ConvexError } from "convex/values";
import { createHash } from "node:crypto";
import { renderBap } from "../bap-shared/bapRender.js";
import { renderPrintPack } from "../bap-shared/printRender.js";
import { renderPdf } from "../bap-shared/pdfRender.js";
import { hariTanggal } from "./lib/auth.js";
import { TEMPLATE_BASE64 } from "./lib/templateData.js";
import { documentUrl } from "./lib/documentUrl.js";
import { documentMeta, staffName } from "../bap-shared/documentFormat.js";
const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};
export function documentInput(data) {
  const s = data.snapshot,
    c = s.kelas,
    t = documentMeta(s.template);
  return {
    mataKuliah: c.matkulNama,
    semester: c.semester,
    tahunAkademik: c.tahunAkademik,
    hariTanggal: hariTanggal(s.tanggal),
    tempat: s.tempat,
    semGol: `${c.tingkat} / ${[...new Set(s.peserta.map((p) => p.golongan))].join(", ") || "—"}`,
    absen: data.absen,
    documentMeta: {
      ...t,
      prodi: `PROGRAM STUDI ${c.prodi.toUpperCase()}`,
      dosen: staffName(t.labelDosen, c.dosen, c.dosenId),
      asdos: staffName(t.labelAsdos, c.asdos, c.asdosId),
    },
  };
}
async function render(inputs, format, pack) {
  if (!MIME[format]) throw new ConvexError("FORMAT_TIDAK_VALID");
  if (format === "pdf") return renderPdf(inputs, { twoPerPage: pack });
  return {
    bytes: pack
      ? await renderPrintPack(Buffer.from(TEMPLATE_BASE64, "base64"), inputs)
      : await renderBap(Buffer.from(TEMPLATE_BASE64, "base64"), inputs[0]),
  };
}
export const generate = action({
  args: {
    token: v.string(),
    pertemuanId: v.id("pertemuan"),
    format: v.optional(v.string()),
    expectedRevision: v.optional(v.number()),
    revisionId:v.optional(v.id("meetingRevision")),
  },
  handler: async (ctx, a) => {
    const format = a.format || "docx";
    if (!MIME[format]) throw new ConvexError("FORMAT_TIDAK_VALID");
    const data = await ctx.runQuery(internal.bap.bahanGenerate, {
        token: a.token,
        pertemuanId: a.pertemuanId,
        ...(a.revisionId?{revisionId:a.revisionId}:{}),
      }),
      revision = data.pertemuan.revision;
    if(a.expectedRevision!==undefined&&a.expectedRevision!==revision)throw new ConvexError("KONFLIK_REVISI");
    const claim = await ctx.runMutation(internal.bap.klaimInternal, {
      token: a.token,
      pertemuanId: a.pertemuanId,
      revision,
      format,
      ...(a.revisionId?{revisionId:a.revisionId}:{}),
    });
    if (claim.status === "BUSY") return { status: "BUSY" };
    if (claim.status === "READY")
      return {
        status: "READY",
        revision,
        ...(await ctx.runQuery(internal.bap.docById, {
          token: a.token,
          id: claim.id,
        })),
      };
    try {
      const { bytes, pageCount } = await render(
          [documentInput(data)],
          format,
          false,
        ),
        buf = Buffer.from(bytes),
        sha256 = createHash("sha256").update(buf).digest("hex");
      const storageId = await ctx.storage.store(
        new Blob([buf], { type: MIME[format] }),
      );
      const finalized = await ctx.runMutation(internal.bap.selesai, {
        id: claim.id,
        attempt: claim.attempt,
        storageId,
        sha256,
      });
      if (!finalized.accepted) {
        await ctx.storage.delete(storageId);
        return { status: "BUSY" };
      }
      return {
        status: "READY",
        revision,
        url: documentUrl(claim.id),
        sha256,
        ...(pageCount ? { pageCount } : {}),
      };
    } catch (e) {
      await ctx.runMutation(internal.bap.gagal, {
        id: claim.id,
        attempt: claim.attempt,
        pesan: e.message || "Gagal render",
      });
      throw new ConvexError({ code: "GENERATE_GAGAL", message: e.message });
    }
  },
});
export const paketCetak = action({
  args: {
    token: v.string(),
    kelasId: v.id("kelas"),
    format: v.optional(v.string()),
    items: v.array(
      v.object({ pertemuanId: v.id("pertemuan"), revision: v.number(),revisionId:v.optional(v.id("meetingRevision")) }),
    ),
  },
  handler: async (ctx, a) => {
    const format = a.format || "docx",
      { format: _, ...queryArgs } = a,
      data = await ctx.runQuery(internal.bap.bahanPaket, queryArgs);
    const result = await render(data.map(documentInput), format, true),
      buf = Buffer.from(result.bytes),
      c = data[0].snapshot.kelas;
    return {
      base64: buf.toString("base64"),
      fileName: `BAP_${c.matkulKode}_P${data.map((d) => String(d.pertemuan.nomor).padStart(2, "0")).join("-")}_2-form-folio.${format}`,
      sha256: createHash("sha256").update(buf).digest("hex"),
      revisions: data.map((d) => ({
        nomor: d.pertemuan.nomor,
        revision: d.pertemuan.revision,
      })),
      ...(result.pageCount ? { pageCount: result.pageCount } : {}),
    };
  },
});
export const preview = action({
  args: { token: v.string(), kelasId: v.id("kelas") },
  handler: async (ctx, a) => {
    const data = await ctx.runQuery(internal.bap.previewData, a),
      r = await render([documentInput(data)], "pdf", false);
    return {
      base64: Buffer.from(r.bytes).toString("base64"),
      pageCount: r.pageCount,
    };
  },
});
