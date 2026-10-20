import assert from "node:assert/strict";
import { progresPanggil } from "../src/lib/panggil.js";
import {
  simpanDraf,
  bacaDraf,
  bacaPreferensiPanggil,
  simpanPreferensiPanggil,
} from "../src/lib/store.js";

const roster = [
  { id: "one", nim: "001", nama: "Contoh Satu", golongan: "X" },
  { id: "two", nim: "002", nama: "Contoh Dua", golongan: "Y" },
];
const initial = progresPanggil(null, roster, 3);
assert.deepEqual(initial.reviewedIds, []);
const saved = {
  ...initial,
  reviewedIds: ["one", "one", "foreign"],
  currentId: "two",
  started: true,
};
assert.deepEqual(progresPanggil(saved, roster, 3).reviewedIds, ["one"]);
assert.equal(progresPanggil(saved, roster, 3).currentId, "two");
for (const changed of [
  roster.slice(1),
  [...roster].reverse(),
  roster.map((p) => ({ ...p, nama: p.nama + " baru" })),
]) {
  assert.deepEqual(progresPanggil(saved, changed, 3).reviewedIds, []);
}
assert.deepEqual(progresPanggil(saved, roster, 4).reviewedIds, []);
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k),
  setItem: (k, v) => values.set(k, v),
};
assert.ok(
  simpanDraf("u1:k1:s1", {
    baseRevision: 3,
    statuses: { one: "HADIR", two: "IZIN" },
    panggil: saved,
  }),
);
assert.deepEqual(bacaDraf("u1:k1:s1").panggil, saved);
assert.equal(bacaDraf("u2:k1:s1"), null);
assert.equal(bacaDraf("u1:k2:s1"), null);
assert.equal(bacaDraf("u1:k1:s2"), null);
assert.ok(simpanPreferensiPanggil("u1:k1:preferences", false));
assert.equal(bacaPreferensiPanggil("u1:k1:preferences"), false);
assert.equal(bacaPreferensiPanggil("u2:k1:preferences"), true);
globalThis.localStorage.setItem = () => {
  throw new Error("quota");
};
assert.equal(
  simpanDraf("u1:k1:s1", { baseRevision: 3, statuses: {}, panggil: saved }),
  false,
);
assert.equal(simpanPreferensiPanggil("u1", true), false);
console.log(
  "Mode Panggil: snapshot/revision invalidation, unique reviewed IDs, atomic draft metadata, account/class/meeting isolation and storage failure passed.",
);
