/** Source adapters return the same string-valued table, ready for mapping/preview.
 * A future Google Sheets adapter must return this shape; commit is source-agnostic.
 */
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0],
    delimiter = [",", ";", "\t"].sort(
      (a, b) => first.split(b).length - first.split(a).length,
    )[0];
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((s) => s.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Tanda kutip CSV belum ditutup.");
  row.push(cell);
  if (row.some((s) => s.trim())) rows.push(row);
  return rows;
}
function sheetData(name, table) {
  const header = (table[0] || []).map((label, i) => ({
    key: String(i),
    label: String(label || `Kolom ${i + 1}`),
  }));
  return {
    name,
    headers: header,
    rows: table
      .slice(1)
      .map((row) =>
        Object.fromEntries(
          header.map((h) => [h.key, String(row[+h.key] ?? "")]),
        ),
      )
      .filter((r) => Object.values(r).some((s) => s.trim())),
  };
}
export async function readRosterFile(file) {
  if (file.size > 5 * 1024 * 1024) throw Error("Ukuran file maksimum 5 MB.");
  if (/\.csv$/i.test(file.name))
    return [sheetData(file.name, parseCsv(await file.text()))];
  if (/\.xls$/i.test(file.name)) {
    const { read, utils } = await import("xlsx");
    const workbook = read(await file.arrayBuffer(), { type: "array", cellFormula: false, sheetRows: 10002 });
    return workbook.SheetNames.map(name => {
      const table = utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: "" });
      if (table.length > 10001) throw Error("Maksimum 10.000 mahasiswa per file XLS. Pisahkan file agar seluruh data dapat diperiksa.");
      return sheetData(name, table);
    });
  }
  if (!/\.xlsx$/i.test(file.name)) throw Error("Gunakan file .xlsx, .xls atau .csv.");
  const [{ default: ExcelJS }, { normalizeXlsxNamespaces }] = await Promise.all([
      import("exceljs"), import("./xlsxNamespaces.js"),
    ]),
    workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await normalizeXlsxNamespaces(await file.arrayBuffer()));
  return workbook.worksheets.map((sheet) => {
    const table = [];
    sheet.eachRow({ includeEmpty: false }, (r) => {
      const values = [];
      r.eachCell({ includeEmpty: true }, (cell, col) => {
        let value = cell.text || "";
        if (typeof cell.value === "number" && /^0+$/.test(cell.numFmt || ""))
          value = String(cell.value).padStart(cell.numFmt.length, "0");
        values[col - 1] = value;
      });
      table.push(values);
    });
    return sheetData(sheet.name, table);
  });
}
export function suggestMapping(headers) {
  const find = (re) => headers.find((h) => re.test(h.label))?.key || "";
  return {
    nim: find(/nim|nomor.induk|student.id/i),
    nama: find(/nama|name/i),
    golongan: find(/golongan|gol\b|group/i),
  };
}
