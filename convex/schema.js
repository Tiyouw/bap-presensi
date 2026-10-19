import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Skema BAP presensi.
 *
 * Catatan model:
 *  - `pertemuan` = 16 baris (14 reguler + UTS + UAS). BAP hanya untuk REGULER
 *    yang berstatus KUNCI.
 *  - `presensi` menyimpan 93 baris per pertemuan (satu per peserta), bukan
 *    satu baris per ketidakhadiran: rekap butuh semua status.
 *  - `bapDoc` dikunci oleh (pertemuanId, revision, templateVersion) supaya
 *    generate bisa idempoten.
 */
export default defineSchema({
  peserta: defineTable({
    nim: v.string(),
    nama: v.string(),
    golongan: v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D")),
    urut: v.number(),
  }).index("by_gol", ["golongan", "urut"]),

  pertemuan: defineTable({
    nomor: v.number(),
    tipe: v.union(v.literal("REGULER"), v.literal("UTS"), v.literal("UAS")),
    tanggal: v.string(), // YYYY-MM-DD, hari diturunkan dari tanggal
    tempat: v.string(),
    status: v.union(v.literal("TERBUKA"), v.literal("KUNCI")),
    revision: v.number(),
    dikunciPada: v.optional(v.number()),
  }).index("by_nomor", ["nomor"]),

  presensi: defineTable({
    pertemuanId: v.id("pertemuan"),
    pesertaId: v.id("peserta"),
    status: v.union(
      v.literal("HADIR"),
      v.literal("ALPHA"),
      v.literal("SAKIT"),
      v.literal("IZIN")
    ),
  }).index("by_pertemuan", ["pertemuanId"]),

  bapDoc: defineTable({
    pertemuanId: v.id("pertemuan"),
    revision: v.number(),
    templateVersion: v.string(),
    status: v.union(v.literal("PENDING"), v.literal("READY"), v.literal("FAILED")),
    klaimPada: v.number(),
    percobaan: v.number(),
    storageId: v.optional(v.id("_storage")),
    sha256: v.optional(v.string()),
    pesan: v.optional(v.string()),
  }).index("by_key", ["pertemuanId", "revision", "templateVersion"]),

  sesi: defineTable({
    token: v.string(),
    dibuatPada: v.number(),
    kedaluwarsaPada: v.number(),
  }).index("by_token", ["token"]),

  audit: defineTable({
    pertemuanId: v.id("pertemuan"),
    pada: v.number(),
    jenis: v.string(),
    ringkas: v.string(),
  }).index("by_pertemuan", ["pertemuanId"]),
});
