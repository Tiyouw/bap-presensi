import { ConvexError } from "convex/values";
import { requireMeeting } from "./access.js";
import { classSnapshot } from "./classLogic.js";
export const KLAIM_HIDUP_MS = 120000;
export async function klaimLogic(ctx, args, now = Date.now()) {
  const p = await ctx.db.get(args.pertemuanId);
  if (!p || p.tipe !== "REGULER") throw new ConvexError("TANPA_PRAKTIKUM");
  if (p.status !== "KUNCI" || p.revision !== args.revision)
    throw new ConvexError("KONFLIK_REVISI");
  const format = args.format || "docx",
    version = `${p.snapshot?.templateVersion || "legacy"}:${format}`;
  const old = await ctx.db
    .query("bapDoc")
    .withIndex("by_key", (q) =>
      q
        .eq("pertemuanId", p._id)
        .eq("revision", args.revision)
        .eq("templateVersion", version),
    )
    .unique();
  if (old) {
    if (old.status === "READY") return { status: "READY", id: old._id };
    if (old.status === "PENDING" && now - old.klaimPada < KLAIM_HIDUP_MS)
      return { status: "BUSY", id: old._id };
    await ctx.db.patch(old._id, {
      status: "PENDING",
      klaimPada: now,
      percobaan: old.percobaan + 1,
    });
    return { status: "DIKLAIM", id: old._id };
  }
  const id = await ctx.db.insert("bapDoc", {
    pertemuanId: p._id,
    revision: args.revision,
    templateVersion: version,
    format,
    status: "PENDING",
    klaimPada: now,
    percobaan: 1,
    snapshot: p.snapshot,
  });
  return { status: "DIKLAIM", id };
}
export async function bahanGenerateLogic(ctx, { token, pertemuanId }) {
  const { meeting: p } = await requireMeeting(ctx, token, pertemuanId);
  if (p.tipe !== "REGULER") throw new ConvexError("TANPA_PRAKTIKUM");
  if (p.status !== "KUNCI") throw new ConvexError("BELUM_DIKUNCI");
  const snapshot = p.snapshot || (await classSnapshot(ctx, p.kelasId, p)),
    byId = new Map(snapshot.peserta.map((p) => [p.id, p]));
  const rows = await ctx.db
    .query("presensi")
    .withIndex("by_pertemuan", (q) => q.eq("pertemuanId", p._id))
    .collect();
  const absen = rows
    .filter((r) => r.status !== "HADIR")
    .map((r) => {
      const person = byId.get(r.pesertaId);
      if (!person) throw new ConvexError("PESERTA_ASING");
      return {
        nama: person.nama,
        gol: person.golongan,
        urut: person.urut,
        ket: r.status === "ALPHA" ? "A" : r.status === "SAKIT" ? "S" : "I",
      };
    })
    .sort((a, b) => a.gol.localeCompare(b.gol) || a.urut - b.urut);
  return {
    pertemuan: {
      id: p._id,
      kelasId: p.kelasId,
      nomor: p.nomor,
      tanggal: snapshot.tanggal,
      tempat: snapshot.tempat,
      revision: p.revision,
    },
    snapshot,
    absen,
    jumlahAbsen: absen.length,
  };
}
