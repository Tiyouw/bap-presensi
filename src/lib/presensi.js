export const URUT_STATUS = ["ALPHA", "SAKIT", "IZIN", "HADIR"];
export const LABEL = {
  HADIR: "Hadir",
  ALPHA: "Alpha",
  SAKIT: "Sakit",
  IZIN: "Izin",
};
export const KODE = { HADIR: "H", ALPHA: "A", SAKIT: "S", IZIN: "I" };

export const KELAS = {
  nama: "Pengantar Pariwisata Budaya",
  prodi: "Destinasi Pariwisata",
  semester: "Semester 3 · Gasal 2026/2027",
  kode: "PPB",
};

export function statusAwal(peserta, presensi = []) {
  const result = Object.fromEntries(peserta.map((p) => [p.id, "HADIR"]));
  for (const item of presensi) {
    if (
      Object.prototype.hasOwnProperty.call(result, item.pesertaId) &&
      LABEL[item.status]
    )
      result[item.pesertaId] = item.status;
  }
  return result;
}

export function drafValid(draf, peserta) {
  return Boolean(
    draf &&
      Number.isFinite(draf.baseRevision) &&
      draf.statuses &&
      peserta.length > 0 &&
      peserta.every((p) => LABEL[draf.statuses[p.id]]),
  );
}

export function hitungStatus(peserta, statuses) {
  const result = { HADIR: 0, ALPHA: 0, SAKIT: 0, IZIN: 0 };
  for (const p of peserta) if (LABEL[statuses[p.id]]) result[statuses[p.id]]++;
  return result;
}

export function cariPeserta(peserta, golongan, cari) {
  const query = cari.trim().toLocaleLowerCase("id-ID");
  return peserta.filter(
    (p) =>
      (golongan === "SEMUA" || p.golongan === golongan) &&
      (!query ||
        `${p.nama} ${p.nim}`.toLocaleLowerCase("id-ID").includes(query)),
  );
}

export function pesanGalat(err) {
  const detail = err?.data;
  const text =
    typeof detail === "object" && detail !== null
      ? String(detail.code || detail.message || "")
      : String(detail || err?.message || err);
  if (/TOKEN_|TANPA_TOKEN/.test(text))
    return "Sesi berakhir. Masuk kembali; draf tetap ada di perangkat ini.";
  if (text.includes("KONFLIK_REVISI"))
    return "Data sudah berubah di perangkat lain. Periksa perubahan sebelum menyimpan.";
  if (text.includes("BELUM_DIKUNCI"))
    return "Kunci presensi dulu sebelum membuat BAP.";
  if (/PESERTA_KURANG|PESERTA_ASING|PESERTA_DOBEL/.test(text))
    return "Daftar peserta tidak cocok dengan server. Muat ulang data kelas; draf tetap disimpan.";
  if (text.includes("BUSY"))
    return "BAP sedang diproses. Kamu dapat memeriksanya lagi sebentar.";
  if (text.includes("GENERATE_GAGAL"))
    return "BAP gagal dibuat. Presensi tetap tersimpan; coba buat BAP lagi.";
  if (text.includes("PAKET_BERUBAH"))
    return "Presensi berubah atau dibuka kuncinya. Periksa pilihan terbaru, lalu unduh paket lagi.";
  if (text.includes("PAKET_GAGAL"))
    return "Paket cetak belum berhasil dibuat. Pilihan tetap ada; coba lagi.";
  return "Permintaan belum berhasil. Periksa koneksi dan coba lagi. Draf tetap ada di perangkat ini.";
}

export async function unduhDokumen(url, fileName) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unduhan gagal");
  const blob = await response.blob();
  unduhBlob(blob, fileName);
}

export function unduhPaket(base64, fileName) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  unduhBlob(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    fileName,
  );
}

function unduhBlob(blob, fileName) {
  const localUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = localUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(localUrl), 30_000);
}

export function hariIni() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
