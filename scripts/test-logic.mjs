/**
 * Uji logika murni (tanpa Convex): bentuk form, nomor, dan turunan nama hari.
 *   node scripts/test-logic.mjs
 */
import assert from "node:assert/strict";
import { buildForms, buildBapData, ROWS_PER_FORM, SLOTS_PER_FORM } from "../bap-shared/bapRender.js";
import { hariTanggal } from "../convex/lib/auth.js";

const buat = (n) =>
  Array.from({ length: n }, (_, i) => ({
    nama: `Nama ${i + 1}`,
    gol: "ABCD"[i % 4],
    ket: "A",
  }));

let lulus = 0;
function cek(nama, fn) {
  fn();
  lulus++;
  console.log("  OK", nama);
}

console.log("buildForms:");

cek("0 absen -> 1 form, 6 baris, 12 nomor, sel kosong", () => {
  const f = buildForms([]);
  assert.equal(f.length, 1);
  assert.equal(f[0].baris.length, ROWS_PER_FORM);
  // nomor dikumpulkan per baris (kiri lalu kanan) -> urutan 1,7,2,8,…
  const nomor = f[0].baris.flatMap((b) => [b.no, b.rno]).sort((a, b) => parseInt(a) - parseInt(b));
  assert.deepEqual(nomor, Array.from({ length: 12 }, (_, i) => `${i + 1}.`));
  const nama = f[0].baris.flatMap((b) => [b.nama, b.rnama]);
  assert.ok(nama.every((n) => n === ""), "sel nama harus kosong");
});

cek("12 absen -> 1 form, semua slot terisi", () => {
  const f = buildForms(buat(12));
  assert.equal(f.length, 1);
  const nama = f[0].baris.flatMap((b) => [b.nama, b.rnama]);
  assert.equal(nama.filter(Boolean).length, 12);
});

cek("13 absen -> 2 form, nomor form 2 mulai 13.", () => {
  const f = buildForms(buat(13));
  assert.equal(f.length, 2);
  assert.equal(f[1].baris[0].no, "13.");
  assert.equal(f[1].baris[0].nama, "Nama 13");
  assert.equal(f[1].baris[0].rno, "19.");
  assert.equal(f[1].baris[0].rnama, "");
});

cek("25 absen -> 3 form, form 3 baris pertama nomor 25.", () => {
  const f = buildForms(buat(25));
  assert.equal(f.length, 3);
  assert.equal(f[2].baris[0].no, "25.");
  assert.equal(f[2].baris[0].nama, "Nama 25");
  assert.equal(f[2].baris[1].nama, "", "slot 26 kosong");
});

cek("slot per form konsisten 12", () => {
  for (const n of [0, 1, 6, 7, 11, 12, 13, 24, 25, 37]) {
    const f = buildForms(buat(n));
    assert.equal(f.length * SLOTS_PER_FORM >= n, true, `n=${n} kurang form`);
    assert.equal(f[0].baris.length, 6);
    for (const form of f) assert.equal(form.baris.length, 6);
  }
});

console.log("buildBapData:");

cek("halaman: satu form per halaman, form terakhir tanpa page break", () => {
  const d = buildBapData({
    mataKuliah: "x",
    semester: "GASAL",
    tahunAkademik: "2026/2027",
    hariTanggal: "Senin / 28 September 2026",
    tempat: "F6",
    semGol: "3 / A, B, C, D",
    absen: buat(25),
  });
  assert.equal(d.forms.length, 3);
  assert.deepEqual(d.forms.map((f) => f.pageBreak), [true, true, false]);
  assert.equal(d.forms[0].judul, "SEMESTER GASAL TAHUN AKADEMIK 2026/2027");
  assert.match(d.forms[1].judul, /\(lanjutan\)$/);
});

console.log("hariTanggal:");

cek("28 Sep 2026 = Senin (cacat template lama: 27 Sep = Minggu)", () => {
  assert.equal(hariTanggal("2026-09-28"), "Senin / 28 September 2026");
  assert.equal(hariTanggal("2026-09-27"), "Minggu / 27 September 2026");
});

cek("31 Agu 2026 = Senin, 5 Okt 2026 = Senin", () => {
  assert.equal(hariTanggal("2026-08-31"), "Senin / 31 Agustus 2026");
  assert.equal(hariTanggal("2026-10-05"), "Senin / 5 Oktober 2026");
});

console.log(`\n${lulus} pemeriksaan lulus`);
