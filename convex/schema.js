import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Skema BAP presensi.
 *
 * Catatan model:
 *  - `pertemuan` = 16 minggu (13 praktikum + teori + UTS + UAS). BAP hanya untuk REGULER
 *    yang berstatus KUNCI.
 *  - `presensi` menyimpan 93 baris per pertemuan (satu per peserta), bukan
 *    satu baris per ketidakhadiran: rekap butuh semua status.
 *  - `bapDoc` dikunci oleh (pertemuanId, revision, templateVersion) supaya
 *    generate bisa idempoten.
 */
export default defineSchema({
  pengguna: defineTable({
    username: v.string(),
    nama: v.string(),
    peran: v.string(),
    aktif: v.boolean(),
    passwordHash: v.string(),
    wajibGanti: v.boolean(),
    kelasIds: v.array(v.id("kelas")),
    recoveryHashes: v.array(v.string()),
    dibuatPada: v.number(),
  }).index("by_username", ["username"]),
  authAttempt: defineTable({
    key: v.string(),
    count: v.number(),
    resetAt: v.number(),
  }).index("by_key", ["key"]),
  matkul: defineTable({
    revision: v.optional(v.number()),
    kode: v.string(),
    nama: v.string(),
    dibuatOleh: v.id("pengguna"),
  }).index("by_creator", ["dibuatOleh"]),
  kelas: defineTable({
    readModelReady: v.optional(v.boolean()),
    draft: v.optional(v.boolean()),
    matkulId: v.id("matkul"),
    nama: v.string(),
    semester: v.string(),
    tahunAkademik: v.string(),
    tingkat: v.string(),
    prodi: v.string(),
    dosen: v.string(),
    dosenId: v.string(),
    asdos: v.string(),
    asdosId: v.string(),
    tempat: v.string(),
    arsip: v.boolean(),
    revision: v.number(),
    templateVersion: v.number(),
    templateDraft: v.any(),
    dibuatOleh: v.id("pengguna"),
  }).index("by_matkul", ["matkulId"]),
  template: defineTable({
    kelasId: v.id("kelas"),
    version: v.number(),
    config: v.any(),
    dibuatPada: v.number(),
    dibuatOleh: v.id("pengguna"),
  }).index("by_kelas_version", ["kelasId", "version"]),
  impor: defineTable({
    kelasId: v.id("kelas"),
    source: v.string(),
    jumlah: v.number(),
    pada: v.number(),
    actorId: v.id("pengguna"),
  }).index("by_kelas", ["kelasId"]).index("by_kelas_pada", ["kelasId", "pada"]),
  migrasi: defineTable({
    versi: v.string(),
    pada: v.number(),
    ringkas: v.string(),
  }).index("by_versi", ["versi"]),
  classView: defineTable({ kelasId: v.id("kelas"), matkulId: v.id("matkul"), data: v.any() })
    .index("by_kelas", ["kelasId"]).index("by_matkul", ["matkulId"]),
  meetingView: defineTable({ kelasId: v.id("kelas"), sourceId: v.id("pertemuan"), data: v.any() })
    .index("by_kelas", ["kelasId"]).index("by_source", ["sourceId"]),
  templateView: defineTable({ kelasId: v.id("kelas"), sourceId: v.id("template"), version: v.number(), data: v.any() })
    .index("by_kelas_version", ["kelasId", "version"]).index("by_source", ["sourceId"]),
  searchEntry: defineTable({ kelasId: v.id("kelas"), sourceId: v.string(), text: v.string(), data: v.any() })
    .index("by_kelas", ["kelasId"]).index("by_source", ["sourceId"])
    .searchIndex("search_text", { searchField: "text", filterFields: ["kelasId"] }),
  documentView: defineTable({ kelasId: v.id("kelas"), pertemuanId: v.id("pertemuan"), sourceId: v.id("bapDoc"), format: v.string(), revision: v.number(), pada: v.number(), data: v.any() })
    .index("by_source", ["sourceId"]).index("by_kelas_pada", ["kelasId", "pada"])
    .index("by_pertemuan_format_revision", ["pertemuanId", "format", "revision", "pada"]),
  peserta: defineTable({
    kelasId: v.optional(v.id("kelas")),
    aktif: v.optional(v.boolean()),
    nim: v.string(),
    nama: v.string(),
    golongan: v.string(),
    urut: v.number(),
  })
    .index("by_gol", ["golongan", "urut"])
    .index("by_kelas", ["kelasId"]),

  pertemuan: defineTable({
    kelasId: v.optional(v.id("kelas")),
    snapshot: v.optional(v.any()),
    nomor: v.number(),
    tipe: v.string(),
    tanggal: v.string(), // YYYY-MM-DD, hari diturunkan dari tanggal
    tempat: v.string(),
    status: v.union(v.literal("TERBUKA"), v.literal("KUNCI")),
    revision: v.number(),
    dikunciPada: v.optional(v.number()),
  })
    .index("by_nomor", ["nomor"])
    .index("by_kelas", ["kelasId"]),

  presensi: defineTable({
    pertemuanId: v.id("pertemuan"),
    pesertaId: v.id("peserta"),
    status: v.union(
      v.literal("HADIR"),
      v.literal("ALPHA"),
      v.literal("SAKIT"),
      v.literal("IZIN"),
    ),
  }).index("by_pertemuan", ["pertemuanId"]),

  bapDoc: defineTable({
    format: v.optional(v.string()),
    snapshot: v.optional(v.any()),
    pertemuanId: v.id("pertemuan"),
    revision: v.number(),
    templateVersion: v.string(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("READY"),
      v.literal("FAILED"),
    ),
    klaimPada: v.number(),
    percobaan: v.number(),
    storageId: v.optional(v.id("_storage")),
    sha256: v.optional(v.string()),
    pesan: v.optional(v.string()),
  }).index("by_key", ["pertemuanId", "revision", "templateVersion"]),

  sesi: defineTable({
    penggunaId: v.optional(v.id("pengguna")),
    label: v.optional(v.string()),
    token: v.string(),
    dibuatPada: v.number(),
    kedaluwarsaPada: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_pengguna", ["penggunaId"]),

  audit: defineTable({
    pertemuanId: v.optional(v.id("pertemuan")),
    kelasId: v.optional(v.id("kelas")),
    actorId: v.optional(v.id("pengguna")),
    pada: v.number(),
    jenis: v.string(),
    ringkas: v.string(),
  })
    .index("by_pertemuan", ["pertemuanId"])
    .index("by_kelas", ["kelasId"]).index("by_kelas_pada", ["kelasId", "pada"]),
});
