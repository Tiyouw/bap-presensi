import assert from "node:assert/strict";
import { PESERTA } from "./ui/data-fixture.js";
import { panduanSudahDilihat, tutupPanduan } from "../src/lib/guide.js";
import { adaPraktikum, tipePertemuan } from "../bap-shared/jadwal.js";

const weeks = Array.from({ length: 16 }, (_, i) => ({
  nomor: i + 1, tipe: i === 7 ? "UTS" : i === 15 ? "UAS" : "REGULER",
}));
assert.deepEqual(weeks.filter(adaPraktikum).map((p) => p.nomor), [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
assert.equal(tipePertemuan(weeks[0]), "TEORI");
assert.equal(weeks[0].tipe, "REGULER", "normalizing does not mutate legacy records");
import {
  cariPeserta,
  drafValid,
  hitungStatus,
  pesanGalat,
  statusAwal,
} from "../src/lib/presensi.js";
import {
  bacaDraf,
  bacaToken,
  cadangkanDraf,
  simpanDraf,
} from "../src/lib/store.js";

const peserta = PESERTA.map((p) => ({ ...p, id: p.nim }));
const statuses = statusAwal(peserta, [
  { pesertaId: peserta[0].id, status: "ALPHA" },
  { pesertaId: peserta[1].id, status: "IZIN" },
]);
assert.deepEqual(hitungStatus(peserta, statuses), {
  HADIR: 91,
  ALPHA: 1,
  SAKIT: 0,
  IZIN: 1,
});
assert.equal(cariPeserta(peserta, "A", "").length, 23);
assert.equal(cariPeserta(peserta, "SEMUA", " demo00002 ")[0].nama, "Bima Demo");
assert.equal(cariPeserta(peserta, "SEMUA", "ALT000001").length, 1);
assert.equal(cariPeserta(peserta, "A", "alt000001").length, 0);
assert.equal(
  cariPeserta(peserta, "SEMUA", "ALYA").every((p) =>
    p.nama.toLowerCase().includes("alya"),
  ),
  true,
);
assert.equal(drafValid({ baseRevision: 0, statuses }, peserta), true);
assert.equal(
  drafValid(
    { baseRevision: 0, statuses: { ...statuses, [peserta[0].id]: "UNKNOWN" } },
    peserta,
  ),
  false,
);
assert.equal(drafValid({ baseRevision: "0", statuses }, peserta), false);
assert.equal(drafValid({ baseRevision: 0, statuses: {} }, peserta), false);
assert.match(
  pesanGalat({ data: "GENERATE_GAGAL" }),
  /Presensi tetap tersimpan/,
);
assert.match(pesanGalat({ data: "TOKEN_KEDALUWARSA" }), /draf tetap ada/i);

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
assert.equal(simpanDraf("P1", { baseRevision: 0, statuses }), true);
assert.deepEqual(bacaDraf("P1").statuses, statuses);
assert.equal(cadangkanDraf("P1", bacaDraf("P1")), true);
assert.deepEqual(
  JSON.parse(values.get("bap.draft.backup.P1")).statuses,
  statuses,
);
values.set("bap.draft.P2", "malformed");
assert.equal(bacaDraf("P2"), null);
assert.equal(panduanSudahDilihat(), false);
values.set("bap.guide.dismissed.v1", "1");
assert.equal(panduanSudahDilihat(), true);
globalThis.localStorage = {
  getItem() {
    throw new Error("storage blocked");
  },
  setItem() {
    throw new Error("storage full");
  },
};
assert.equal(bacaToken(), "");
assert.equal(simpanDraf("P1", { baseRevision: 0, statuses }), false);
assert.equal(cadangkanDraf("P1", { baseRevision: 0, statuses }), false);
assert.equal(panduanSudahDilihat(), false);
tutupPanduan();
assert.equal(
  panduanSudahDilihat(),
  true,
  "guide stays dismissed in memory when storage is blocked",
);
console.log(
  "UI logic OK: status kelas penuh, pencarian nama/NIM, draf tidak lengkap/rusak, cadangan, storage penuh, dan pesan kegagalan.",
);
