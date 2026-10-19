import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { bukaKunciLogic, detailLogic, simpanDanKunciLogic } from "./lib/sesiLogic.js";

const STATUS = v.union(
  v.literal("HADIR"),
  v.literal("ALPHA"),
  v.literal("SAKIT"),
  v.literal("IZIN")
);

export const detail = query({
  args: { token: v.string(), pertemuanId: v.id("pertemuan") },
  handler: detailLogic,
});

/**
 * Simpan presensi + kunci pertemuan dalam SATU mutation (review #1).
 * Kalau dipecah, ada jendela "sudah tersimpan tapi belum terkunci" dan BAP bisa
 * digenerate dari data setengah jadi. Logikanya di lib/sesiLogic.js (bisa diuji
 * tanpa deployment).
 */
export const simpanDanKunci = mutation({
  args: {
    token: v.string(),
    pertemuanId: v.id("pertemuan"),
    baseRevision: v.number(),
    statuses: v.array(v.object({ pesertaId: v.id("peserta"), status: STATUS })),
  },
  handler: simpanDanKunciLogic,
});

/** Buka kunci wajib ada sejak versi pertama dipakai di kelas (review putaran 2). */
export const bukaKunci = mutation({
  args: { token: v.string(), pertemuanId: v.id("pertemuan") },
  handler: bukaKunciLogic,
});
