import { ConvexError } from "convex/values";
import { TEMPLATE_VERSION } from "./auth.js";

/** PENDING dianggap hidup selama ini; lewatnya boleh diambil alih. */
export const KLAIM_HIDUP_MS = 120 * 1000;

/**
 * Klaim generator yang bisa pulih.
 *
 * Temuan review putaran 2: kalau `klaim` berhasil membuat PENDING lalu action
 * mati, revisi itu tidak boleh dianggap "sedang diproses" selamanya. Tanpa
 * kedaluwarsa, tombol `Coba lagi` tidak akan pernah berhasil.
 *
 * Status balik: READY (sudah ada, unduh saja) / BUSY (proses lain masih hidup)
 * / DIKLAIM (hak render ada di pemanggil).
 */
export async function klaimLogic(ctx, args, now = Date.now()) {
  const lama = await ctx.db
    .query("bapDoc")
    .withIndex("by_key", (q) =>
      q
        .eq("pertemuanId", args.pertemuanId)
        .eq("revision", args.revision)
        .eq("templateVersion", TEMPLATE_VERSION)
    )
    .unique();

  if (lama) {
    if (lama.status === "READY") return { status: "READY", id: lama._id };
    if (lama.status === "PENDING" && now - lama.klaimPada < KLAIM_HIDUP_MS) {
      return { status: "BUSY", id: lama._id };
    }
    await ctx.db.patch(lama._id, {
      status: "PENDING",
      klaimPada: now,
      percobaan: lama.percobaan + 1,
    });
    return { status: "DIKLAIM", id: lama._id };
  }

  const id = await ctx.db.insert("bapDoc", {
    pertemuanId: args.pertemuanId,
    revision: args.revision,
    templateVersion: TEMPLATE_VERSION,
    status: "PENDING",
    klaimPada: now,
    percobaan: 1,
  });
  return { status: "DIKLAIM", id };
}

/**
 * Bahan rendering: presensi terkunci + identitas sesi.
 * BAP hanya memuat yang TIDAK hadir; sakit/izin tetap tercantum (S/I),
 * hanya alpha yang mengurangi persentase.
 */
export async function bahanGenerateLogic(ctx, { pertemuanId }) {
  const pertemuan = await ctx.db.get(pertemuanId);
  if (!pertemuan) throw new ConvexError("PERTEMUAN_TIDAK_ADA");
  if (pertemuan.status !== "KUNCI") throw new ConvexError("BELUM_DIKUNCI");

  const baris = await ctx.db
    .query("presensi")
    .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", pertemuanId))
    .take(200);
  const peserta = await ctx.db.query("peserta").take(200);
  const byId = new Map(peserta.map((p) => [p._id, p]));

  const absen = baris
    .filter((b) => b.status !== "HADIR")
    .map((b) => {
      const p = byId.get(b.pesertaId);
      return {
        nim: p.nim,
        nama: p.nama,
        gol: p.golongan,
        urut: p.urut,
        ket: b.status === "ALPHA" ? "A" : b.status === "SAKIT" ? "S" : "I",
      };
    })
    .sort((a, b) => (a.gol === b.gol ? a.urut - b.urut : a.gol < b.gol ? -1 : 1));

  return {
    pertemuan: {
      nomor: pertemuan.nomor,
      tanggal: pertemuan.tanggal,
      tempat: pertemuan.tempat,
      revision: pertemuan.revision,
    },
    absen: absen.map(({ nim, nama, gol, ket }) => ({ nama, gol, ket })),
    jumlahAbsen: absen.length,
  };
}
