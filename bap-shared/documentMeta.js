import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { logoDimensions } from "./logo.js";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const kids = (el, name) =>
  Array.from(el.childNodes || []).filter(
    (n) => n.nodeType === 1 && n.localName === name && n.namespaceURI === W,
  );
const contents = (el) =>
  Array.from(el.getElementsByTagNameNS(W, "t"))
    .map((t) => t.textContent)
    .join("");
function replace(p, value) {
  const nodes = Array.from(p.getElementsByTagNameNS(W, "t"));
  if (nodes.length) {
    nodes[0].textContent = value;
    for (const t of nodes.slice(1)) t.textContent = "";
  } else {
    const r = p.ownerDocument.createElementNS(W, "w:r"),
      t = p.ownerDocument.createElementNS(W, "w:t");
    t.textContent = value;
    r.appendChild(t);
    p.appendChild(r);
  }
}
/** Only trusted application-authored placeholders are introduced. User text is data. */
export async function configurableTemplate(bytes) {
  const zip = await JSZip.loadAsync(bytes),
    doc = new DOMParser().parseFromString(
      await zip.file("word/document.xml").async("string"),
      "text/xml",
    );
  const body = doc.getElementsByTagNameNS(W, "body")[0],
    tables = kids(body, "tbl"),
    header = tables[0],
    staff = tables.find((t) => contents(t).includes("Teknisi Pembimbing"));
  for (const p of Array.from(header.getElementsByTagNameNS(W, "p"))) {
    const t = contents(p);
    if (t.includes("KEMENTERIAN")) replace(p, "+++$f.meta.institusi+++");
    else if (t.includes("POLITEKNIK")) replace(p, "+++$f.meta.unit+++");
    else if (t.includes("JURUSAN")) replace(p, "+++$f.meta.jurusan+++");
    else if (t.includes("PROGRAM STUDI")) replace(p, "+++$f.meta.prodi+++");
    else if (t.includes("Jalan Mastrip")) replace(p, "+++$f.meta.alamat+++");
    else if (t.includes("Email:")) replace(p, "+++$f.meta.kontak+++");
  }
  const logoP = Array.from(header.getElementsByTagNameNS(W, "p")).find(
    (p) => p.getElementsByTagNameNS(W, "drawing").length,
  );
  if (logoP) {
    for (const child of Array.from(logoP.childNodes))
      if (child.localName !== "pPr") logoP.removeChild(child);
    replace(logoP, "+++IMAGE logo($f.meta.logo)+++");
  }
  if (staff) {
    const rows = kids(staff, "tr");
    for (const [i, key] of [
      [1, "dosen"],
      [2, "asdos"],
    ]) {
      const cell = kids(rows[i], "tc")[1],
        ps = kids(cell, "p");
      replace(ps[0], `+++$f.meta.${key}+++`);
      for (const p of ps.slice(1)) replace(p, "");
    }
  }
  // The source's unused right-hand name slots inherit Normal (Calibri/centred).
  // Once populated, both halves must use the same Times 12 / left-aligned text.
  const absence = tables.find((t) => kids(kids(t, "tblGrid")[0] || {}, "gridCol").length === 8);
  for (const row of kids(absence || {}, "tr").slice(1)) {
    for (const index of [1, 5]) {
      const cell = kids(row, "tc")[index];
      for (const p of kids(cell, "p")) {
        let props = kids(p, "pPr")[0];
        if (!props) {
          props = doc.createElementNS(W, "w:pPr");
          p.insertBefore(props, p.firstChild);
        }
        const align = kids(props, "jc")[0] || doc.createElementNS(W, "w:jc");
        align.setAttributeNS(W, "w:val", "left");
        props.appendChild(align);
        for (const parent of [props, ...kids(p, "r")]) {
          const rPr = kids(parent, "rPr")[0] || doc.createElementNS(W, "w:rPr");
          if (!rPr.parentNode) parent.insertBefore(rPr, parent.firstChild);
          for (const [tag, attrs] of [["rFonts", {ascii: "Times New Roman", hAnsi: "Times New Roman"}], ["sz", {val: "24"}], ["szCs", {val: "24"}]]) {
            const el = kids(rPr, tag)[0] || doc.createElementNS(W, `w:${tag}`);
            for (const [key, value] of Object.entries(attrs)) el.setAttributeNS(W, `w:${key}`, value);
            rPr.appendChild(el);
          }
        }
      }
    }
  }
  for (const p of kids(body, "p"))
    if (contents(p).includes("DAFTAR HADIR PEMBIMBING"))
      replace(p, "+++$f.meta.judul+++ +++$f.judul+++");
  for (const p of kids(body, "p")) {
    if (!/\+\+\+(mataKuliah|hariTanggal|tempat|semGol)\+\+\+/.test(contents(p)))
      continue;
    const props = kids(p, "pPr")[0];
    if (!props) continue;
    let indent = kids(props, "ind")[0];
    if (!indent) {
      indent = doc.createElementNS(W, "w:ind");
      props.appendChild(indent);
    }
    // Explicit stops avoid Word's inherited/default tabs moving with long values.
    indent.setAttributeNS(W, "w:left", "3016");
    indent.setAttributeNS(W, "w:hanging", "2449");
    indent.removeAttribute("w:firstLine");
    for (const old of kids(props, "tabs")) props.removeChild(old);
    const tabs = doc.createElementNS(W, "w:tabs");
    for (const pos of [2880, 3016]) {
      const tab = doc.createElementNS(W, "w:tab");
      tab.setAttributeNS(W, "w:val", "left");
      tab.setAttributeNS(W, "w:pos", String(pos));
      tabs.appendChild(tab);
    }
    props.appendChild(tabs);
    const original = contents(p),
      field = original.match(
        /\+\+\+(mataKuliah|hariTanggal|tempat|semGol)\+\+\+/,
      )[1];
    const labels = {
      mataKuliah: "Mata Kuliah",
      hariTanggal: "Hari / Tanggal",
      tempat: "Tempat",
      semGol: "Semester / Golongan",
    };
    const runProps = p.getElementsByTagNameNS(W, "rPr")[0]?.cloneNode(true);
    for (const child of Array.from(p.childNodes))
      if (child !== props) p.removeChild(child);
    for (const value of [labels[field], null, ":", null, `+++${field}+++`]) {
      const run = doc.createElementNS(W, "w:r");
      if (runProps) run.appendChild(runProps.cloneNode(true));
      const item = doc.createElementNS(W, value === null ? "w:tab" : "w:t");
      if (value !== null) item.textContent = value;
      run.appendChild(item);
      p.appendChild(run);
    }
    const alignment = kids(props, "jc")[0];
    if (alignment) alignment.setAttributeNS(W, "w:val", "left");
  }
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  const defaultLogo = await zip.file("word/media/image1.png").async("base64");
  return {
    bytes: await zip.generateAsync({ type: "uint8array" }),
    logo(value) {
      const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(value || "");
      const dimensions = logoDimensions(
          match ? value : `data:image/png;base64,${defaultLogo}`,
        ),
        scale = Math.min(2.7114917 / dimensions.width, 2.7 / dimensions.height);
      return {
        width: scale * dimensions.width,
        height: scale * dimensions.height,
        data: match ? match[2] : defaultLogo,
        extension: match?.[1] === "jpeg" ? ".jpg" : ".png",
      };
    },
  };
}
