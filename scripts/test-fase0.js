/**
 * Fase 0 — uji generator pada empat ambang ketidakhadiran: 0, 12, 13, 25.
 * Nama diambil dari CSV asli supaya panjang nama realistis.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderBap } from "../bap-shared/bapRender.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(ROOT, "templates", "bap-template.docx");
const OUT = join(ROOT, "out");
mkdirSync(OUT, { recursive: true });

// CSV: nim,nama,golongan
const semua = readFileSync(join(ROOT, "data", "bap-mahasiswa.csv"), "utf8")
  .split("\n")
  .slice(1)
  .filter(Boolean)
  .map((l) => {
    const [nim, nama, gol] = l.split(",");
    return { nim, nama: nama.trim(), gol: gol.trim() };
  });

const KET = ["A", "S", "I"];

function kasus(n) {
  return semua.slice(0, n).map((m, i) => ({
    nama: m.nama,
    gol: m.gol,
    ket: KET[i % 3],
  }));
}

const template = readFileSync(TEMPLATE);

const meta = {
  mataKuliah: "Pengantar Pariwisata Budaya",
  semester: "GASAL",
  tahunAkademik: "2026/2027",
  hariTanggal: "Senin / 28 September 2026",
  tempat: "F6",
  semGol: "3 / A, B, C, D",
};

for (const n of [0, 12, 13, 25]) {
  const buf = await renderBap(template, { ...meta, absen: kasus(n) });
  const path = join(OUT, `BAP-uji-${String(n).padStart(2, "0")}.docx`);
  writeFileSync(path, buf);
  const harap = Math.max(1, Math.ceil(n / 12));
  console.log(`${n} absen -> ${path}  (${buf.length} B, harap ${harap} form)`);
}
