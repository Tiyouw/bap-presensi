import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { FONT_REGULAR, FONT_BOLD } from "./assets/fonts.js";
import { DEFAULT_LOGO } from "./assets/logo.js";
import { buildBapData } from "./bapRender.js";
// Measurements from the retained official DOCX (twips / 20), not a separate
// PDF design. The absence table deliberately extends into the side margins.
const WIDTH = 12191 / 20,
  HEIGHT = 18711 / 20,
  MARGIN = 567 / 20,
  GAP = 18,
  HEADER_X = 1134 / 20,
  HEADER_WIDTH = 10201 / 20,
  ABSENCE_X = (1134 - 572) / 20,
  ABSENCE_WIDTH = 11132 / 20,
  STAFF_X = 91.85,
  STAFF_WIDTH = 8505 / 20;
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
  const forms = inputs.flatMap((input) =>
      buildBapData(input).forms.map((f) => ({ ...f, input })),
    );
  let page = null,
    used = 0,
    slots = 0;
  for (const form of forms) {
    const input = form.input,
      meta = form.meta;
    const ops = [];
    let y = 0;
    const txt = (
      value,
      x,
      top,
      w,
      size = 12,
      isBold = false,
      align = "left",
    ) => {
      const font = isBold ? bold : regular,
        lines = wrapText(value, font, size, w),
        lineHeight = size * 1.15;
      for (const [i, line] of lines.entries())
        ops.push({
          kind: "text",
          line,
          x:
            x +
            (align === "center"
              ? (w - font.widthOfTextAtSize(line, size)) / 2
              : align === "right"
                ? w - font.widthOfTextAtSize(line, size)
                : 0),
          y: top + i * lineHeight,
          size,
          font,
        });
      return lines.length * lineHeight;
    };
    let header = 0;
    for (const [value, size, strong] of [
      [meta.institusi, 12, false],
      [meta.unit, 12, false],
      [meta.jurusan, 12, false],
      [meta.prodi, 12, true],
      [meta.alamat, 10, false],
      [meta.kontak, 11, false],
    ])
      header += txt(value, HEADER_X + 87.65, header,
        HEADER_WIDTH - 87.65, size, strong, "center") + 2;
    ops.push({
      kind: "logo",
      x: HEADER_X + 4.7,
      y: 0,
      w: 976137 / 12700,
      h: 972000 / 12700,
      value: meta.logo || DEFAULT_LOGO,
    });
    y = Math.max(87, header) + 4.5;
    ops.push({ kind: "line", x: HEADER_X, y, w: HEADER_WIDTH });
    y += 7;
    y +=
      txt(`${meta.judul} ${form.judul}`, HEADER_X, y,
        WIDTH - HEADER_X * 2, 12, true, "center") + 7;
    for (const [label, value] of [
      ["Mata Kuliah", input.mataKuliah],
      ["Hari / Tanggal", input.hariTanggal],
      ["Tempat", input.tempat],
      ["Semester / Golongan", input.semGol],
    ]) {
      const h = txt(value, 207.5, y, WIDTH - HEADER_X - 207.5);
      const labelHeight = txt(label, 85.05, y, 116);
      txt(":", 201.5, y, 6);
      y += Math.max(13.8, h, labelHeight);
    }
    y += 6;
    function table(rows, widths, xStart, minHeight, alignments, staff = false) {
      for (const [index, row] of rows.entries()) {
        const top = y,
          heights = row.map(
            (cell, i) =>
              wrapText(
                cell,
                index === 0 ? bold : regular,
                12,
                widths[i] - 8,
              ).length *
                13.8 +
              3.4,
          ),
          height = Math.max(minHeight, ...heights);
        let x = xStart;
        for (const [i, cell] of row.entries()) {
          ops.push({ kind: "rect", x, y: top, w: widths[i], h: height });
          const align = index === 0 ? "center"
            : staff && i === 2 ? (index === 2 ? "right" : "left")
              : alignments[i];
          txt(cell, x + 4, top + (height - heights[i] + 3.4) / 2,
            widths[i] - 8, 12, index === 0, align);
          x += widths[i];
        }
        y += height;
      }
    }
    table(
      [
        ["No", "Nama Dosen / Teknisi Pembimbing", "Tanda Tangan"],
        ["1.", meta.dosen, "1.................."],
        ["2.", meta.asdos, "2. ................"],
      ],
      [28.8, 254.7, STAFF_WIDTH - 283.5], STAFF_X, 21.2,
      ["center", "left", "left"], true,
    );
    y += 2;
    y += txt("Mahasiswa yang tidak hadir", 83.65, y, 400) + 2;
    const sourceCols = [567, 3628, 650, 650, 567, 3685, 650, 695],
      total = sourceCols.reduce((n, c) => n + c, 0),
      cols = sourceCols.map((c) => c / total * ABSENCE_WIDTH);
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
      cols, ABSENCE_X, 17.25,
      ["center", "left", "center", "center", "center", "left", "center", "center"],
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
          x: op.x,
          y: HEIGHT - base - op.y - op.size,
          size: op.size,
          font: op.font,
          color: BLACK,
        });
      if (op.kind === "line")
        page.drawLine({
          start: { x: op.x, y: HEIGHT - base - op.y },
          end: { x: op.x + op.w, y: HEIGHT - base - op.y },
          thickness: 2.2,
        });
      if (op.kind === "rect")
        page.drawRectangle({
          x: op.x,
          y: HEIGHT - base - op.y - op.h,
          width: op.w,
          height: op.h,
          borderWidth: 0.4,
          borderColor: BLACK,
        });
      if (op.kind === "logo") {
        const data = op.value.split(",")[1],
          img = op.value.startsWith("data:image/jpeg")
            ? await doc.embedJpg(Buffer.from(data, "base64"))
            : await doc.embedPng(Buffer.from(data, "base64"));
        const scale = Math.min(op.w / img.width, op.h / img.height);
        page.drawImage(img, {
          x: op.x + (op.w - img.width * scale) / 2,
          y: HEIGHT - base - op.y - op.h,
          width: img.width * scale,
          height: img.height * scale,
        });
      }
    }
    used += height + GAP;
    // Two different meetings occupy the upper and lower half, as on the
    // reference folio. Taller forms move intact to the next page.
    if (slots === 0) used = Math.max(HEIGHT / 2, used);
    slots++;
  }
  return {
    bytes: await doc.save(),
    pageCount: doc.getPageCount(),
    formCount: forms.length,
  };
}
