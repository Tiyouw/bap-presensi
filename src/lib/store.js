/**
 * Draf lokal + cache bootstrap.
 *
 * Kenapa localStorage dan bukan state DB: setiap ketukan tombol tidak boleh
 * jadi mutation. Satu mutation hanya di akhir (`simpanDanKunci`). Draf disimpan
 * per pertemuan supaya pindah sesi tidak menghapus pekerjaan.
 *
 * Yang DIJANJIKAN: draf bertahan saat app ditutup/refresh/offline.
 * Yang TIDAK dijanjikan: generate dokumen saat offline (butuh server).
 */
const K = {
  token: "bap.token",
  cache: "bap.cache.bootstrap",
  draft: (id) => `bap.draft.${id}`,
};

export function bacaToken() {
  return localStorage.getItem(K.token) || "";
}
export function simpanToken(t) {
  localStorage.setItem(K.token, t);
}
export function hapusToken() {
  localStorage.removeItem(K.token);
}

export function simpanCache(data) {
  try {
    localStorage.setItem(K.cache, JSON.stringify(data));
  } catch {
    /* kuota penuh: cache boleh hilang, draf tidak */
  }
}
export function bacaCache() {
  try {
    return JSON.parse(localStorage.getItem(K.cache) || "null");
  } catch {
    return null;
  }
}

export function simpanDraf(pertemuanId, { baseRevision, statuses }) {
  localStorage.setItem(
    K.draft(pertemuanId),
    JSON.stringify({ baseRevision, statuses, ts: Date.now() })
  );
}
export function bacaDraf(pertemuanId) {
  try {
    return JSON.parse(localStorage.getItem(K.draft(pertemuanId)) || "null");
  } catch {
    return null;
  }
}
export function hapusDraf(pertemuanId) {
  localStorage.removeItem(K.draft(pertemuanId));
}

/** "2026-09-28" -> "Senin / 28 September 2026" (sama dengan server). */
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
export function hariTanggal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${HARI[dt.getUTCDay()]} / ${d} ${BULAN[m - 1]} ${y}`;
}
