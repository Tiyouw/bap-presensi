import assert from "node:assert/strict";
import { buatCtx } from "./test-context.mjs";
import { hashToken } from "../convex/lib/auth.js";
import { DEFAULT_TEMPLATE } from "../bap-shared/management.js";
import {
  simpanDanKunciLogic,
  bukaKunciLogic,
  detailLogic,
} from "../convex/lib/sesiLogic.js";
import {
  klaimLogic,
  bahanGenerateLogic,
  KLAIM_HIDUP_MS,
} from "../convex/lib/bapLogic.js";
import {
  bahanPaketLogic,
  ringkasanCetakLogic,
} from "../convex/lib/printLogic.js";
async function setup(n = 8) {
  const ctx = buatCtx(),
    token = "test-token",
    user = await ctx.db.insert("pengguna", {
      username: "admin",
      nama: "Admin Demo",
      aktif: true,
      wajibGanti: false,
      peran: "ADMIN",
      kelasIds: [],
    }),
    matkulId = await ctx.db.insert("matkul", {
      nama: "Matkul Demo",
      kode: "DEMO",
    }),
    kelasId = await ctx.db.insert("kelas", {
      matkulId,
      nama: "Kelas Demo",
      dosen: "Dosen Demo",
      asdos: "Asdos Demo",
      semester: "GASAL",
      tahunAkademik: "2026/2027",
      tingkat: "3",
      prodi: "Demo",
      tempat: "F6",
      arsip: false,
      revision: 1,
      templateVersion: 1,
      templateDraft: DEFAULT_TEMPLATE,
    });
  await ctx.db.insert("template", {
    kelasId,
    version: 1,
    config: DEFAULT_TEMPLATE,
  });
  await ctx.db.insert("sesi", {
    token: await hashToken(token),
    penggunaId: user,
    kedaluwarsaPada: Date.now() + 1e9,
  });
  const ids = [];
  for (let i = 0; i < n; i++)
    ids.push(
      await ctx.db.insert("peserta", {
        kelasId,
        nim: `DEMO${i}`,
        nama: `Nama Demo ${i}`,
        golongan: "ABCD"[i % 4],
        urut: i + 1,
        aktif: true,
      }),
    );
  const pertemuanId = await ctx.db.insert("pertemuan", {
    kelasId,
    nomor: 1,
    tipe: "REGULER",
    tanggal: "2026-10-20",
    tempat: "F6",
    status: "TERBUKA",
    revision: 0,
  });
  return { ctx, token, kelasId, pertemuanId, ids, user };
}
const statuses = (f, fn = () => "HADIR") =>
  f.ids.map((pesertaId, i) => ({ pesertaId, status: fn(i) }));
const lock = (f) =>
  simpanDanKunciLogic(f.ctx, {
    token: f.token,
    pertemuanId: f.pertemuanId,
    baseRevision: 0,
    statuses: statuses(f),
  });
const state = (ctx) =>
  JSON.stringify([...ctx.tabel].map(([key, rows]) => [key, [...rows]]));
let count = 0;
async function check(name, fn) {
  await fn();
  count++;
  console.log("  OK", name);
}
await check(
  "atomic save creates complete attendance, snapshot, revision and actor audit",
  async () => {
    const f = await setup();
    await lock(f);
    const p = await f.ctx.db.get(f.pertemuanId);
    assert.equal(p.revision, 1);
    assert.equal(p.snapshot.peserta.length, 8);
    assert.equal((await f.ctx.db.query("presensi").collect()).length, 8);
    assert.equal((await f.ctx.db.query("audit").collect())[0].actorId, f.user);
  },
);
await check(
  "stale revision and re-saving locked session cannot overwrite",
  async () => {
    const f = await setup();
    await lock(f);
    const before = state(f.ctx);
    await assert.rejects(
      simpanDanKunciLogic(f.ctx, {
        token: f.token,
        pertemuanId: f.pertemuanId,
        baseRevision: 0,
        statuses: statuses(f, () => "ALPHA"),
      }),
      /KONFLIK_REVISI/,
    );
    await assert.rejects(
      simpanDanKunciLogic(f.ctx, {
        token: f.token,
        pertemuanId: f.pertemuanId,
        baseRevision: 1,
        statuses: statuses(f),
      }),
      /SUDAH_DIKUNCI/,
    );
    assert.equal(state(f.ctx), before);
  },
);
await check(
  "missing, foreign and duplicate participant rejected before writes",
  async () => {
    for (const scenario of ["missing", "foreign", "duplicate"]) {
      const f = await setup(),
        rows = statuses(f);
      if (scenario === "missing") rows.pop();
      if (scenario === "foreign") rows[0].pesertaId = "foreign";
      if (scenario === "duplicate") rows[0].pesertaId = rows[1].pesertaId;
      const before = state(f.ctx);
      await assert.rejects(
        simpanDanKunciLogic(f.ctx, {
          token: f.token,
          pertemuanId: f.pertemuanId,
          baseRevision: 0,
          statuses: rows,
        }),
        /PESERTA_/,
      );
      assert.equal(state(f.ctx), before);
    }
  },
);
await check(
  "theory, UTS, UAS and holiday cannot save/generate; week 1 practical allowed",
  async () => {
    for (const tipe of ["TEORI", "UTS", "UAS", "LIBUR"]) {
      const f = await setup();
      await f.ctx.db.patch(f.pertemuanId, { tipe });
      await assert.rejects(lock(f), /TANPA_PRAKTIKUM/);
      await assert.rejects(bahanGenerateLogic(f.ctx, f), /TANPA_PRAKTIKUM/);
    }
    const f = await setup();
    assert.equal((await lock(f)).revision, 1);
  },
);
await check(
  "invalid, expired and disabled-user sessions rejected",
  async () => {
    const f = await setup();
    await assert.rejects(
      detailLogic(f.ctx, { token: "invalid", pertemuanId: f.pertemuanId }),
      /TOKEN_/,
    );
    await f.ctx.db.patch(f.user, { aktif: false });
    await assert.rejects(detailLogic(f.ctx, f), /TOKEN_/);
    await f.ctx.db.patch(f.user,{aktif:true});
    const session=(await f.ctx.db.query("sesi").collect())[0];
    await f.ctx.db.patch(session._id,{kedaluwarsaPada:Date.now()-1});
    await assert.rejects(detailLogic(f.ctx,f),/TOKEN_/);
  },
);
await check(
  "claim BUSY and expired claim reuse same document; ready claim reused",
  async () => {
    const f = await setup();
    await lock(f);
    const args = { pertemuanId: f.pertemuanId, revision: 1 };
    const a = await klaimLogic(f.ctx, args);
    assert.equal((await klaimLogic(f.ctx, args)).status, "BUSY");
    const b = await klaimLogic(f.ctx, args, Date.now() + KLAIM_HIDUP_MS + 100);
    assert.equal(b.id, a.id);
    assert.equal((await f.ctx.db.get(a.id)).percobaan, 2);
    await f.ctx.db.patch(a.id, { status: "READY", storageId: "storage:demo" });
    assert.equal((await klaimLogic(f.ctx, args)).status, "READY");
  },
);
await check(
  "new attendance revision and format have separate immutable documents",
  async () => {
    const f = await setup();
    await lock(f);
    await klaimLogic(f.ctx, { pertemuanId: f.pertemuanId, revision: 1 });
    await klaimLogic(f.ctx, {
      pertemuanId: f.pertemuanId,
      revision: 1,
      format: "pdf",
    });
    await f.ctx.db.patch(f.pertemuanId, { revision: 2 });
    await klaimLogic(f.ctx, { pertemuanId: f.pertemuanId, revision: 2 });
    assert.equal((await f.ctx.db.query("bapDoc").collect()).length, 3);
  },
);
await check(
  "generation requires lock; absence codes and group/row ordering correct",
  async () => {
    const f = await setup();
    await assert.rejects(bahanGenerateLogic(f.ctx, f), /BELUM_DIKUNCI/);
    await simpanDanKunciLogic(f.ctx, {
      token: f.token,
      pertemuanId: f.pertemuanId,
      baseRevision: 0,
      statuses: statuses(f, (i) => ["HADIR", "ALPHA", "SAKIT", "IZIN"][i % 4]),
    });
    const b = await bahanGenerateLogic(f.ctx, f);
    assert.equal(b.absen.length, 6);
    assert.deepEqual(
      b.absen.map((p) => p.ket),
      ["A", "A", "S", "S", "I", "I"],
    );
  },
);
await check(
  "unlock preserves snapshot/revision; correction creates next revision",
  async () => {
    const f = await setup();
    await lock(f);
    const before = (await f.ctx.db.get(f.pertemuanId)).snapshot;
    await bukaKunciLogic(f.ctx, f);
    assert.equal((await f.ctx.db.get(f.pertemuanId)).revision, 1);
    await f.ctx.db.patch(f.ids[0], { nama: "Changed", aktif: false });
    await simpanDanKunciLogic(f.ctx, {
      token: f.token,
      pertemuanId: f.pertemuanId,
      baseRevision: 1,
      statuses: statuses(f),
    });
    const p = await f.ctx.db.get(f.pertemuanId);
    assert.equal(p.revision, 2);
    assert.deepEqual(p.snapshot, before);
  },
);
await check(
  "detail uses snapshot roster and reports stored status",
  async () => {
    const f = await setup();
    await lock(f);
    await f.ctx.db.patch(f.ids[0], { nama: "Changed", aktif: false });
    const detail = await detailLogic(f.ctx, f);
    assert.equal(detail.peserta[0].nama, "Nama Demo 0");
    assert.equal(detail.presensi.length, 8);
  },
);
await check(
  "print summary excludes open/non-practical sessions; rejects duplicate/stale/mixed-class jobs",
  async () => {
    const f = await setup();
    await lock(f);
    const args = { token: f.token, kelasId: f.kelasId };
    assert.equal((await ringkasanCetakLogic(f.ctx, args)).length, 1);
    const item = { pertemuanId: f.pertemuanId, revision: 1 };
    assert.equal(
      (await bahanPaketLogic(f.ctx, { ...args, items: [item] })).length,
      1,
    );
    await assert.rejects(
      bahanPaketLogic(f.ctx, { ...args, items: [] }),
      /PILIH_PERTEMUAN/,
    );
    await assert.rejects(
      bahanPaketLogic(f.ctx, { ...args, items: [item, item] }),
      /PERTEMUAN_DOBEL/,
    );
    await assert.rejects(
      bahanPaketLogic(f.ctx, { ...args, items: [{ ...item, revision: 0 }] }),
      /PAKET_BERUBAH/,
    );
    await f.ctx.db.patch(f.pertemuanId, { kelasId: "other" });
    await assert.rejects(
      bahanPaketLogic(f.ctx, { ...args, items: [item] }),
      /AKSES_DITOLAK/,
    );
  },
);
await check(
  "class assignment, role and archive checks protect server operations",
  async () => {
    const f = await setup();
    await f.ctx.db.patch(f.user, { peran: "OPERATOR", kelasIds: [] });
    await assert.rejects(detailLogic(f.ctx, f), /AKSES_DITOLAK/);
    await f.ctx.db.patch(f.user, { kelasIds: [f.kelasId] });
    await detailLogic(f.ctx, f);
    await f.ctx.db.patch(f.kelasId, { arsip: true });
    await assert.rejects(lock(f), /KELAS_DIARSIPKAN/);
  },
);
console.log(`${count} handler invariant groups passed`);
