import JSZip from "jszip";
import { createReport } from "docx-templates";
import { buildBapData } from "./bapRender.js";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const children = (el, local) =>
  Array.from(el.childNodes || []).filter(
    (n) =>
      n.nodeType === 1 &&
      n.namespaceURI === W &&
      (!local || n.localName === local),
  );

/** A borderless, non-splitting row makes the whole form a single layout unit. */
export function keepFormsTogether(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  const create = (tag, attributes = {}) => {
    const node = doc.createElementNS(W, `w:${tag}`);
    for (const [key, value] of Object.entries(attributes))
      node.setAttributeNS(W, `w:${key}`, String(value));
    return node;
  };
  let block = [];
  for (const element of children(body)) {
    const columns = children(
      children(element, "tblGrid")[0] || {},
      "gridCol",
    ).length;
    if (element.localName === "tbl" && columns === 2) block = [];
    block.push(element);
    if (element.localName !== "tbl" || columns !== 8) continue;
    // Word gives nested table cells different default padding. Reserve enough
    // width for continuation numbers (13., 25., …) without changing the font.
    for (const tr of children(element, "tr")) {
      const cells = children(tr, "tc");
      for (const index of [0, 4]) {
        const tc = cells[index];
        let tcPr = children(tc, "tcPr")[0];
        if (!tcPr) {
          tcPr = create("tcPr");
          tc.insertBefore(tcPr, tc.firstChild);
        }
        const tcMar = create("tcMar");
        for (const side of ["left", "right"])
          tcMar.appendChild(create(side, { w: 20, type: "dxa" }));
        tcPr.appendChild(tcMar);
        tcPr.appendChild(create("noWrap"));
      }
    }
    const table = create("tbl");
    const props = create("tblPr");
    props.appendChild(create("tblW", { w: 11132, type: "dxa" }));
    props.appendChild(create("tblInd", { w: -572, type: "dxa" }));
    props.appendChild(create("tblLayout", { type: "fixed" }));
    const margins = create("tblCellMar");
    for (const side of ["top", "left", "bottom", "right"])
      margins.appendChild(create(side, { w: 0, type: "dxa" }));
    props.appendChild(margins);
    table.appendChild(props);
    const grid = create("tblGrid");
    grid.appendChild(create("gridCol", { w: 11132 }));
    table.appendChild(grid);
    const row = create("tr");
    const rowProps = create("trPr");
    rowProps.appendChild(create("cantSplit"));
    row.appendChild(rowProps);
    const cell = create("tc");
    const cellProps = create("tcPr");
    cellProps.appendChild(create("tcW", { w: 11132, type: "dxa" }));
    cell.appendChild(cellProps);
    // Align the original body content within the wrapper; the absence table uses
    // the full width while other blocks retain their original insets.
    body.insertBefore(table, block[0]);
    for (const part of block) {
      if (part.localName === "p") {
        let pPr = children(part, "pPr")[0];
        if (!pPr) {
          pPr = create("pPr");
          part.insertBefore(pPr, part.firstChild);
        }
        let indent = children(pPr, "ind")[0];
        if (!indent) {
          indent = create("ind");
          pPr.appendChild(indent);
        }
        for (const side of ["left", "right"])
          indent.setAttributeNS(
            W,
            `w:${side}`,
            String(Number(indent.getAttribute(`w:${side}`) || 0) + 572),
          );
      }
      if (
        part.localName === "tbl" &&
        children(children(part, "tblGrid")[0] || {}, "gridCol").length === 2
      ) {
        const p = children(part, "tblPr")[0];
        const jc = children(p, "jc")[0] || create("jc");
        jc.setAttributeNS(W, "w:val", "center");
        p.appendChild(jc);
      }
      cell.appendChild(part);
    }
    const end = create("p");
    const endProps = create("pPr");
    endProps.appendChild(
      create("spacing", { before: 0, after: 0, line: 1, lineRule: "exact" }),
    );
    end.appendChild(endProps);
    cell.appendChild(end);
    row.appendChild(cell);
    table.appendChild(row);
    block = [];
  }
  return new XMLSerializer().serializeToString(doc);
}

export function buildPrintData(inputs) {
  const forms = inputs.flatMap((input) => {
    const data = buildBapData(input);
    return data.forms.map((f) => ({
      ...f,
      mataKuliah: data.mataKuliah,
      hariTanggal: data.hariTanggal,
      tempat: data.tempat,
      semGol: data.semGol,
    }));
  });
  forms.forEach((f, i) => {
    f.pageBreak = i % 2 === 1 && i < forms.length - 1;
  });
  return { forms };
}

/** Reuse the corrected official form, changing only metadata scope and pagination. */
export async function renderPrintPack(template, inputs) {
  const zip = await JSZip.loadAsync(template);
  let xml = await zip.file("word/document.xml").async("string");
  for (const field of ["mataKuliah", "hariTanggal", "tempat", "semGol"])
    xml = xml.replaceAll(`+++${field}+++`, `+++$f.${field}+++`);
  zip.file("word/document.xml", xml);
  const result = await createReport({
    template: await zip.generateAsync({ type: "uint8array" }),
    data: buildPrintData(inputs),
    cmdDelimiter: ["+++", "+++"],
    processLineBreaks: true,
  });
  const output = await JSZip.loadAsync(result);
  output.file(
    "word/document.xml",
    keepFormsTogether(await output.file("word/document.xml").async("string")),
  );
  return output.generateAsync({ type: "uint8array" });
}
