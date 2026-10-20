/**
 * Inti algoritma dokumen BAP.
 *
 * Satu sumber untuk dua pemakai:
 *  - CLI uji  : scripts/test-fase0.js
 *  - Convex   : convex/bapNode.js (action "use node")
 *
 * Aturan bentuk (lihat PRD 8.4–8.5):
 *  - 1 form = 6 baris data = 12 slot (6 kiri + 6 kanan)
 *  - absen ke-13 dst -> form lanjutan, judul diberi "(lanjutan)", nomor melanjutkan
 *  - satu form per halaman (page break setelah setiap form)
 *  - nomor "1." selalu dicetak, termasuk saat sel nama kosong
 */
import { createReport } from "docx-templates";
import { configurableTemplate } from "./documentMeta.js";

export const ROWS_PER_FORM = 6;
export const SLOTS_PER_FORM = 12;

/**
 * @param {Array<{nama:string,gol:string,ket:string}>} absen sudah urut gol A->D lalu NIM
 */
export function buildForms(absen) {
  const jumlahForm = Math.max(1, Math.ceil(absen.length / SLOTS_PER_FORM));
  const forms = [];
  for (let f = 0; f < jumlahForm; f++) {
    const base = f * SLOTS_PER_FORM;
    const baris = [];
    for (let i = 0; i < ROWS_PER_FORM; i++) {
      const kiri = base + i;
      const kanan = base + ROWS_PER_FORM + i;
      const a = absen[kiri];
      const b = absen[kanan];
      baris.push({
        no: `${kiri + 1}.`,
        nama: a ? a.nama : "",
        gol: a ? a.gol : "",
        ket: a ? a.ket : "",
        rno: `${kanan + 1}.`,
        rnama: b ? b.nama : "",
        rgol: b ? b.gol : "",
        rket: b ? b.ket : "",
      });
    }
    forms.push({ baris });
  }
  return forms;
}

/**
 * Susun data siap-tempel untuk template.
 * @param {{mataKuliah:string, semester:string, tahunAkademik:string,
 *          hariTanggal:string, tempat:string, semGol:string,
 *          absen:Array}} input
 */
export function buildBapData(input) {
  const judul = `SEMESTER ${input.semester} TAHUN AKADEMIK ${input.tahunAkademik}`;
  const forms = buildForms(input.absen || []);
  forms.forEach((f, i) => {
    if (input.documentMeta) f.meta = input.documentMeta;
    f.judul = i === 0 ? judul : `${judul} (lanjutan)`;
    // satu form per halaman; form terakhir tanpa page break (hindari halaman kosong)
    f.pageBreak = i !== forms.length - 1;
  });
  return {
    mataKuliah: input.mataKuliah,
    hariTanggal: input.hariTanggal,
    tempat: input.tempat,
    semGol: input.semGol,
    forms,
  };
}

/**
 * @param {Uint8Array|Buffer} template isi bap-template.docx
 * @param {object} input lihat buildBapData
 * @returns {Promise<Uint8Array>} docx
 */
export async function renderBap(template, input) {
  const prepared = input.documentMeta
    ? await configurableTemplate(template)
    : null;
  return createReport({
    template: prepared?.bytes || template,
    data: buildBapData(input),
    cmdDelimiter: ["+++", "+++"],
    processLineBreaks: true,
    ...(prepared ? { additionalJsContext: { logo: prepared.logo } } : {}),
  });
}
