import { ConvexError } from "convex/values";
import { requireSesi } from "./auth.js";

/**
 * Logika transaksi presensi. Dipisah dari `convex/sesi.js` supaya bisa diuji
 * tanpa deployment Convex (lihat scripts/test-handlers.mjs) — dua invarian di
 * sini pernah jadi temuan review: simpan+kunci harus atomik, dan revisi basi
 * harus DITOLAK, bukan menimpa.
 */

export async function detailLogic(ctx, { token, pertemuanId }) {
  await requireSesi(ctx, token);
  const pertemuan = await ctx.db.get(pertemuanId);
  if (!pertemuan) throw new ConvexError("PERTEMUAN_TIDAK_ADA");
  const baris = await ctx.db
    .query("presensi")
    .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", pertemuanId))
    .take(200);
  return {
    pertemuan: {
      id: pertemuan._id,
      nomor: pertemuan.nomor,
      tipe: pertemuan.tipe,
      tanggal: pertemuan.tanggal,
      tempat: pertemuan.tempat,
      status: pertemuan.status,
      revision: pertemuan.revision,
      dikunciPada: pertemuan.dikunciPada ?? null,
    },
    presensi: baris.map((b) => ({ pesertaId: b.pesertaId, status: b.status })),
  };
}

export async function simpanDanKunciLogic(ctx, args) {
  await requireSesi(ctx, args.token);

  const pertemuan = await ctx.db.get(args.pertemuanId);
  if (!pertemuan) throw new ConvexError("PERTEMUAN_TIDAK_ADA");
  if (pertemuan.tipe !== "REGULER") throw new ConvexError("UTS_UAS_TANPA_BAP");
  if (pertemuan.revision !== args.baseRevision) throw new ConvexError("KONFLIK_REVISI");

  const peserta = await ctx.db.query("peserta").take(200);
  const terdaftar = new Set(peserta.map((p) => p._id));
  const dikirim = new Set();
  for (const s of args.statuses) {
    if (!terdaftar.has(s.pesertaId)) throw new ConvexError("PESERTA_ASING");
    if (dikirim.has(s.pesertaId)) throw new ConvexError("PESERTA_DOBEL");
    dikirim.add(s.pesertaId);
  }
  if (dikirim.size !== terdaftar.size) throw new ConvexError("PESERTA_KURANG");

  const lama = await ctx.db
    .query("presensi")
    .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", args.pertemuanId))
    .take(200);
  for (const b of lama) await ctx.db.delete(b._id);
  for (const s of args.statuses) {
    await ctx.db.insert("presensi", {
      pertemuanId: args.pertemuanId,
      pesertaId: s.pesertaId,
      status: s.status,
    });
  }

  const revision = pertemuan.revision + 1;
  await ctx.db.patch(args.pertemuanId, {
    status: "KUNCI",
    revision,
    dikunciPada: Date.now(),
  });

  const tidakHadir = args.statuses.filter((s) => s.status !== "HADIR").length;
  await ctx.db.insert("audit", {
    pertemuanId: args.pertemuanId,
    pada: Date.now(),
    jenis: "SIMPAN_KUNCI",
    ringkas: `revisi ${pertemuan.revision} -> ${revision}; ${tidakHadir} tidak hadir`,
  });

  return { ok: true, revision };
}

export async function bukaKunciLogic(ctx, args) {
  await requireSesi(ctx, args.token);
  const pertemuan = await ctx.db.get(args.pertemuanId);
  if (!pertemuan) throw new ConvexError("PERTEMUAN_TIDAK_ADA");
  if (pertemuan.status !== "KUNCI") return { ok: true, revision: pertemuan.revision };

  await ctx.db.patch(args.pertemuanId, { status: "TERBUKA" });
  await ctx.db.insert("audit", {
    pertemuanId: args.pertemuanId,
    pada: Date.now(),
    jenis: "BUKA_KUNCI",
    ringkas: `dibuka dari revisi ${pertemuan.revision}`,
  });
  // revision tidak dinaikkan: revisi baru lahir saat disimpan lagi.
  return { ok: true, revision: pertemuan.revision };
}
