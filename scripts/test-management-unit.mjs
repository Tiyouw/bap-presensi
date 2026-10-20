import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { prefixSpreadsheetParts } from "./xlsx-fixture.mjs";
import { normalizeXlsxNamespaces } from "../src/lib/xlsxNamespaces.js";
import {
  normalizeRoster,
  previewRoster,
  weeklySchedule,
  validateTemplate,
  DEFAULT_TEMPLATE,
} from "../bap-shared/management.js";
import {
  parseCsv,
  readRosterFile,
  suggestMapping,
} from "../src/lib/importRoster.js";
import { initialize } from "../convex/migrate.js";
import { buatCtx } from "./test-context.mjs";
assert.equal(weeklySchedule("2026-10-20", 16)[0].tipe, "TEORI");
assert.equal(weeklySchedule("2026-10-20", 3, "REGULER")[0].tipe, "REGULER");
assert.throws(() => weeklySchedule("2026-02-30"));
assert.throws(
  () =>
    normalizeRoster([
      { nim: "x", nama: "A" },
      { nim: "X", nama: "B" },
    ]),
  /duplikat/,
);
assert.equal(
  normalizeRoster([{ nim: "00012", nama: " Éléonore ", golongan: "Sore" }])[0]
    .nim,
  "00012",
);
assert.deepEqual(
  parseCsv(
    '\uFEFFNIM;Nama;Golongan\r\n00012;"Nama; dengan tanda";X\r\n00013;"Dua\nbaris";Y',
  )[1],
  ["00012", "Nama; dengan tanda", "X"],
);
assert.throws(() => parseCsv('a,b\n"notclosed'), /kutip/);
const wb = new ExcelJS.Workbook(),
  sheet = wb.addWorksheet("Kelas");
sheet.addRow(["NIM", "Nama", "Golongan"]);
const row = sheet.addRow([12, "Alya Demo", "X"]);
row.getCell(1).numFmt = "00000";
wb.addWorksheet("Kosong");
const tables = await readRosterFile(
  new File([await wb.xlsx.writeBuffer()], "uji.xlsx"),
);
assert.equal(tables.length, 2);
assert.equal(tables[0].rows[0]["0"], "00012");
const mapping = suggestMapping(tables[0].headers),
  preview = previewRoster(tables[0].rows, mapping, [
    { nim: "00012", nama: "Alya Lama", golongan: "X" },
  ]);
assert.equal(preview[0].action, "Perbarui");
// Valid namespace aliases must not make XLSX files fail or silently lose rows.
const literalName = "Nama x:literal & <x:tag> Demo";
sheet.addRow(["00013", literalName, "Pagi"]);
const plain = await wb.xlsx.writeBuffer();
assert.equal(await normalizeXlsxNamespaces(plain), plain, "Canonical files are not rewritten");
for (const [prefix, worksheetOnly] of [["x", false], ["ss", false], ["s0", true]]) {
  const bytes = await prefixSpreadsheetParts(plain, prefix, { worksheetOnly });
  const decoded = await readRosterFile(new File([bytes], "prefixed.xlsx"));
  assert.equal(decoded.length, 2);
  assert.equal(decoded[0].rows.length, 2);
  assert.equal(decoded[0].rows[0]["0"], "00012");
  assert.equal(decoded[0].rows[1]["0"], "00013");
  assert.equal(decoded[0].rows[1]["1"], literalName, "Literal XML-looking text is not edited");
  assert.equal(decoded[0].rows[1]["2"], "Pagi");
}
const extensionZip = await JSZip.loadAsync(await prefixSpreadsheetParts(plain));
let extensionXml = await extensionZip.file("xl/worksheets/sheet1.xml").async("string");
extensionXml = extensionXml.replace("<x:worksheet ", '<x:worksheet xmlns:demo="urn:bap:demo" ')
  .replace("</x:worksheet>", '<x:extLst><x:ext uri="demo"><demo:note demo:value="x:keep">x:literal</demo:note></x:ext></x:extLst></x:worksheet>');
extensionZip.file("xl/worksheets/sheet1.xml", extensionXml);
const kept = await JSZip.loadAsync(await normalizeXlsxNamespaces(await extensionZip.generateAsync({type:"uint8array"})));
const extensionDoc = new DOMParser().parseFromString(await kept.file("xl/worksheets/sheet1.xml").async("string"),"text/xml");
const note = extensionDoc.getElementsByTagNameNS("urn:bap:demo","note")[0];
assert.equal(note.textContent, "x:literal");
assert.equal(note.getAttributeNS("urn:bap:demo","value"), "x:keep");
await assert.rejects(() => readRosterFile(new File(["broken"],"broken.xlsx")), /File Excel tidak dapat dibaca/);
const malformed = await JSZip.loadAsync(plain);
malformed.file("xl/workbook.xml", '<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheet></x:workbook>');
const malformedBytes = await malformed.generateAsync({type:"uint8array"});
await assert.rejects(() => readRosterFile(new File([malformedBytes],"malformed.xlsx")), /File Excel tidak dapat dibaca/);
assert.throws(() =>
  validateTemplate({
    ...DEFAULT_TEMPLATE,
    logo: "data:image/svg+xml;base64,eA==",
  }),
);
// Legacy migration preserves identity, revisions, files and historical status, and runs twice safely.
const ctx = buatCtx(),
  student = await ctx.db.insert("peserta", {
    nim: "DEMO00001",
    nama: "Nama Demo",
    golongan: "A",
    urut: 1,
  });
const p = await ctx.db.insert("pertemuan", {
  nomor: 2,
  tanggal: "2026-09-07",
  tipe: "REGULER",
  tempat: "F6",
  status: "KUNCI",
  revision: 3,
});
const week1 = await ctx.db.insert("pertemuan", {
  nomor: 1,
  tanggal: "2026-08-31",
  tipe: "REGULER",
  tempat: "F6",
  status: "TERBUKA",
  revision: 0,
});
const attendance = await ctx.db.insert("presensi", {
  pertemuanId: p,
  pesertaId: student,
  status: "IZIN",
});
const document = await ctx.db.insert("bapDoc", {
  pertemuanId: p,
  revision: 3,
  templateVersion: "legacy-v1",
  storageId: "storage:demo",
  sha256: "unchanged-hash",
  status: "READY",
});
await ctx.db.insert("sesi", { token: "old-shared-session" });
const users = ["tiyouw", "marchaenta"].map((username) => ({
  username,
  nama: username,
  passwordHash: "scrypt:32768:8:3:synthetic:test",
  recoveryHashes: [],
}));
assert.equal(
  (await initialize._handler(ctx, { demo: false, users })).skipped,
  false,
);
assert.equal(
  (await initialize._handler(ctx, { demo: false, users })).skipped,
  true,
);
assert.equal((await ctx.db.query("pengguna").collect()).length, 2);
assert.equal((await ctx.db.query("sesi").collect()).length, 0);
assert.equal((await ctx.db.get(week1)).tipe, "TEORI");
assert.equal((await ctx.db.get(p)).revision, 3);
assert.equal((await ctx.db.get(p)).snapshot.peserta[0].id, student);
assert.equal((await ctx.db.get(attendance)).status, "IZIN");
assert.equal((await ctx.db.get(document)).sha256, "unchanged-hash");
assert.equal((await ctx.db.get(document)).storageId, "storage:demo");
console.log(
  "Management unit: CSV/XLSX adapter, mapping, duplicate/update validation, custom schedules and idempotent legacy migration passed.",
);
