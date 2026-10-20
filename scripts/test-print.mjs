import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { buildPrintData, renderPrintPack } from "../bap-shared/printRender.js";
import { susunPaket } from "../bap-shared/printPlan.js";

const make = (n, date) => ({
  mataKuliah: "Pengantar Pariwisata Budaya",
  semester: "GASAL",
  tahunAkademik: "2026/2027",
  hariTanggal: date,
  tempat: "F6",
  semGol: "3 / A, B, C, D",
  absen: Array.from({ length: n }, (_, i) => ({
    nama: `Nama Contoh ${i + 1}`,
    gol: "A",
    ket: "S",
  })),
});
const template = readFileSync(
  new URL("../templates/bap-template.docx", import.meta.url),
);
const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
for (const count of [0, 12, 13, 25, 93]) {
  const inputs = [
    make(count, "Senin / 31 Agustus 2026"),
    make(0, "Senin / 7 September 2026"),
  ];
  const data = buildPrintData(inputs);
  const expected = Math.max(1, Math.ceil(count / 12)) + 1;
  assert.equal(data.forms.length, expected);
  assert.equal(
    data.forms.filter((f) => f.pageBreak).length,
    Math.ceil(expected / 2) - 1,
  );
  assert.equal(data.forms.at(-1).pageBreak, false);
  assert.equal(data.forms.at(-1).hariTanggal, inputs[1].hariTanggal);
  if (count > 12) assert.equal(data.forms[1].baris[0].no, "13.");
  const zip = await JSZip.loadAsync(await renderPrintPack(template, inputs));
  const xml = await zip.file("word/document.xml").async("string");
  assert.ok(!xml.includes("+++"), "no template placeholders remain");
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const text = Array.from(doc.getElementsByTagNameNS(ns, "t"))
    .map((t) => t.textContent)
    .join(" ");
  assert.equal((text.match(/DAFTAR HADIR PEMBIMBING/g) || []).length, expected);
  assert.equal((text.match(/Nama Contoh/g) || []).length, count);
  assert.equal(
    doc.getElementsByTagNameNS(ns, "pageBreakBefore").length,
    Math.ceil(expected / 2) - 1,
  );
  assert.equal(Array.from(doc.getElementsByTagNameNS(ns, "br")).filter(
    el => el.getAttribute("w:type") === "page").length, 0,
    "Pack separators must use pageBreakBefore to avoid overflowing break characters");
  assert.ok(doc.getElementsByTagNameNS(ns, "cantSplit").length > 0);
  assert.ok(
    zip.file("word/_rels/document.xml.rels"),
    "official logo relationships retained",
  );
  console.log(
    `  OK paket ${count} + 0 absen: ${expected} form, metadata, nomor, page breaks, dan penjagaan form`,
  );
}
const plan = susunPaket([
  { id: "p3", nomor: 3, jumlahAbsen: 0 },
  { id: "p1", nomor: 1, jumlahAbsen: 13 },
]);
assert.deepEqual(
  plan.map((sheet) => sheet.map((p) => [p.nomor, p.formKe])),
  [
    [
      [1, 1],
      [1, 2],
    ],
    [[3, 1]],
  ],
);
console.log("Print planning and DOCX structure checks passed.");
