/** In-memory context for targeted handler invariant tests; integration tests use real Convex. */
const INDEX = {
  sesi: { by_token: ["token"], by_pengguna: ["penggunaId"] },
  presensi: { by_pertemuan: ["pertemuanId"] },
  audit: { by_pertemuan: ["pertemuanId"], by_kelas: ["kelasId"] },
  bapDoc: { by_key: ["pertemuanId", "revision", "templateVersion"] },
  peserta: { by_gol: ["golongan", "urut"], by_kelas: ["kelasId"] },
  pertemuan: { by_nomor: ["nomor"], by_kelas: ["kelasId"] },
  template: { by_kelas_version: ["kelasId", "version"] },
  pengguna: { by_username: ["username"] },
  authAttempt: { by_key: ["key"] },
};

export function buatCtx() {
  const tabel = new Map();
  let seq = 0;
  const T = (n) => {
    if (!tabel.has(n)) tabel.set(n, new Map());
    return tabel.get(n);
  };
  const semua = (n) =>
    [...T(n).entries()].map(([id, d]) => ({ _id: id, ...d }));

  function query(nama) {
    const dasar = {
      withIndex(namaIdx, build) {
        const eq = {};
        const q = {
          eq(field, value) {
            eq[field] = value;
            return q;
          },
        };
        build(q);
        const fields = INDEX[nama][namaIdx] || [];
        const filter = (row) =>
          fields.every((f) => eq[f] === undefined || row[f] === eq[f]);
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
