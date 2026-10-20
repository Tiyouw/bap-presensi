import ExcelJS from "exceljs";
import JSZip from "jszip";
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

// Independent XML fixture transform: prefixes markup tags, never cell text.
export async function prefixSpreadsheetParts(bytes, prefix = "x", { worksheetOnly = false } = {}) {
  const zip = await JSZip.loadAsync(bytes);
  const parts = zip.file(/^xl\/(?:workbook|styles|sharedStrings|worksheets\/[^/]+)\.xml$/);
  for (const part of parts) {
    if (worksheetOnly && !part.name.startsWith("xl/worksheets/")) continue;
    let xml = await part.async("string");
    xml = xml.replace(`xmlns="${MAIN}"`, `xmlns="${MAIN}" xmlns:${prefix}="${MAIN}"`);
    xml = xml.replace(/<(\/?)([A-Za-z][A-Za-z0-9_.-]*)(?=[\s/>])/g,
      (_, slash, name) => `<${slash}${prefix}:${name}`);
    zip.file(part.name, xml);
  }
  return zip.generateAsync({ type: "uint8array" });
}

export async function prefixedRosterFile() {
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Mahasiswa");
  sheet.addRows([
    ["NIM", "Nama", "Golongan"],
    ["00001", "Alya Demo", "X"],
    ["00002", "Bima Demo", "Y"],
    [3, "Citra Demo", "X"],
  ]);
  sheet.getCell("A4").numFmt = "00000";
  return prefixSpreadsheetParts(await workbook.xlsx.writeBuffer(), "x");
}
