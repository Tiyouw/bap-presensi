import assert from "node:assert/strict";
import { fixture } from "./revision-fixture.mjs";
import { previewData } from "../convex/bap.js";
import { hashToken } from "../convex/lib/auth.js";
import { CONTROL_FLAG } from "../convex/lib/revisionLedger.js";
import { readRosterFile } from "../src/lib/importRoster.js";
import { utils, write } from "xlsx";
const f = await fixture(),
  { ctx, token, kelasId } = f;
await ctx.db.insert("featureFlag", {
  key: CONTROL_FLAG,
  enabled: true,
  everEnabled: true,
});
const before = JSON.stringify([...ctx.tabel].map(([k, v]) => [k, [...v]])),
  config = {
    ...(await ctx.db.get(kelasId)).templateDraft,
    unit: "PRATINJAU TANPA SIMPAN",
  };
const preview = await previewData._handler(ctx, { token, kelasId, config });
assert.equal(preview.snapshot.template.unit, config.unit);
assert.equal(preview.snapshot.tanggal, "2026-10-21");
assert.equal(
  (await ctx.db.get(kelasId)).templateDraft.unit,
  "POLITEKNIK NEGERI JEMBER",
);
assert.equal(
  JSON.stringify([...ctx.tabel].map(([k, v]) => [k, [...v]])),
  before,
);
await assert.rejects(() =>
  previewData._handler(ctx, {
    token,
    kelasId,
    config: { ...config, unit: "" },
  }),
);
await ctx.db.delete(f.pertemuanId);
const emptyScheduleState = JSON.stringify([...ctx.tabel].map(([k,v])=>[k,[...v]]));
const blankPreview = await previewData._handler(ctx, {token,kelasId,config});
assert.match(blankPreview.snapshot.tanggal, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(JSON.stringify([...ctx.tabel].map(([k,v])=>[k,[...v]])), emptyScheduleState);
const user = await ctx.db.insert("pengguna", {
  peran: "OPERATOR",
  nama: "Operator Demo",
  aktif: true,
  kelasIds: [],
  wajibGanti: false,
});
const denied = "preview-synthetic-denied";
await ctx.db.insert("sesi", {
  token: await hashToken(denied),
  penggunaId: user,
  kedaluwarsaPada: Date.now() + 3600000,
});
await assert.rejects(() =>
  previewData._handler(ctx, { token: denied, kelasId, config }),
);
const workbook = utils.book_new();
utils.book_append_sheet(
  workbook,
  utils.aoa_to_sheet([
    ["NIM", "Nama", "Golongan"],
    ["00001", "Mahasiswa XLS Demo", "A"],
  ]),
  "Data",
);
const bytes = write(workbook, { type: "buffer", bookType: "biff8" }),
  file = {
    name: "demo.xls",
    size: bytes.length,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  };
const result = await readRosterFile(file);
assert.equal(result[0].rows[0]["0"], "00001");
assert.equal(result[0].rows[0]["1"], "Mahasiswa XLS Demo");
console.log(
  "Setup: preview is read-only, rejects invalid/unauthorized config, and XLS import preserves leading zeros.",
);
