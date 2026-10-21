import assert from "node:assert/strict";
import { golonganPanggil, progresPanggil } from "../src/lib/panggil.js";
import {
  simpanDraf,
  bacaDraf,
  bacaPreferensiPanggil,
  bacaKeluarOtomatisPanggil,
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
  groupKey: "Y",
  started: true,
};
assert.deepEqual(progresPanggil(saved, roster, 3).reviewedIds, ["one"]);
assert.equal(progresPanggil(saved, roster, 3).currentId, "two");
assert.deepEqual(progresPanggil(saved, roster, 3).positions, {
  X: "one",
  Y: "two",
});
const legacy = { ...saved };
delete legacy.groupKey;
delete legacy.positions;
assert.equal(progresPanggil(legacy, roster, 3).groupKey, "Y");
assert.equal(
  progresPanggil(
    { ...saved, positions: { X: "two", Y: "foreign" }, currentId: "foreign" },
    roster,
    3,
  ).currentId,
  "two",
);
assert.deepEqual(
  golonganPanggil([
    { ...roster[0], golongan: "__proto__" },
    { ...roster[1], golongan: null },
  ]).map((g) => g.label),
  ["Golongan __proto__", "Tanpa golongan"],
);
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
assert.equal(bacaKeluarOtomatisPanggil("u1:k1:preferences"), true);
assert.ok(simpanPreferensiPanggil("u1:k1:preferences", false, false));
assert.ok(simpanPreferensiPanggil("u1:k1:preferences", true));
assert.equal(bacaKeluarOtomatisPanggil("u1:k1:preferences"), false);
assert.equal(bacaKeluarOtomatisPanggil("u2:k1:preferences"), true);
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
