/**
 * Uji logika Convex TANPA deployment, pakai ctx tiruan di memori.
 *
 * Yang diuji adalah invarian yang pernah jadi temuan review:
 *  - simpan + kunci harus satu transaksi, revisi basi DITOLAK
 *  - klaim generator harus bisa pulih setelah action mati
 *  - bahan BAP hanya memuat yang tidak hadir, urut gol A->D
 *  - buka kunci tidak menaikkan revisi
 */
import assert from "node:assert/strict";
import { simpanDanKunciLogic, bukaKunciLogic, detailLogic } from "../convex/lib/sesiLogic.js";
import { klaimLogic, bahanGenerateLogic, KLAIM_HIDUP_MS } from "../convex/lib/bapLogic.js";
import { TEMPLATE_VERSION } from "../convex/lib/auth.js";

// ---------- ctx tiruan ----------
const INDEX = {
  sesi: { by_token: ["token"] },
  presensi: { by_pertemuan: ["pertemuanId"] },
  audit: { by_pertemuan: ["pertemuanId"] },
  bapDoc: { by_key: ["pertemuanId", "revision", "templateVersion"] },
  peserta: { by_gol: ["golongan", "urut"] },
  pertemuan: { by_nomor: ["nomor"] },
};

function buatCtx() {
  const tabel = new Map();
  let seq = 0;
  const T = (n) => {
    if (!tabel.has(n)) tabel.set(n, new Map());
    return tabel.get(n);
  };
  const semua = (n) => [...T(n).entries()].map(([id, d]) => ({ _id: id, ...d }));

  function query(nama) {
    const dasar = {
      withIndex(namaIdx, build) {
        const eq = {};
        const q = { eq(field, value) { eq[field] = value; return q; } };
        build(q);
        const fields = INDEX[nama][namaIdx] || [];
        const filter = (row) => fields.every((f) => eq[f] === undefined || row[f] === eq[f]);
        return {
          unique: async () => semua(nama).filter(filter)[0] ?? null,
          take: async (n) => semua(nama).filter(filter).slice(0, n),
          collect: async () => semua(nama).filter(filter),
        };
      },
      take: async (n) => semua(nama).slice(0, n),
      collect: async () => semua(nama),
    };
    return dasar;
  }

  return {
    tabel,
    db: {
      query,
      get: async (id) => {
        for (const name of tabel.keys()) {
          const d = T(name).get(id);
          if (d) return { _id: id, ...d };
        }
        return null;
      },
      insert: async (nama, doc) => {
        const id = `${nama}:${++seq}`;
        T(nama).set(id, doc);
        return id;
      },
      patch: async (id, fields) => {
        for (const name of tabel.keys()) {
          const d = T(name).get(id);
          if (d) {
            T(name).set(id, { ...d, ...fields });
            return;
          }
        }
        throw new Error("patch id tidak ada: " + id);
      },
      delete: async (id) => {
        for (const name of tabel.keys()) if (T(name).delete(id)) return;
        throw new Error("delete id tidak ada: " + id);
      },
    },
    storage: { getUrl: async () => "https://contoh/bap.docx" },
  };
}

async function siapkan({ peserta = 3, tipe = "REGULER" } = {}) {
  const ctx = buatCtx();
  const token = "tok";
  await ctx.db.insert("sesi", { token, dibuatPada: 0, kedaluwarsaPada: Date.now() + 1e9 });
  const ids = [];
  for (let i = 0; i < peserta; i++) {
    ids.push(
      await ctx.db.insert("peserta", {
        nim: `F41250${i}`,
        nama: `Mahasiswa ${i + 1}`,
        golongan: "ABCD"[i % 4],
        urut: i + 1,
      })
    );
  }
  const pertemuanId = await ctx.db.insert("pertemuan", {
    nomor: 5,
    tipe,
    tanggal: "2026-09-28",
    tempat: "F6",
    status: "TERBUKA",
    revision: 0,
  });
  return { ctx, token, ids, pertemuanId };
}

const status = (ids, pola) => ids.map((pesertaId, i) => ({ pesertaId, status: pola(i) }));

let lulus = 0;
async function cek(nama, fn) {
  await fn();
  lulus++;
  console.log("  OK", nama);
}

console.log("simpanDanKunci:");

await cek("happy path: tulis semua peserta, kunci, revisi +1, audit", async () => {
  const { ctx, token, ids, pertemuanId } = await siapkan({ peserta: 4 });
  const hasil = await simpanDanKunciLogic(ctx, {
    token,
    pertemuanId,
    baseRevision: 0,
    statuses: status(ids, (i) => (i === 1 ? "ALPHA" : "HADIR")),
  });
  assert.equal(hasil.revision, 1);
  const p = await ctx.db.get(pertemuanId);
  assert.equal(p.status, "KUNCI");
  assert.equal(p.revision, 1);
  const presensi = await ctx.db.query("presensi").take(100);
  assert.equal(presensi.length, 4);
  assert.equal(presensi.filter((b) => b.status === "ALPHA").length, 1);
  const audit = await ctx.db.query("audit").take(10);
  assert.equal(audit.length, 1);
  assert.match(audit[0].ringkas, /1 tidak hadir/);
});

await cek("revisi basi ditolak KONFLIK_REVISI (bukan menimpa)", async () => {
  const { ctx, token, ids, pertemuanId } = await siapkan();
  await simpanDanKunciLogic(ctx, {
    token, pertemuanId, baseRevision: 0,
    statuses: status(ids, () => "HADIR"),
  });
  // perangkat kedua masih memegang revisi 0
  await assert.rejects(
    simpanDanKunciLogic(ctx, {
      token, pertemuanId, baseRevision: 0,
      statuses: status(ids, () => "ALPHA"),
    }),
    (e) => String(e.data || e.message).includes("KONFLIK_REVISI")
  );
  const presensi = await ctx.db.query("presensi").take(100);
  assert.ok(presensi.every((b) => b.status === "HADIR"), "data lama tidak boleh tertimpa");
});

await cek("peserta kurang ditolak (bukan tersimpan sebagian)", async () => {
  const { ctx, token, ids, pertemuanId } = await siapkan({ peserta: 4 });
  await assert.rejects(
    simpanDanKunciLogic(ctx, {
      token, pertemuanId, baseRevision: 0,
      statuses: status(ids.slice(0, 3), () => "HADIR"),
    }),
    (e) => String(e.data || e.message).includes("PESERTA_KURANG")
  );
  assert.equal((await ctx.db.query("presensi").take(10)).length, 0);
});

await cek("UTS tidak punya BAP", async () => {
  const { ctx, token, ids, pertemuanId } = await siapkan({ tipe: "UTS" });
  await assert.rejects(
    simpanDanKunciLogic(ctx, {
      token, pertemuanId, baseRevision: 0,
      statuses: status(ids, () => "HADIR"),
    }),
    (e) => String(e.data || e.message).includes("UTS_UAS_TANPA_BAP")
  );
});

await cek("token salah ditolak", async () => {
  const { ctx, ids, pertemuanId } = await siapkan();
  await assert.rejects(
    simpanDanKunciLogic(ctx, {
      token: "palsu", pertemuanId, baseRevision: 0,
      statuses: status(ids, () => "HADIR"),
    }),
    (e) => String(e.data || e.message).includes("TOKEN_TIDAK_DIKENAL")
  );
});

console.log("klaim generator:");

await cek("klaim pertama DIKLAIM, klaim kedua BUSY", async () => {
  const { ctx, pertemuanId } = await siapkan();
  const a = await klaimLogic(ctx, { pertemuanId, revision: 0 });
  assert.equal(a.status, "DIKLAIM");
  const b = await klaimLogic(ctx, { pertemuanId, revision: 0 });
  assert.equal(b.status, "BUSY");
});

await cek("action mati -> setelah 120 dtk boleh diambil alih (percobaan naik)", async () => {
  const { ctx, pertemuanId } = await siapkan();
  const a = await klaimLogic(ctx, { pertemuanId, revision: 0 });
  const nanti = Date.now() + KLAIM_HIDUP_MS + 1000;
  const b = await klaimLogic(ctx, { pertemuanId, revision: 0 }, nanti);
  assert.equal(b.status, "DIKLAIM");
  assert.equal(b.id, a.id, "baris yang sama dipakai ulang, bukan duplikat");
  const rows = await ctx.db.query("bapDoc").take(10);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].percobaan, 2);
});

await cek("sudah READY -> tidak dirender ulang", async () => {
  const { ctx, pertemuanId } = await siapkan();
  const a = await klaimLogic(ctx, { pertemuanId, revision: 0 });
  await ctx.db.patch(a.id, { status: "READY", storageId: "s:1" });
  const b = await klaimLogic(ctx, { pertemuanId, revision: 0 });
  assert.equal(b.status, "READY");
});

await cek("revisi lain -> dokumen terpisah (versi baru)", async () => {
  const { ctx, pertemuanId } = await siapkan();
  await klaimLogic(ctx, { pertemuanId, revision: 0 });
  const b = await klaimLogic(ctx, { pertemuanId, revision: 1 });
  assert.equal(b.status, "DIKLAIM");
  assert.equal((await ctx.db.query("bapDoc").take(10)).length, 2);
});

console.log("bahan BAP:");

await cek("belum dikunci -> BELUM_DIKUNCI", async () => {
  const { ctx, pertemuanId } = await siapkan();
  await assert.rejects(
    bahanGenerateLogic(ctx, { pertemuanId }),
    (e) => String(e.data || e.message).includes("BELUM_DIKUNCI")
  );
});

await cek("hanya tidak hadir, kode A/S/I benar, urut gol A->D", async () => {
  const { ctx, token, ids, pertemuanId } = await siapkan({ peserta: 8 });
  const pola = ["ALPHA", "HADIR", "SAKIT", "HADIR", "IZIN", "ALPHA", "HADIR", "HADIR"];
  await simpanDanKunciLogic(ctx, {
    token, pertemuanId, baseRevision: 0,
    statuses: ids.map((pesertaId, i) => ({ pesertaId, status: pola[i] })),
  });
  const bahan = await bahanGenerateLogic(ctx, { pertemuanId });
  assert.equal(bahan.absen.length, 4);
  // urutan BAP: golongan A->D dulu, baru NIM/urut di dalam golongan
  assert.deepEqual(bahan.absen.map((a) => a.ket), ["A", "I", "A", "S"]);
  assert.deepEqual(bahan.absen.map((a) => a.nama), [
    "Mahasiswa 1", "Mahasiswa 5", "Mahasiswa 6", "Mahasiswa 3",
  ]);
  assert.deepEqual(bahan.absen.map((a) => a.gol), ["A", "A", "B", "C"]);
});

console.log("buka kunci:");

await cek("kunci -> buka: status TERBUKA, revisi tetap, audit tercatat", async () => {
  const { ctx, token, ids, pertemuanId } = await siapkan();
  await simpanDanKunciLogic(ctx, {
    token, pertemuanId, baseRevision: 0, statuses: status(ids, () => "HADIR"),
  });
  const hasil = await bukaKunciLogic(ctx, { token, pertemuanId });
  assert.equal(hasil.revision, 1);
  const p = await ctx.db.get(pertemuanId);
  assert.equal(p.status, "TERBUKA");
  assert.equal(p.revision, 1);
  const audit = await ctx.db.query("audit").take(10);
  assert.equal(audit.filter((a) => a.jenis === "BUKA_KUNCI").length, 1);
});

await cek("koreksi setelah buka -> revisi 2 (BAP baru)", async () => {
  const { ctx, token, ids, pertemuanId } = await siapkan();
  await simpanDanKunciLogic(ctx, {
    token, pertemuanId, baseRevision: 0, statuses: status(ids, () => "HADIR"),
  });
  await bukaKunciLogic(ctx, { token, pertemuanId });
  const hasil = await simpanDanKunciLogic(ctx, {
    token, pertemuanId, baseRevision: 1,
    statuses: status(ids, (i) => (i === 0 ? "SAKIT" : "HADIR")),
  });
  assert.equal(hasil.revision, 2);
});

console.log("detail:");

await cek("detail mengembalikan presensi tersimpan + status kunci", async () => {
  const { ctx, token, ids, pertemuanId } = await siapkan();
  await simpanDanKunciLogic(ctx, {
    token, pertemuanId, baseRevision: 0,
    statuses: status(ids, (i) => (i === 2 ? "IZIN" : "HADIR")),
  });
  const d = await detailLogic(ctx, { token, pertemuanId });
  assert.equal(d.pertemuan.status, "KUNCI");
  assert.equal(d.presensi.length, 3);
  assert.equal(d.presensi.filter((b) => b.status === "IZIN").length, 1);
});

console.log(`\n${lulus} pemeriksaan lulus`);
