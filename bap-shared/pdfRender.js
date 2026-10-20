import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { FONT_REGULAR, FONT_BOLD } from "./assets/fonts.js";
import { DEFAULT_LOGO } from "./assets/logo.js";
import { buildBapData } from "./bapRender.js";
const MM = 72 / 25.4,
  WIDTH = 215 * MM,
  HEIGHT = 330 * MM,
  MARGIN = 22,
  GAP = 14;
const BLACK = rgb(0, 0, 0);
export function wrapText(value, font, size, width) {
  const lines = [];
  for (const paragraph of String(value || "").split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if (font.widthOfTextAtSize(word, size) > width) {
        if (line) {
          lines.push(line);
          line = "";
        }
        for (const char of word) {
          if (line && font.widthOfTextAtSize(line + char, size) > width) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      } else if (
        line &&
        font.widthOfTextAtSize(`${line} ${word}`, size) > width
      ) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}
/** PDF uses measured rows and embeds licensed Unicode serif fonts. Never clips/shrinks a form. */
export async function renderPdf(inputs, { twoPerPage = false } = {}) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setProducer("BAP Praktikum Management");
  const regular = await doc.embedFont(Buffer.from(FONT_REGULAR, "base64"), {
      subset: false,
    }),
    bold = await doc.embedFont(Buffer.from(FONT_BOLD, "base64"), {
      subset: false,
    });
  const width = WIDTH - MARGIN * 2,
    forms = inputs.flatMap((input) =>
      buildBapData(input).forms.map((f) => ({ ...f, input })),
    );
  let page = null,
    used = 0,
    slots = 0;
  for (const form of forms) {
    const input = form.input,
      meta = input.documentMeta;
    const ops = [];
    let y = 0;
    const txt = (
      value,
      x,
      top,
      w,
      size = 11,
      isBold = false,
      align = "left",
    ) => {
      const font = isBold ? bold : regular,
        lines = wrapText(value, font, size, w),
        lineHeight = size * 1.2;
      for (const [i, line] of lines.entries())
        ops.push({
          kind: "text",
          line,
          x:
            x +
            (align === "center"
              ? (w - font.widthOfTextAtSize(line, size)) / 2
              : 0),
          y: top + i * lineHeight,
          size,
          font,
        });
      return lines.length * lineHeight;
    };
    let header = 0;
    for (const [value, size, strong] of [
      [meta.institusi, 9, true],
      [meta.unit, 12, true],
      [meta.prodi, 10, true],
      [meta.alamat, 8, false],
    ])
      header += txt(value, 70, header, width - 70, size, strong, "center") + 2;
    ops.push({
      kind: "logo",
      x: 4,
      y: 0,
      w: 55,
      h: 55,
      value: meta.logo || DEFAULT_LOGO,
    });
    y = Math.max(60, header) + 5;
    ops.push({ kind: "line", x: 0, y, w: width });
    y += 8;
    y +=
      txt(`${meta.judul}\n${form.judul}`, 0, y, width, 10, true, "center") + 7;
    for (const [label, value] of [
      ["Mata kuliah", input.mataKuliah],
      ["Hari / tanggal", input.hariTanggal],
      ["Tempat", input.tempat],
      ["Semester / golongan", input.semGol],
    ]) {
      const h = txt(value, 124, y, width - 124, 11);
      txt(label + " :", 0, y, 120, 11);
      y += Math.max(14, h) + 1;
    }
    y += 5;
    function table(rows, widths, headerRows = 1) {
      for (const [index, row] of rows.entries()) {
        const top = y,
          heights = row.map(
            (cell, i) =>
              wrapText(
                cell,
                index < headerRows ? bold : regular,
                11,
                widths[i] - 8,
              ).length *
                13.2 +
              6,
          ),
          height = Math.max(19, ...heights);
        let x = 0;
        for (const [i, cell] of row.entries()) {
          ops.push({ kind: "rect", x, y: top, w: widths[i], h: height });
          txt(cell, x + 4, top + 3, widths[i] - 8, 11, index < headerRows);
          x += widths[i];
        }
        y += height;
      }
    }
    table(
      [
        ["No", "Nama dosen / pembimbing", "Tanda tangan"],
        ["1.", meta.dosen, "1. ................"],
        ["2.", meta.asdos, "2. ................"],
      ],
      [26, width - 136, 110],
    );
    y += 7;
    y+=txt("Mahasiswa yang tidak hadir",0,y,width,10)+3;
    const half = width / 2,
      cols = [26, half - 90, 32, 32, 26, half - 90, 32, 32];
    table(
      [
        ["No", "Nama", "Gol.", "Ket.", "No", "Nama", "Gol.", "Ket."],
        ...form.baris.map((r) => [
          r.no,
          r.nama,
          r.gol,
          r.ket,
          r.rno,
          r.rnama,
          r.rgol,
          r.rket,
        ]),
      ],
      cols,
    );
    const height = y + 7;
    if (height > HEIGHT - MARGIN * 2)
      throw Error(
        "Konten form terlalu panjang. Pendekkan teks kop/identitas dan periksa preview.",
      );
    if (
      !page ||
      !twoPerPage ||
      slots >= 2 ||
      used + height > HEIGHT - MARGIN * 2
    ) {
      page = doc.addPage([WIDTH, HEIGHT]);
      used = 0;
      slots = 0;
    }
    const base = MARGIN + used;
    for (const op of ops) {
      if (op.kind === "text")
        page.drawText(op.line, {
          x: MARGIN + op.x,
          y: HEIGHT - base - op.y - op.size,
          size: op.size,
          font: op.font,
          color: BLACK,
        });
      if (op.kind === "line")
        page.drawLine({
          start: { x: MARGIN + op.x, y: HEIGHT - base - op.y },
          end: { x: MARGIN + op.x + op.w, y: HEIGHT - base - op.y },
          thickness: 0.8,
        });
      if (op.kind === "rect")
        page.drawRectangle({
          x: MARGIN + op.x,
          y: HEIGHT - base - op.y - op.h,
          width: op.w,
          height: op.h,
          borderWidth: 0.5,
          borderColor: BLACK,
        });
      if (op.kind === "logo") {
        const data = op.value.split(",")[1],
          img = op.value.startsWith("data:image/jpeg")
            ? await doc.embedJpg(Buffer.from(data, "base64"))
            : await doc.embedPng(Buffer.from(data, "base64"));
        const scale = Math.min(op.w / img.width, op.h / img.height);
        page.drawImage(img, {
          x: MARGIN + op.x + (op.w - img.width * scale) / 2,
          y: HEIGHT - base - op.y - op.h,
          width: img.width * scale,
          height: img.height * scale,
        });
      }
    }
    used += height + GAP;
    slots++;
  }
  return {
    bytes: await doc.save(),
    pageCount: doc.getPageCount(),
    formCount: forms.length,
  };
}
