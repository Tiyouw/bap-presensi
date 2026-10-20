import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { renderBap } from "../bap-shared/bapRender.js";
import { renderPrintPack } from "../bap-shared/printRender.js";
import { renderPdf } from "../bap-shared/pdfRender.js";
import { DEFAULT_TEMPLATE } from "../bap-shared/management.js";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { FONT_REGULAR } from "../bap-shared/assets/fonts.js";
const font = fontkit.create(Buffer.from(FONT_REGULAR, "base64"));
assert.equal(font.familyName, "Tinos");
const labelWidth = font.layout("Semester / Golongan").glyphs.reduce((n, g) => n + g.advanceWidth, 0) * 12 / font.unitsPerEm;
assert.ok(labelWidth <= 116, "Source identity label must fit at 12pt without wrapping");
const out = "out/management/documents";
mkdirSync(out, { recursive: true });
const template = readFileSync("templates/bap-template.docx"),
  results = [];
function input(count, long = false) {
  return {
    mataKuliah: long
      ? "Pengembangan Destinasi Pariwisata Berkelanjutan dan Pengelolaan Kebudayaan Masyarakat"
      : "Pengantar Pariwisata Budaya",
    semester: "GASAL",
    tahunAkademik: "2026/2027",
    hariTanggal: "Senin / 5 Oktober 2026",
    tempat: "Laboratorium F6",
    semGol: "3 / A, B, C, D",
    absen: Array.from({ length: count }, (_, i) => ({
      nama: long
        ? `Éléonore María Nur Cahyaningrum Prameswari Demo ${i + 1}`
        : `Nama Demo ${i + 1}`,
      gol: "A",
      ket: "I",
    })),
    documentMeta: {
      ...DEFAULT_TEMPLATE,
      prodi: "PROGRAM STUDI DESTINASI PARIWISATA",
      dosen: long
        ? "Dr. Éléonore Nur Prameswari Demo, S.Hum., M.Hum., Ph.D."
        : "Dosen Demo",
      asdos: "Asdos Demo",
    },
  };
}
for (const count of [0, 12, 13, 25, 93])
  for (const mode of ["single", "pack"]) {
    const inputs =
        mode === "single" ? [input(count)] : [input(count), input(0)],
      forms = inputs.reduce(
        (n, v) => n + Math.max(1, Math.ceil(v.absen.length / 12)),
        0,
      );
    const pdf = await renderPdf(inputs, { twoPerPage: mode === "pack" }),
      docx =
        mode === "single"
          ? await renderBap(template, inputs[0])
          : await renderPrintPack(template, inputs);
    const name = `${mode}-${count}`;
    writeFileSync(`${out}/${name}.pdf`, pdf.bytes);
    writeFileSync(`${out}/${name}.docx`, docx);
    const pages = (await PDFDocument.load(pdf.bytes)).getPageCount();
    assert.equal(pages, mode === "single" ? forms : Math.ceil(forms / 2));
    results.push({ name, forms, pdfPages: pages });
  }
const extended = [input(13, true), input(0, true)];
extended[0].documentMeta.logo = `data:image/png;base64,${readFileSync("scripts/ui/logo-wide-demo.png").toString("base64")}`;
extended[0].documentMeta.unit =
  "POLITEKNIK DEMO PENGEMBANGAN KEBUDAYAAN DAN PARIWISATA BERKELANJUTAN";
const long = await renderPdf(extended, { twoPerPage: true });
writeFileSync(`${out}/long.pdf`, long.bytes);
writeFileSync(`${out}/long.docx`, await renderPrintPack(template, extended));
results.push({ name: "long", forms: 3, pdfPages: long.pageCount });
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log("Document fixtures validated:", results);
