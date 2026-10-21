import { internalMutation, internalQuery } from "./_generated/server.js";
import { v, ConvexError } from "convex/values";
import { DEFAULT_TEMPLATE } from "../bap-shared/management.js";
import { classSnapshot, classRows } from "./lib/classLogic.js";
import { syncClass } from "./lib/readModels.js";
export const inspect = internalQuery({
  args: {},
  handler: async (ctx) => ({
    migrations: await ctx.db.query("migrasi").collect(),
    counts: Object.fromEntries(
      await Promise.all(
        [
          "pengguna",
          "kelas",
          "peserta",
          "pertemuan",
          "presensi",
          "bapDoc",
          "audit",
        ].map(async (t) => [t, (await ctx.db.query(t).collect()).length]),
      ),
    ),
  }),
});
export const initialize = internalMutation({
  args: {
    users: v.array(
      v.object({
        username: v.string(),
        nama: v.string(),
        passwordHash: v.string(),
        recoveryHashes: v.array(v.string()),
      }),
    ),
    demo: v.boolean(),
  },
  handler: async (ctx, { users, demo }) => {
    if (
      (await ctx.db.query("migrasi").collect()).some(
        (m) => m.versi === "management-v2",
      )
    )
      return { skipped: true };
    if (
      (await ctx.db.query("pengguna").collect()).length ||
      users.length !== 2 ||
      new Set(users.map((u) => u.username)).size !== 2 ||
      users.some((u) => !/^scrypt:32768:8:3:/.test(u.passwordHash))
    )
      throw new ConvexError("MIGRASI_TIDAK_VALID");
    const ids = [];
    for (const [i, u] of users.entries())
      ids.push(
        await ctx.db.insert("pengguna", {
          ...u,
          username: u.username.toLowerCase(),
          peran: i === 0 ? "ADMIN" : "PENGELOLA",
          aktif: true,
          wajibGanti: !demo,
          kelasIds: [],
          dibuatPada: Date.now(),
        }),
      );
    const matkulId = await ctx.db.insert("matkul", {
      kode: "PPB",
      nama: "Pengantar Pariwisata Budaya",
      dibuatOleh: ids[0],
    });
    const kelasId = await ctx.db.insert("kelas", {
      matkulId,
      nama: "Semester 3 · A–D",
      semester: "GASAL",
      tahunAkademik: "2026/2027",
      tingkat: "3",
      prodi: "Destinasi Pariwisata",
      dosen: "Milawaty, S.Hum., M.Hum.",
      dosenId: "",
      asdos: "Marchaenta Yogyanterra Kusuma, S.Par.",
      asdosId: "",
      tempat: "F6",
      arsip: false,
      revision: 1,
      templateVersion: 1,
      templateDraft: DEFAULT_TEMPLATE,
      dibuatOleh: ids[0],
    });
    await ctx.db.insert("template", {
      kelasId,
      version: 1,
      config: DEFAULT_TEMPLATE,
      dibuatPada: Date.now(),
      dibuatOleh: ids[0],
    });
    for (const id of ids) await ctx.db.patch(id, { kelasIds: [kelasId] });
    if (demo) {
      if ((await ctx.db.query("peserta").collect()).length)
        throw new ConvexError("DEMO_HARUS_KOSONG");
      for (let i = 0; i < 93; i++)
        await ctx.db.insert("peserta", {
          nim: `DEMO${String(i + 1).padStart(5, "0")}`,
          nama:
            i === 0
              ? "Alya Demo"
              : i === 1
                ? "Bima Demo"
                : `Mahasiswa Demo ${i + 1}`,
          golongan: "ABCD"[Math.min(3, Math.floor(i / 24))],
          urut: i + 1,
          aktif: true,
          kelasId,
        });
      for (let i = 0; i < 16; i++)
        await ctx.db.insert("pertemuan", {
          kelasId,
          nomor: i + 1,
          tipe:
            i === 0 ? "TEORI" : i === 7 ? "UTS" : i === 15 ? "UAS" : "REGULER",
          tanggal: new Date(Date.UTC(2026, 7, 31 + i * 7))
            .toISOString()
            .slice(0, 10),
          tempat: "F6",
          status: "TERBUKA",
          revision: 0,
        });
    }
    for (const p of await ctx.db.query("peserta").collect())
      if (!p.kelasId) await ctx.db.patch(p._id, { kelasId, aktif: true });
    for (const p of await ctx.db.query("pertemuan").collect())
      if (!p.kelasId) {
        await ctx.db.patch(p._id, {
          kelasId,
          tipe: p.nomor === 1 ? "TEORI" : p.tipe,
        });
      }
    for (const p of await classRows(ctx, "pertemuan", kelasId))
      if (p.revision > 0 && !p.snapshot)
        await ctx.db.patch(p._id, {
          snapshot: await classSnapshot(ctx, kelasId, p),
        });
    for (const e of await ctx.db.query("audit").collect())
      if (!e.kelasId) await ctx.db.patch(e._id, { kelasId });
    for (const s of await ctx.db.query("sesi").collect())
      if (!s.penggunaId) await ctx.db.delete(s._id);
    await ctx.db.insert("migrasi", {
      versi: "management-v2",
      pada: Date.now(),
      ringkas: `Kelas legacy ditautkan; demo=${demo}`,
    });
    await syncClass(ctx, kelasId);
    return { skipped: false, kelasId };
  },
});
