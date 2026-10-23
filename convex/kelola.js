import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { requireUser, requireClass, audit, classCapabilities, requireClassControl } from "./lib/access.js";
import { classRows, classSnapshot, meetingSummary } from "./lib/classLogic.js";
import { assertSnapshotSize } from "./lib/snapshotSize.js";
import { appendRevision,controlEnabled,revisionProtocolEnabled } from "./lib/revisionLedger.js";
import { syncClass, syncParticipant, syncMeeting, syncTemplate, visibleClasses } from "./lib/readModels.js";
import {
  DEFAULT_TEMPLATE,
  TYPES,
  text,
  validDate,
  normalizeRoster,
  validateTemplate,
  matches,
  fold,
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
      classes = await visibleClasses(ctx, user);
    const courses = user.peran === "ADMIN" ? await ctx.db.query("matkul").collect()
      : [...new Map([...(await ctx.db.query("matkul").withIndex("by_creator", q => q.eq("dibuatOleh", user._id)).collect()),
          ...(await Promise.all([...new Set(classes.map(c => c.matkulId))].map(id => ctx.db.get(id)))).filter(Boolean)]
          .map(m => [m._id, m])).values()];
    const kelas = await Promise.all(
      classes.map(async (c) => {
        const capabilities=await classCapabilities(ctx,user,c),controlsEnabled=Boolean(c.revisionReady)&&await controlEnabled(ctx);
        if (Number.isFinite(c.jumlahPeserta)) return {...publicRecord(c),capabilities,controlsEnabled};
        const p = await classRows(ctx, "pertemuan", c._id),
          peserta = await classRows(ctx, "peserta", c._id),
          m = courses.find((m) => m._id === c.matkulId);
        return {
          ...publicRecord(
            Object.fromEntries(
              Object.entries(c).filter(([key]) => key !== "templateDraft"),
            ),
          ),
          matkulNama: c.courseOverride?.nama||m?.nama,
          matkulKode: c.courseOverride?.kode||m?.kode,
          capabilities,controlsEnabled,
          jumlahPeserta: peserta.filter((p) => p.aktif !== false).length,
          jumlahPraktikum: p.filter((p) => !p.cancelled && p.tipe === "REGULER").length,
          jumlahTerkunci: p.filter(
            (p) => !p.cancelled && p.tipe === "REGULER" && p.status === "KUNCI",
          ).length,
          berikutnya:
            p
              .filter((p) => !p.cancelled && p.tipe === "REGULER" && p.status !== "KUNCI")
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
    const projected = kelas.readModelReady;
    const [peserta, pertemuan, templates, impor, events] = await Promise.all([
      classRows(ctx, "peserta", kelasId),
      classRows(ctx, "pertemuan", kelasId),
      ctx.db
        .query(projected ? "templateView" : "template")
        .withIndex("by_kelas_version", (q) => q.eq("kelasId", kelasId))
        .collect(),
      ctx.db.query("impor").withIndex("by_kelas_pada", q => q.eq("kelasId", kelasId)).order("desc").take(20),
      ctx.db.query("audit").withIndex("by_kelas_pada", q => q.eq("kelasId", kelasId)).order("desc").take(50),
    ]);
    return {
      kelas: { ...publicRecord(kelas), matkulNama: kelas.courseOverride?.nama||m.nama, matkulKode: kelas.courseOverride?.kode||m.kode, matkulRevision: m.revision || 0 },
      controls:{enabled:Boolean(kelas.revisionReady)&&await controlEnabled(ctx),capabilities:await classCapabilities(ctx,user,kelas)},
      peserta: peserta.map(publicRecord),
      pertemuan: pertemuan
        .sort((a, b) => a.nomor - b.nomor)
        .map(meetingSummary),
      templates: templates
        .map(t => publicRecord(projected ? t.data : t))
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
    if (!a.kelasId && !["ADMIN","PENGELOLA"].includes(user.peran)) throw new ConvexError("AKSES_DITOLAK");
    let old = null,
      source = null;
    if (a.kelasId) {
      old = (await requireClassControl(ctx, a.token, a.kelasId, ["identity"])).kelas;
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
        !(await visibleClasses(ctx, user)).some(
          (c) => c.matkulId === matkulId && canSee(user, c),
        )
      )
        throw new ConvexError("AKSES_DITOLAK");
    }
    const fields = {
      ...((old||source?.courseOverride)?{courseOverride:{nama:text(data.matkulNama||source?.courseOverride?.nama|| (await ctx.db.get(matkulId)).nama,"Mata kuliah"),kode:text(data.matkulKode||source?.courseOverride?.kode||(await ctx.db.get(matkulId)).kode,"Kode",30)}}:{}),
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
      const published = source && await ctx.db.query("template")
        .withIndex("by_kelas_version", q => q.eq("kelasId", source._id).eq("version", source.templateVersion))
        .unique();
      const config = validateTemplate(published?.config || DEFAULT_TEMPLATE);
      id = await ctx.db.insert("kelas", {
        revisionReady: true,
        ...fields,
        draft: true,
        arsip: false,
        templateVersion: 1,
        templateDraft: config,
        readModelReady: true,
        dibuatOleh: user._id,
      });
      const templateId = await ctx.db.insert("template", {
        kelasId: id,
        version: 1,
        config,
        dibuatOleh: user._id,
        dibuatPada: Date.now(),
      });
      await syncTemplate(ctx, templateId);
      if (user.peran !== "ADMIN")
        await ctx.db.patch(user._id, { kelasIds: [...user.kelasIds, id] });
      if (source && a.copyRoster)
        for (const p of (await classRows(ctx, "peserta", source._id)).filter(
          (p) => p.aktif !== false,
        ))
          await syncParticipant(ctx, await ctx.db.insert("peserta", {
            kelasId: id,
            nim: p.nim,
            nama: p.nama,
            golongan: p.golongan,
            urut: p.urut,
            aktif: true,
          }));
    }
    await syncClass(ctx, id);
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
    expectedRevision: v.number(),
  },
  handler: async (ctx, a) => {
    const user = await requireUser(ctx, a.token),
      m = await ctx.db.get(a.id);
    const assigned = (await visibleClasses(ctx, user)).some(
      (c) => c.matkulId === a.id && !c.arsip && canSee(user, c),
    );
    if (
      user.peran === "OPERATOR" ||
      !m ||
      (user.peran !== "ADMIN" && m.dibuatOleh !== user._id && !assigned)
    )
      throw new ConvexError("AKSES_DITOLAK");
    const affected=await ctx.db.query("kelas").withIndex("by_matkul",q=>q.eq("matkulId",a.id)).collect();
    if(user.peran!=="ADMIN"&&affected.some(c=>!canSee(user,c)))throw new ConvexError("GUNAKAN_IDENTITAS_PER_KELAS");
    if ((m.revision || 0) !== a.expectedRevision)
      throw new ConvexError("KONFLIK_REVISI");
    await ctx.db.patch(a.id, {
      nama: text(a.nama, "Matkul"),
      kode: text(a.kode, "Kode", 30),
      revision: (m.revision || 0) + 1,
    });
    await audit(ctx, user, "MATKUL_UBAH", a.nama);
    for(const c of affected){await ctx.db.patch(c._id,{revision:c.revision+1});await syncClass(ctx,c._id);}
    return { revision: (m.revision || 0) + 1 };
  },
});
export const archive = mutation({
  args: { token: v.string(), kelasId: v.id("kelas"), arsip: v.boolean(),expectedRevision:v.optional(v.number()) },
  handler: async (ctx, a) => {
    const { user,kelas } = await requireClassControl(ctx, a.token, a.kelasId, ["lifecycle"],false);
    if(kelas.revisionReady&&await revisionProtocolEnabled(ctx)||a.expectedRevision!==undefined)revision(kelas,a.expectedRevision);
    await ctx.db.patch(a.kelasId, { arsip: a.arsip,revision:kelas.revision+1 });
    await syncClass(ctx, a.kelasId);
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
    const { user, kelas } = await requireClassControl(ctx,a.token,a.kelasId,["identity"]);
    if (
      kelas.dosen === "Belum diatur" ||
      !(await classRows(ctx, "peserta", a.kelasId)).some(
        (p) => p.aktif !== false,
      ) ||
      !(await classRows(ctx, "pertemuan", a.kelasId)).some(
        (p) => !p.cancelled && p.tipe === "REGULER",
      )
    )
      throw new ConvexError("LENGKAPI_PERSIAPAN_KELAS");
    const meeting = (await classRows(ctx, "pertemuan", a.kelasId)).find(p => !p.cancelled && p.tipe === "REGULER");
    assertSnapshotSize(await classSnapshot(ctx, a.kelasId, meeting));
    await ctx.db.patch(a.kelasId, { draft: false });
    await syncClass(ctx, a.kelasId);
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
    const { user, kelas } = await requireClassControl(ctx,a.token,a.kelasId,["roster"]);
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
    let participantId = a.id;
    if (a.id) await ctx.db.patch(a.id, payload);
    else
      participantId = await ctx.db.insert("peserta", {
        ...payload,
        kelasId: a.kelasId,
        urut: Math.max(0, ...rows.map((p) => p.urut)) + 1,
      });
    await ctx.db.patch(a.kelasId, { revision: kelas.revision + 1 });
    await syncParticipant(ctx, participantId);
    await syncClass(ctx, a.kelasId);
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
    updateNims:v.optional(v.array(v.string())),reactivateNims:v.optional(v.array(v.string())),
  },
  handler: async (ctx, a) => {
    const { user, kelas } = await requireClassControl(ctx,a.token,a.kelasId,["roster"]);
    revision(kelas, a.baseRevision);
    const rows = normalizeRoster(a.rows),
      existing = await classRows(ctx, "peserta", a.kelasId);
    const byNim=new Map(existing.map(p=>[p.nim.toUpperCase(),p])),incoming=new Set(rows.map(r=>r.nim.toUpperCase()));
    const chosen=new Set((a.updateNims||[]).map(n=>n.toUpperCase())),reactivate=new Set((a.reactivateNims||[]).map(n=>n.toUpperCase()));
    if([...chosen,...reactivate].some(n=>!incoming.has(n)||!byNim.has(n)))throw new ConvexError("PESERTA_ASING");
    const scoped=kelas.revisionReady&&await revisionProtocolEnabled(ctx);
    if(scoped&&a.updateNims===undefined&&rows.some(r=>{const p=byNim.get(r.nim.toUpperCase());return p&&(p.nama!==r.nama||p.golongan!==r.golongan)}))throw new ConvexError("GUNAKAN_EDITOR_ROSTER");
    let urut = Math.max(0, ...existing.map((p) => p.urut));
    for (const row of rows) {
      const old = byNim.get(row.nim.toUpperCase());
      if (old) {
        const different=old.nama!==row.nama||old.golongan!==row.golongan;
        if(different&&!scoped&&!a.allowUpdate)throw new ConvexError("KONFIRMASI_PERUBARUI");
        const update=different&&(scoped?chosen.has(row.nim.toUpperCase()):a.allowUpdate),active=old.aktif===false&&reactivate.has(row.nim.toUpperCase());
        if(!update&&!active)continue;
        await ctx.db.patch(old._id,{...(update?row:{}),...(active?{aktif:true}:{})});
        await syncParticipant(ctx,old._id);
      } else
        await syncParticipant(ctx, await ctx.db.insert("peserta", {
          ...row,
          kelasId: a.kelasId,
          aktif: true,
          urut: ++urut,
        }));
    }
    await ctx.db.patch(a.kelasId, { revision: kelas.revision + 1 });
    await syncClass(ctx, a.kelasId);
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
    if(kelas.revisionReady&&await revisionProtocolEnabled(ctx))throw new ConvexError("GUNAKAN_EDITOR_JADWAL");
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
      } else if (!next) { await ctx.db.delete(old._id); await syncMeeting(ctx, old._id); }
    }
    for (const row of a.rows) {
      const data = {
        nomor: row.nomor,
        tanggal: row.tanggal,
        tempat: row.tempat,
        tipe: row.tipe,
      };
      if (row.id) await ctx.db.patch(row.id, data);
      let meetingId = row.id;
      if (!row.id)
        meetingId = await ctx.db.insert("pertemuan", {
          ...data,
          kelasId: a.kelasId,
          status: "TERBUKA",
          revision: 0,
        });
      await syncMeeting(ctx, meetingId);
    }
    await ctx.db.patch(a.kelasId, { revision: kelas.revision + 1 });
    await syncClass(ctx, a.kelasId);
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
    const { user, kelas } = await requireClassControl(ctx,a.token,a.kelasId,["template"]);
    revision(kelas, a.baseRevision);
    const config = validateTemplate(a.config),
      version = kelas.templateVersion + (a.publish ? 1 : 0);
    if (a.publish)
      await syncTemplate(ctx, await ctx.db.insert("template", {
        kelasId: a.kelasId,
        version,
        config,
        dibuatPada: Date.now(),
        dibuatOleh: user._id,
      }));
    await ctx.db.patch(a.kelasId, {
      templateDraft: config,
      templateVersion: version,
      revision: kelas.revision + 1,
    });
    await syncClass(ctx, a.kelasId);
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
    const { user,kelas } = await requireClassControl(ctx,a.token,p.kelasId,["identity","roster","template","history"]);
    if(kelas.revisionReady&&await revisionProtocolEnabled(ctx))throw new ConvexError("GUNAKAN_EDITOR_KOREKSI");
    if (p.status !== "TERBUKA" || p.revision !== a.baseRevision)
      throw new ConvexError("KONFLIK_REVISI");
    const snapshot = await classSnapshot(ctx, p.kelasId, p);
    assertSnapshotSize(snapshot);
    await appendRevision(ctx, p);
    const priorAttendance=await ctx.db.query("presensi").withIndex("by_pertemuan",q=>q.eq("pertemuanId",p._id)).take(1);
    await ctx.db.patch(p._id, { snapshot, revision: p.revision + 1,hasAttendanceHistory:p.hasAttendanceHistory!==undefined?p.hasAttendanceHistory:Boolean(p.dikunciPada||priorAttendance.length&&p.revision>0) });
    await appendRevision(ctx, await ctx.db.get(p._id), { snapshot,actorId:user._id,
      action:"SNAPSHOT_PERBARUI",reason:"Terapkan data kelas terbaru",parentRevision:p.revision });
    await syncMeeting(ctx, p._id);
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
    const classes = (await visibleClasses(ctx, user)).filter(
        (c) => canSee(user, c) && (a.includeArsip || !c.arsip),
      ),
      results = [];
    classes.sort(
      (x, y) =>
        Number(y._id === a.kelasId) - Number(x._id === a.kelasId) ||
        Number(x.arsip) - Number(y.arsip) ||
        (y._creationTime || 0) - (x._creationTime || 0),
    );
    let candidateBudget = 2000;
    for (const c of classes) {
      if (results.length >= 80 || candidateBudget <= 0) break;
      const parent = await ctx.db.get(c.matkulId),m={...parent,...c.courseOverride},
        context = `${m.nama} · ${c.nama} · ${c.semester} ${c.tahunAkademik}`;
      if (matches(`${context} ${m.kode} ${c.dosen} ${c.asdos}`, a.q))
        results.push({
          kind: "Kelas",
          id: c._id,
          title: `${m.kode} · ${c.nama}`,
          context,
          path: `/kelas/${c._id}`,
        });
      if (c.readModelReady) {
        const remainder = fold(a.q).split(/\s+/).filter(term => !fold(context).includes(term)).join(" ");
        const limit = Math.min(160, candidateBudget);
        const entries = remainder
          ? await ctx.db.query("searchEntry").withSearchIndex("search_text", q => q.search("text", remainder).eq("kelasId", c._id)).take(limit)
          : await ctx.db.query("searchEntry").withIndex("by_kelas", q => q.eq("kelasId", c._id)).take(limit);
        candidateBudget -= entries.length;
        for (const entry of entries) {
          if(entry.data.cancelled&&!a.includeArsip)continue;
          if (!matches(`${entry.text} ${context}`, a.q)) continue;
          results.push({ ...entry.data, context: `${entry.data.nim ? entry.data.nim + " · " : ""}${context}` });
          if (results.length >= 80) break;
        }
        continue;
      }
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
          (!p.cancelled||a.includeArsip)&&
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
              !p.cancelled && p.tipe === "REGULER"
                ? `/kelas/${c._id}/pertemuan/${p._id}`
                : `/kelas/${c._id}?tab=jadwal`,
          });
    }
    return results.slice(0, 80);
  },
});
export const templateConfig = query({
  args: { token: v.string(), id: v.id("template") },
  handler: async (ctx, { token, id }) => {
    const template = await ctx.db.get(id);
    if (!template) throw new ConvexError("DATA_TIDAK_VALID");
    await requireClassControl(ctx,token,template.kelasId,["template"],false);
    return template.config;
  },
});
