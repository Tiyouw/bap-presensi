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
  detail: (id) => `bap.cache.detail.${id}`,
  backup: (id) => `bap.draft.backup.${id}`,
  panggil: (id) => `bap.panggil.preferences.${id}`,
};

export function bacaToken() {
  try {
    return localStorage.getItem(K.token) || "";
  } catch {
    return "";
  }
}
export function simpanToken(t) {
  try {
    localStorage.setItem(K.token, t);
    return true;
  } catch {
    return false;
  }
}
export function hapusToken() {
  try {
    localStorage.removeItem(K.token);
  } catch {
    /* memory session can still end */
  }
}

export function simpanCache(data, scope = "") {
  try {
    localStorage.setItem(
      scope ? `${K.cache}.${scope}` : K.cache,
      JSON.stringify(data),
    );
  } catch {
    /* kuota penuh: cache boleh hilang, draf tidak */
  }
}
export function bacaCache(scope = "") {
  try {
    const data = JSON.parse(
      localStorage.getItem(scope ? `${K.cache}.${scope}` : K.cache) || "null",
    );
    return Array.isArray(data?.peserta) && Array.isArray(data?.pertemuan)
      ? data
      : null;
  } catch {
    return null;
  }
}

export function simpanDraf(pertemuanId, { baseRevision, statuses, panggil }) {
  try {
    localStorage.setItem(
      K.draft(pertemuanId),
      JSON.stringify({ baseRevision, statuses, panggil, ts: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

export function bacaPreferensiPanggil(id) {
  try {
    return (
      JSON.parse(localStorage.getItem(K.panggil(id)) || "null")?.auto !== false
    );
  } catch {
    return true;
  }
}

export function bacaKeluarOtomatisPanggil(id) {
  try {
    return (
      JSON.parse(localStorage.getItem(K.panggil(id)) || "null")?.autoExit !==
      false
    );
  } catch {
    return true;
  }
}

export function simpanPreferensiPanggil(id, auto, autoExit) {
  try {
    let previous = {};
    try {
      previous =
        JSON.parse(localStorage.getItem(K.panggil(id)) || "null") || {};
    } catch {
      /* replace malformed preferences */
    }
    localStorage.setItem(
      K.panggil(id),
      JSON.stringify({
        ...previous,
        auto,
        ...(typeof autoExit === "boolean" ? { autoExit } : {}),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function bacaDraf(pertemuanId) {
  try {
    return JSON.parse(localStorage.getItem(K.draft(pertemuanId)) || "null");
  } catch {
    return null;
  }
}
export function hapusDraf(pertemuanId) {
  try {
    localStorage.removeItem(K.draft(pertemuanId));
  } catch {
    /* preserve on storage failure */
  }
}

export function bacaDetail(id) {
  try {
    return JSON.parse(localStorage.getItem(K.detail(id)) || "null");
  } catch {
    return null;
  }
}

export function simpanDetail(id, detail) {
  try {
    localStorage.setItem(K.detail(id), JSON.stringify(detail));
  } catch {
    /* optional cache */
  }
}

export function cadangkanDraf(id, draf) {
  try {
    localStorage.setItem(
      K.backup(id),
      JSON.stringify({ ...draf, ts: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

/** "2026-09-28" -> "Senin / 28 September 2026" (sama dengan server). */
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
export function hariTanggal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${HARI[dt.getUTCDay()]} / ${d} ${BULAN[m - 1]} ${y}`;
}
