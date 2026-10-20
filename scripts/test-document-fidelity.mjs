import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { documentMeta, staffName } from "../bap-shared/documentFormat.js";
import { DEFAULT_TEMPLATE, validateTemplate } from "../bap-shared/management.js";
import { renderPrintPack } from "../bap-shared/printRender.js";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
assert.equal(staffName("", "Dosen Contoh"), "Dosen Contoh");
assert.equal(staffName("Pembimbing", "Dosen Contoh", "DEMO-ID"), "Pembimbing: Dosen Contoh (DEMO-ID)");
const old = { institusi: "Institusi Contoh", labelDosen: "Pengampu" };
assert.equal(documentMeta(old).jurusan, DEFAULT_TEMPLATE.jurusan);
assert.equal(documentMeta(old).labelDosen, "Pengampu");
assert.deepEqual(old, { institusi: "Institusi Contoh", labelDosen: "Pengampu" });
assert.equal(documentMeta({jurusan: "", kontak: ""}).jurusan, "");
assert.equal(validateTemplate({...DEFAULT_TEMPLATE, jurusan: "", kontak: "", labelDosen: ""}).kontak, "");
const input = {
  mataKuliah: "Matkul Contoh", semester: "GASAL", tahunAkademik: "2026/2027",
  hariTanggal: "Senin / 5 Oktober 2026", tempat: "F6", semGol: "3 / A, B, C, D", absen: [],
  documentMeta: { ...DEFAULT_TEMPLATE, prodi: "PROGRAM STUDI CONTOH", dosen: "Dosen Contoh", asdos: "Asdos Contoh" },
};
const bytes = await renderPrintPack(readFileSync("templates/bap-template.docx"), [input, input]);
const zip = await JSZip.loadAsync(bytes);
const xml = await zip.file("word/document.xml").async("string");
const doc = new DOMParser().parseFromString(xml, "text/xml");
const texts = Array.from(doc.getElementsByTagNameNS(W,"t")).map(n => n.textContent).join("\n");
for (const key of ["institusi","unit","jurusan","alamat","kontak"])
  assert.equal(texts.split(DEFAULT_TEMPLATE[key]).length - 1, 2, `Both forms retain ${key}`);
assert.equal(texts.split("PROGRAM STUDI CONTOH").length - 1, 2);
assert.equal(texts.split("Nama Dosen / Teknisi Pembimbing").length - 1, 2);
assert.equal(texts.split("Dosen Contoh").length - 1, 2);
assert.ok(!texts.includes("Dosen pengampu:"));
assert.ok(!texts.includes("+++"));
const extents = Array.from(doc.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "extent"));
assert.equal(extents.length, 2);
for(const e of extents) {
  assert.ok(Number(e.getAttribute("cx")) > 960000, "Official logo width must not shrink to 2cm");
  assert.ok(Number(e.getAttribute("cy")) >= 970000);
}
const tables = Array.from(doc.getElementsByTagNameNS(W, "tbl"));
for (const table of tables.filter(t => t.getElementsByTagNameNS(W,"tblGrid")[0]?.getElementsByTagNameNS(W,"gridCol").length === 8)) {
  const rows = Array.from(table.getElementsByTagNameNS(W,"tr")).slice(1);
  for (const row of rows) {
    const cells = row.getElementsByTagNameNS(W,"tc");
    for (const index of [1,5]) {
      assert.equal(cells[index].getElementsByTagNameNS(W,"jc")[0]?.getAttribute("w:val"), "left");
      assert.equal(cells[index].getElementsByTagNameNS(W,"rFonts")[0]?.getAttribute("w:ascii"), "Times New Roman");
    }
  }
}
console.log("Official form fidelity: complete kop, separate programme/department, logo bounds, original staff heading, optional labels, legacy metadata and immutable input passed.");
