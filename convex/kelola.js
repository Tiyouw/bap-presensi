import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { requireUser, requireClass, audit } from "./lib/access.js";
import { classRows, classSnapshot, meetingSummary } from "./lib/classLogic.js";
import {
  DEFAULT_TEMPLATE,
  TYPES,
  text,
  validDate,
  normalizeRoster,
  validateTemplate,
  matches,
} from "../bap-shared/management.js";
const publicRecord = (p) => ({ ...p, id: p._id });
const canSee = (user, c) =>
  user.peran === "ADMIN" || user.kelasIds.includes(c._id);
const revision = (c, base) => {
  if (c.revision !== base) throw new ConvexError("KONFLIK_REVISI");
};
export const catalog = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token),
      classes = (await ctx.db.query("kelas").collect()).filter((c) =>
        canSee(user, c),
      );
    const courses = await ctx.db.query("matkul").collect();
    const kelas = await Promise.all(
      classes.map(async (c) => {
        const p = await classRows(ctx, "pertemuan", c._id),
          peserta = await classRows(ctx, "peserta", c._id),
          m = courses.find((m) => m._id === c.matkulId);
        return {
          ...publicRecord(
            Object.fromEntries(
              Object.entries(c).filter(([key]) => key !== "templateDraft"),
            ),
          ),
          matkulNama: m?.nama,
          matkulKode: m?.kode,
          jumlahPeserta: peserta.filter((p) => p.aktif !== false).length,
          jumlahPraktikum: p.filter((p) => p.tipe === "REGULER").length,
          jumlahTerkunci: p.filter(
            (p) => p.tipe === "REGULER" && p.status === "KUNCI",
          ).length,
          berikutnya:
            p
              .filter((p) => p.tipe === "REGULER" && p.status !== "KUNCI")
              .sort((a, b) => a.tanggal.localeCompare(b.tanggal))[0]?.tanggal ||
            null,
        };
      }),
    );
    return {
      kelas,
      matkul: courses
        .filter(
          (m) =>
            user.peran === "ADMIN" ||
            m.dibuatOleh === user._id ||
            classes.some((c) => c.matkulId === m._id),
        )
        .map(publicRecord),
    };
  },
});
export const detail = query({
  args: { token: v.string(), kelasId: v.id("kelas") },
  handler: async (ctx, { token, kelasId }) => {
    const { kelas, user } = await requireClass(ctx, token, kelasId),
      m = await ctx.db.get(kelas.matkulId);
    const [peserta, pertemuan, templates, impor, events] = await Promise.all([
      classRows(ctx, "peserta", kelasId),
      classRows(ctx, "pertemuan", kelasId),
      ctx.db
        .query("template")
        .withIndex("by_kelas_version", (q) => q.eq("kelasId", kelasId))
        .collect(),
      classRows(ctx, "impor", kelasId),
      classRows(ctx, "audit", kelasId),
    ]);
    return {
      kelas: { ...publicRecord(kelas), matkulNama: m.nama, matkulKode: m.kode },
      peserta: peserta.map(publicRecord),
      pertemuan: pertemuan
        .sort((a, b) => a.nomor - b.nomor)
        .map(meetingSummary),
      templates: templates
        .map(publicRecord)
        .sort((a, b) => b.version - a.version),
      impor:
        user.peran === "OPERATOR"
          ? []
          : impor
              .map(publicRecord)
              .sort((a, b) => b.pada - a.pada)
              .slice(0, 20),
      audit: events
        .map(publicRecord)
        .sort((a, b) => b.pada - a.pada)
        .slice(0, 50),
    };
  },
});
export const saveClass = mutation({
  args: {
    token: v.string(),
    kelasId: v.optional(v.id("kelas")),
    baseRevision: v.optional(v.number()),
    data: v.any(),
    copyId: v.optional(v.id("kelas")),
    copyRoster: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const user = await requireUser(ctx, a.token);
    if (user.peran === "OPERATOR") throw new ConvexError("AKSES_DITOLAK");
    let old = null,
      source = null;
    if (a.kelasId) {
      old = (await requireClass(ctx, a.token, a.kelasId, true, true)).kelas;
      revision(old, a.baseRevision);
    }
    if (a.copyId)
      source = (await requireClass(ctx, a.token, a.copyId, true)).kelas;
    const data = { ...source, ...old, ...a.data };
    let matkulId = old?.matkulId || a.data.matkulId || source?.matkulId;
    if (!matkulId) {
      matkulId = await ctx.db.insert("matkul", {
        nama: text(data.matkulNama, "Mata kuliah"),
        kode: text(data.matkulKode, "Kode", 30),
        dibuatOleh: user._id,
      });
    } else {
      const m = await ctx.db.get(matkulId);
      if (!m) throw new ConvexError("DATA_TIDAK_VALID");
      if (
        user.peran !== "ADMIN" &&
        m.dibuatOleh !== user._id &&
        !(await ctx.db.query("kelas").collect()).some(
          (c) => c.matkulId === matkulId && canSee(user, c),
        )
      )
        throw new ConvexError("AKSES_DITOLAK");
    }
    const fields = {
      matkulId,
      nama: text(data.nama, "Nama kelas"),
      semester: text(data.semester || "GASAL", "Semester", 20),
      tahunAkademik: text(
        data.tahunAkademik || "2026/2027",
        "Tahun akademik",
        30,
      ),
      tingkat: text(data.tingkat || "3", "Tingkat", 20),
      prodi: text(data.prodi || "Destinasi Pariwisata", "Prodi"),
      dosen: text(data.dosen || "Belum diatur", "Dosen"),
      dosenId: text(data.dosenId || "", "Identitas dosen", 80, false),
      asdos: text(data.asdos || "Marchaenta", "Asdos"),
      asdosId: text(data.asdosId || "", "Identitas asdos", 80, false),
      tempat: text(data.tempat || "F6", "Ruang", 80),
      revision: (old?.revision || 0) + 1,
    };
    let id = a.kelasId;
    if (id) await ctx.db.patch(id, fields);
    else {
      const config = validateTemplate(
        source?.templateDraft || DEFAULT_TEMPLATE,
      );
      id = await ctx.db.insert("kelas", {
        ...fields,
        draft: true,
        arsip: false,
        templateVersion: 1,
        templateDraft: config,
        dibuatOleh: user._id,
      });
      await ctx.db.insert("template", {
        kelasId: id,
        version: 1,
        config,
        dibuatOleh: user._id,
        dibuatPada: Date.now(),
      });
      if (user.peran !== "ADMIN")
        await ctx.db.patch(user._id, { kelasIds: [...user.kelasIds, id] });
      if (source && a.copyRoster)
        for (const p of (await classRows(ctx, "peserta", source._id)).filter(
          (p) => p.aktif !== false,
        ))
          await ctx.db.insert("peserta", {
            kelasId: id,
            nim: p.nim,
            nama: p.nama,
            golongan: p.golongan,
            urut: p.urut,
            aktif: true,
          });
    }
    await audit(ctx, user, "KELAS_SIMPAN", fields.nama, id);
    return id;
  },
});
export const saveCourse = mutation({
  args: {
    token: v.string(),
    id: v.id("matkul"),
    nama: v.string(),
    kode: v.string(),
  },
  handler: async (ctx, a) => {
    const user = await requireUser(ctx, a.token),
      m = await ctx.db.get(a.id);
    const assigned = (await ctx.db.query("kelas").collect()).some(
      (c) => c.matkulId === a.id && !c.arsip && canSee(user, c),
    );
    if (
      user.peran === "OPERATOR" ||
      !m ||
      (user.peran !== "ADMIN" && m.dibuatOleh !== user._id && !assigned)
    )
      throw new ConvexError("AKSES_DITOLAK");
    await ctx.db.patch(a.id, {
      nama: text(a.nama, "Matkul"),
      kode: text(a.kode, "Kode", 30),
    });
    await audit(ctx, user, "MATKUL_UBAH", a.nama);
  },
});
export const archive = mutation({
  args: { token: v.string(), kelasId: v.id("kelas"), arsip: v.boolean() },
  handler: async (ctx, a) => {
    const { user } = await requireClass(ctx, a.token, a.kelasId, true);
    await ctx.db.patch(a.kelasId, { arsip: a.arsip });
    await audit(
      ctx,
      user,
      a.arsip ? "KELAS_ARSIP" : "KELAS_PULIH",
      "Status kelas diubah",
      a.kelasId,
    );
  },
});
export const activate = mutation({
  args: { token: v.string(), kelasId: v.id("kelas") },
  handler: async (ctx, a) => {
    const { user, kelas } = await requireClass(
      ctx,
      a.token,
      a.kelasId,
      true,
      true,
    );
    if (
      kelas.dosen === "Belum diatur" ||
      !(await classRows(ctx, "peserta", a.kelasId)).some(
        (p) => p.aktif !== false,
      ) ||
      !(await classRows(ctx, "pertemuan", a.kelasId)).some(
        (p) => p.tipe === "REGULER",
      )
    )
      throw new ConvexError("LENGKAPI_PERSIAPAN_KELAS");
    await ctx.db.patch(a.kelasId, { draft: false });
    await audit(ctx, user, "KELAS_AKTIF", "Persiapan dikonfirmasi", a.kelasId);
  },
});
export const saveParticipant = mutation({
  args: {
    token: v.string(),
    kelasId: v.id("kelas"),
    id: v.optional(v.id("peserta")),
    data: v.any(),
    baseRevision: v.number(),
  },
  handler: async (ctx, a) => {
    const { user, kelas } = await requireClass(
      ctx,
      a.token,
      a.kelasId,
      true,
      true,
    );
    revision(kelas, a.baseRevision);
    const [row] = normalizeRoster([a.data]),
      rows = await classRows(ctx, "peserta", a.kelasId);
    if (
      rows.some(
        (p) => p._id !== a.id && p.nim.toUpperCase() === row.nim.toUpperCase(),
      )
    )
      throw new ConvexError("NIM_SUDAH_ADA");
    if (a.id && !rows.some((p) => p._id === a.id))
      throw new ConvexError("AKSES_DITOLAK");
    const payload = { ...row, aktif: a.data.aktif !== false };
    if (a.id) await ctx.db.patch(a.id, payload);
    else
      await ctx.db.insert("peserta", {
        ...payload,
        kelasId: a.kelasId,
        urut: Math.max(0, ...rows.map((p) => p.urut)) + 1,
      });
    await ctx.db.patch(a.kelasId, { revision: kelas.revision + 1 });
    await audit(ctx, user, "MAHASISWA_SIMPAN", row.nim, a.kelasId);
  },
});
export const importRoster = mutation({
  args: {
    token: v.string(),
    kelasId: v.id("kelas"),
    rows: v.any(),
    source: v.string(),
    baseRevision: v.number(),
    allowUpdate: v.boolean(),
  },
  handler: async (ctx, a) => {
    const { user, kelas } = await requireClass(
      ctx,
      a.token,
      a.kelasId,
      true,
      true,
    );
    revision(kelas, a.baseRevision);
    const rows = normalizeRoster(a.rows),
      existing = await classRows(ctx, "peserta", a.kelasId);
    let urut = Math.max(0, ...existing.map((p) => p.urut));
    for (const row of rows) {
      const old = existing.find(
        (p) => p.nim.toUpperCase() === row.nim.toUpperCase(),
      );
      if (old) {
        if (
          (old.nama !== row.nama || old.golongan !== row.golongan) &&
          !a.allowUpdate
        )
          throw new ConvexError("KONFIRMASI_PERUBARUI");
        await ctx.db.patch(old._id, row);
      } else
        await ctx.db.insert("peserta", {
          ...row,
          kelasId: a.kelasId,
          aktif: true,
          urut: ++urut,
        });
    }
    await ctx.db.patch(a.kelasId, { revision: kelas.revision + 1 });
    await ctx.db.insert("impor", {
      kelasId: a.kelasId,
      source: text(a.source, "Sumber", 200),
      jumlah: rows.length,
      pada: Date.now(),
      actorId: user._id,
    });
    await audit(ctx, user, "IMPOR", `${rows.length} baris`, a.kelasId);
    return { jumlah: rows.length };
  },
});
export const saveSchedule = mutation({
  args: {
    token: v.string(),
    kelasId: v.id("kelas"),
    rows: v.any(),
    baseRevision: v.number(),
  },
  handler: async (ctx, a) => {
    const { user, kelas } = await requireClass(
      ctx,
      a.token,
      a.kelasId,
      true,
      true,
    );
    revision(kelas, a.baseRevision);
    if (!Array.isArray(a.rows) || a.rows.length > 100)
      throw new ConvexError("JADWAL_TIDAK_VALID");
    const existing = await classRows(ctx, "pertemuan", a.kelasId),
      seen = new Set(),
      seenIds = new Set();
    for (const row of a.rows) {
      if (
        !Number.isInteger(row.nomor) ||
        row.nomor < 1 ||
        seen.has(row.nomor) ||
        !TYPES.includes(row.tipe)
      )
        throw new ConvexError("JADWAL_TIDAK_VALID");
      seen.add(row.nomor);
      if (row.id && seenIds.has(row.id))
        throw new ConvexError("JADWAL_TIDAK_VALID");
      if (row.id) seenIds.add(row.id);
      validDate(row.tanggal);
      text(row.tempat, "Ruang", 80);
      if (row.id && !existing.some((p) => p._id === row.id))
        throw new ConvexError("AKSES_DITOLAK");
    }
    for (const old of existing) {
      const next = a.rows.find((r) => r.id === old._id);
      if (old.status === "KUNCI" || old.revision > 0) {
        if (
          !next ||
          ["nomor", "tanggal", "tempat", "tipe"].some((k) => next[k] !== old[k])
        )
          throw new ConvexError("JADWAL_TERKUNCI");
      } else if (!next) await ctx.db.delete(old._id);
    }
    for (const row of a.rows) {
      const data = {
        nomor: row.nomor,
        tanggal: row.tanggal,
        tempat: row.tempat,
        tipe: row.tipe,
      };
      if (row.id) await ctx.db.patch(row.id, data);
      else
        await ctx.db.insert("pertemuan", {
          ...data,
          kelasId: a.kelasId,
          status: "TERBUKA",
          revision: 0,
        });
    }
    await ctx.db.patch(a.kelasId, { revision: kelas.revision + 1 });
    await audit(
      ctx,
      user,
      "JADWAL_SIMPAN",
      `${a.rows.length} minggu`,
      a.kelasId,
    );
  },
});
export const saveTemplate = mutation({
  args: {
    token: v.string(),
    kelasId: v.id("kelas"),
    config: v.any(),
    publish: v.boolean(),
    baseRevision: v.number(),
  },
  handler: async (ctx, a) => {
    const { user, kelas } = await requireClass(
      ctx,
      a.token,
      a.kelasId,
      true,
      true,
    );
    revision(kelas, a.baseRevision);
    const config = validateTemplate(a.config),
      version = kelas.templateVersion + (a.publish ? 1 : 0);
    if (a.publish)
      await ctx.db.insert("template", {
        kelasId: a.kelasId,
        version,
        config,
        dibuatPada: Date.now(),
        dibuatOleh: user._id,
      });
    await ctx.db.patch(a.kelasId, {
      templateDraft: config,
      templateVersion: version,
      revision: kelas.revision + 1,
    });
    await audit(
      ctx,
      user,
      a.publish ? "TEMPLATE_TERBIT" : "TEMPLATE_DRAF",
      `Versi ${version}`,
      a.kelasId,
    );
  },
});
export const refreshSnapshot = mutation({
  args: {
    token: v.string(),
    pertemuanId: v.id("pertemuan"),
    baseRevision: v.number(),
  },
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.pertemuanId);
    if (!p) throw new ConvexError("PERTEMUAN_TIDAK_ADA");
    const { user } = await requireClass(ctx, a.token, p.kelasId, true, true);
    if (p.status !== "TERBUKA" || p.revision !== a.baseRevision)
      throw new ConvexError("KONFLIK_REVISI");
    const snapshot = await classSnapshot(ctx, p.kelasId, p);
    await ctx.db.patch(p._id, { snapshot, revision: p.revision + 1 });
    await audit(
      ctx,
      user,
      "SNAPSHOT_PERBARUI",
      `${snapshot.peserta.length} mahasiswa`,
      p.kelasId,
      p._id,
    );
    return {
      pertemuan: { ...p, id: p._id, snapshot, revision: p.revision + 1 },
      peserta: snapshot.peserta,
      kelas: snapshot.kelas,
      presensi: await ctx.db
        .query("presensi")
        .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", p._id))
        .collect(),
    };
  },
});
export const search = query({
  args: {
    token: v.string(),
    q: v.string(),
    includeArsip: v.boolean(),
    kelasId: v.optional(v.id("kelas")),
  },
  handler: async (ctx, a) => {
    const user = await requireUser(ctx, a.token);
    if (!a.q.trim()) return [];
    const classes = (await ctx.db.query("kelas").collect()).filter(
        (c) => canSee(user, c) && (a.includeArsip || !c.arsip),
      ),
      results = [];
    classes.sort(
      (x, y) =>
        Number(y._id === a.kelasId) - Number(x._id === a.kelasId) ||
        Number(x.arsip) - Number(y.arsip) ||
        (y._creationTime || 0) - (x._creationTime || 0),
    );
    for (const c of classes) {
      const m = await ctx.db.get(c.matkulId),
        context = `${m.nama} · ${c.nama} · ${c.semester} ${c.tahunAkademik}`;
      if (matches(`${context} ${m.kode} ${c.dosen} ${c.asdos}`, a.q))
        results.push({
          kind: "Kelas",
          id: c._id,
          title: `${m.kode} · ${c.nama}`,
          context,
          path: `/kelas/${c._id}`,
        });
      for (const p of await classRows(ctx, "peserta", c._id))
        if (matches(`${p.nama} ${p.nim} ${m.kode} ${context}`, a.q))
          results.push({
            kind: "Mahasiswa",
            id: p._id,
            title: p.nama,
            context: `${p.nim} · ${context}`,
            path: `/kelas/${c._id}?tab=mahasiswa&person=${p._id}`,
          });
      for (const p of await classRows(ctx, "pertemuan", c._id))
        if (
          matches(
            `minggu ${p.nomor} pertemuan ${p.nomor} ${p.tanggal} ${context}`,
            a.q,
          )
        )
          results.push({
            kind: p.status === "KUNCI" ? "Dokumen / pertemuan" : "Pertemuan",
            id: p._id,
            title: `Pertemuan ${p.nomor} · ${p.tanggal}`,
            context,
            path:
              p.tipe === "REGULER"
                ? `/kelas/${c._id}/pertemuan/${p._id}`
                : `/kelas/${c._id}?tab=jadwal`,
          });
    }
    return results.slice(0, 80);
  },
});
