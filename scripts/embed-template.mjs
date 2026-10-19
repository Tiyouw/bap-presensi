/**
 * Sematkan template ke dalam kode Convex (base64).
 * Convex tidak bisa membaca file dari disk saat runtime, jadi template harus
 * ikut jadi modul. Ukuran 68 KB -> ~91 KB base64, masih jauh di bawah batas
 * 32 MiB kode per deployment.
 *
 * Jalankan ulang setiap kali templates/bap-template.docx berubah:
 *   node scripts/embed-template.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(ROOT, "templates", "bap-template.docx");
const buf = readFileSync(src);
const sha = createHash("sha256").update(buf).digest("hex");

const out = `// AUTO-GENERATED oleh scripts/embed-template.mjs — jangan diedit manual.
// sumber: templates/bap-template.docx  sha256:${sha}
export const TEMPLATE_SHA256 = "${sha}";
export const TEMPLATE_BASE64 =
  "${buf.toString("base64")}";
`;

writeFileSync(join(ROOT, "convex", "lib", "templateData.js"), out);
console.log(`embedded ${buf.length} bytes (sha256 ${sha.slice(0, 16)}…)`);
