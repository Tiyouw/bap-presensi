/** In-memory context for targeted handler invariant tests; integration tests use real Convex. */
const INDEX = {
  sesi: { by_token: ["token"], by_pengguna: ["penggunaId"] },
  presensi: { by_pertemuan: ["pertemuanId"] },
  audit: { by_pertemuan: ["pertemuanId"], by_kelas: ["kelasId"], by_kelas_pada: ["kelasId", "pada"] },
  bapDoc: { by_key: ["pertemuanId", "revision", "templateVersion"] },
  peserta: { by_gol: ["golongan", "urut"], by_kelas: ["kelasId"] },
  pertemuan: { by_nomor: ["nomor"], by_kelas: ["kelasId"] },
  template: { by_kelas_version: ["kelasId", "version"] },
  pengguna: { by_username: ["username"] },
  authAttempt: { by_key: ["key"] },
  matkul: { by_creator: ["dibuatOleh"] },
  kelas: { by_matkul: ["matkulId"] },
  classView: { by_kelas: ["kelasId"], by_matkul: ["matkulId"] },
  meetingView: { by_kelas: ["kelasId"], by_source: ["sourceId"] },
  templateView: { by_kelas_version: ["kelasId", "version"], by_source: ["sourceId"] },
  searchEntry: { by_kelas: ["kelasId"], by_source: ["sourceId"] },
  documentView: { by_source: ["sourceId"], by_kelas_pada: ["kelasId", "pada"], by_pertemuan_format_revision: ["pertemuanId", "format", "revision", "pada"] },
  migrasi: { by_versi: ["versi"] },
  meetingRevision: { by_meeting_revision:["pertemuanId","revision"], by_class:["kelasId"], by_operation:["pertemuanId","operationKey"] },
  revisionRows: { by_revision:["revisionId","part"] },
  revisionPayload: { by_revision:["revisionId"] },
  featureFlag: { by_key:["key"] },
  classCapability: { by_class_user:["kelasId","penggunaId"] },
  impor: { by_kelas: ["kelasId"], by_kelas_pada: ["kelasId", "pada"] },
};

export function buatCtx() {
  const tabel = new Map();
  let seq = 0;
  const reads = [];
  const T = (n) => {
    if (!tabel.has(n)) tabel.set(n, new Map());
    return tabel.get(n);
  };
  const semua = (n) =>
    [...T(n).entries()].map(([id, d]) => ({ _id: id, ...d }));

  function query(nama, filter = () => true, fields = [], direction = "asc") {
    const rows = () => semua(nama).filter(filter).sort((a,b) => {
      for (const k of fields) {
        if (a[k] === b[k]) continue;
        return (a[k] < b[k] ? -1 : 1) * (direction === "desc" ? -1 : 1);
      }
      return 0;
    });
    const read = (kind, result) => { reads.push({ table: nama, kind, count: result.length }); return result; };
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
        const fields = INDEX[nama]?.[namaIdx];
        if (!fields) throw Error(`Unknown test index: ${nama}.${namaIdx}`);
        const filter = (row) =>
          fields.every((f) => eq[f] === undefined || row[f] === eq[f]);
        return query(nama, filter, fields);
      },
      withSearchIndex(name, build) {
        const eq={}, search={field:null,value:""};
        const q={search(field,value){search.field=field;search.value=value;return q;},eq(field,value){eq[field]=value;return q;}};
        build(q);
        return query(nama, row => Object.entries(eq).every(([k,v])=>row[k]===v) && search.value.toLowerCase().split(/\s+/).some(t=>String(row[search.field]).toLowerCase().includes(t)));
      },
      order: value => query(nama, filter, fields, value),
      unique: async () => read("unique", rows().slice(0,1))[0] ?? null,
      take: async n => read("take", rows().slice(0,n)),
      collect: async () => read("collect", rows()),
      paginate: async ({cursor,numItems}) => {
        const offset=Number(cursor||0), all=rows(), page=read("paginate",all.slice(offset,offset+numItems));
        return {page,isDone:offset+numItems>=all.length,continueCursor:String(offset+page.length)};
      },
    };
    return dasar;
  }

  return {
    tabel,
    reads,
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
