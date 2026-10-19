/**
 * Sematkan 93 peserta dari bap-mahasiswa.csv ke modul Convex (seed).
 *   node scripts/embed-peserta.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Sumber data peserta, berurutan:
 *  1. env BAP_MAHASISWA_CSV (dipakai di Vercel build — data tidak ikut repo publik)
 *  2. file data/bap-mahasiswa.csv (dev lokal, gitignored)
 * File repo hanya menyimpan data/mahasiswa.csv.example sebagai contoh bentuk.
 */
const csv =
  process.env.BAP_MAHASISWA_CSV ??
  (() => {
    try {
      return readFileSync(join(ROOT, "data", "bap-mahasiswa.csv"), "utf8");
    } catch {
      console.error(
        "TIDAK ADA DATA PESERTA.\n" +
          "Set env BAP_MAHASISWA_CSV (isi CSV nim,nama,golongan) ATAU\n" +
          "taruh data/bap-mahasiswa.csv lalu jalankan ulang.\n" +
          "Bentuk: lihat data/mahasiswa.csv.example"
      );
      process.exit(1);
    }
  })();

const baris = csv
  .split("\n")
  .slice(1)
  .filter((l) => l.trim())
  .map((l) => {
    const [nim, nama, golongan] = l.split(",");
    return { nim: nim.trim(), nama: nama.trim(), golongan: golongan.trim() };
  });

// urut dalam golongan: A..D lalu NIM (dipakai untuk nomor BAP)
baris.sort((a, b) =>
  a.golongan === b.golongan ? a.nim.localeCompare(b.nim) : a.golongan < b.golongan ? -1 : 1
);

const sha = createHash("sha256").update(csv).digest("hex");

const out = `// AUTO-GENERATED oleh scripts/embed-peserta.mjs — jangan diedit manual.
// sumber: bap-mahasiswa.csv  sha256:${sha}
export const PESERTA = ${JSON.stringify(
  baris.map((b, i) => ({ ...b, urut: i + 1 })),
  null,
  2
)};
`;
writeFileSync(join(ROOT, "convex", "lib", "pesertaData.js"), out);
console.log(`embedded ${baris.length} peserta`);
