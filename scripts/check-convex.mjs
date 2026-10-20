/**
 * Verifikasi wiring tanpa deployment Convex.
 *
 * Helper runtime API di-commit agar frontend bisa dibangun tanpa codegen awal.
 * Pemeriksaan ini memastikan setiap referensi `api.x.y` / `internal.x.y` menunjuk ke fungsi yang benar-benar
 * di-export modul Convex yang bersangkutan.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "_generated" || e === "node_modules") continue;
      walk(p, out);
    } else if (e.endsWith(".js") || e.endsWith(".jsx")) {
      out.push(p);
    }
  }
  return out;
}

const files = [...walk(join(ROOT, "convex")), ...walk(join(ROOT, "src"))];

// peta modul -> export (nama file relatif terhadap convex/)
const ekspor = new Map();
for (const f of files) {
  const rel = relative(join(ROOT, "convex"), f).replace(/\\/g, "/");
  if (!rel.startsWith("convex") && f.startsWith(join(ROOT, "convex")) && rel.endsWith(".js")) {
    const nama = rel.replace(/\.js$/, "");
    const isi = readFileSync(f, "utf8");
    const nama_fungsi = [...isi.matchAll(/export\s+const\s+(\w+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\(/g)]
      .map((m) => m[1]);
    if (nama_fungsi.length) ekspor.set(nama, new Set(nama_fungsi));
  }
}

const masalah = [];
let jumlah = 0;
for (const f of files) {
  const isi = readFileSync(f, "utf8");
  for (const m of isi.matchAll(/\b(api|internal)\.(\w+)\.(\w+)/g)) {
    jumlah++;
    const [, jenis, modul, fungsi] = m;
    const set = ekspor.get(modul);
    const label = `${relative(ROOT, f)}: ${jenis}.${modul}.${fungsi}`;
    if (!set) masalah.push(`${label} — modul convex/${modul}.js tidak punya fungsi`);
    else if (!set.has(fungsi)) masalah.push(`${label} — tidak ada di ${modul}.js (ada: ${[...set].join(", ")})`);
    if (jenis === "internal" && /query/.test("")) masalah.push("");
  }
}

console.log(`fungsi Convex terdaftar: ${[...ekspor].map(([k, v]) => `${k}(${v.size})`).join(", ")}`);
console.log(`referensi diperiksa: ${jumlah}`);
const bersih = masalah.filter(Boolean);
if (bersih.length) {
  console.log("MASALAH:");
  for (const b of bersih) console.log(" -", b);
  process.exit(1);
}
console.log("OK — semua referensi api./internal. menunjuk fungsi yang ada");
