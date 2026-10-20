import JSZip from "jszip";
import { DOMParser, XMLSerializer, onWarningStopParsing } from "@xmldom/xmldom";

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const XMLNS = "http://www.w3.org/2000/xmlns/";

/** ExcelJS expects unprefixed SpreadsheetML tags, although prefixed tags are valid.
 * Canonicalise element names only. Cell text, attributes, relationship IDs and
 * extension namespace declarations retain their original meaning.
 */
export async function normalizeXlsxNamespaces(bytes) {
  try {
    const zip = await JSZip.loadAsync(bytes);
    let changed = false;
    for (const part of zip.file(
      /^xl\/(?:workbook|styles|sharedStrings|worksheets\/[^/]+)\.xml$/,
    )) {
      const doc = new DOMParser({ onError: onWarningStopParsing }).parseFromString(
        await part.async("string"), "text/xml",
      );
      if (doc.doctype) throw Error("Unexpected document type");
      if (doc.documentElement.namespaceURI !== MAIN) continue;
      const prefixed = Array.from(doc.getElementsByTagNameNS(MAIN, "*"))
        .some((element) => element.prefix);
      if (!prefixed) continue;
      function copy(node) {
        if (node.nodeType !== 1) return node.cloneNode(true);
        const main = node.namespaceURI === MAIN;
        const next = doc.createElementNS(
          node.namespaceURI, main ? node.localName : node.nodeName,
        );
        for (const attr of Array.from(node.attributes))
          next.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
        if (main && (node === doc.documentElement || node.hasAttribute("xmlns")))
          next.setAttributeNS(XMLNS, "xmlns", MAIN);
        for (const child of Array.from(node.childNodes)) next.appendChild(copy(child));
        return next;
      }
      doc.replaceChild(copy(doc.documentElement), doc.documentElement);
      zip.file(part.name, new XMLSerializer().serializeToString(doc));
      changed = true;
    }
    return changed ? zip.generateAsync({ type: "uint8array" }) : bytes;
  } catch {
    throw Error("File Excel tidak dapat dibaca. Ekspor ulang sebagai .xlsx lalu coba lagi.");
  }
}
