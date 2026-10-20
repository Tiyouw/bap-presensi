import { logoDimensions } from "./logo.js";
export const ROLES = ["ADMIN", "PENGELOLA", "OPERATOR"];
export const TYPES = ["REGULER", "TEORI", "UTS", "UAS", "LIBUR"];
export const DEFAULT_TEMPLATE = {
  institusi: "KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI",
  unit: "POLITEKNIK NEGERI JEMBER",
  jurusan: "JURUSAN BAHASA KOMUNIKASI DAN PARIWISATA",
  alamat: "Jalan Mastrip Kotak Pos 164 Jember 68101 Telp. (0331) 33353-34 Fax. (0331) 333531",
  kontak: "Email: politeknik@polije.ac.id; Laman: www.polije.ac.id",
  judul:
    "DAFTAR HADIR PEMBIMBING PRAKTIK LABORATORIUM DAN LAPANG DAN BERITA ACARA PRAKTIK",
  labelDosen: "",
  labelAsdos: "",
  logo: "",
};
export function text(value, label, max = 160, required = true) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new Error(
      `${label} wajib diisi dengan benar (maksimum ${max} karakter).`,
    );
  return value.trim();
}
export function validDate(value) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw new Error("Tanggal tidak valid.");
  return value;
}
export function normalizeRoster(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 2000)
    throw new Error("Impor harus berisi 1–2000 baris.");
  const seen = new Set();
  return rows.map((row, i) => {
    const nim = text(String(row.nim ?? ""), `NIM baris ${i + 1}`, 40);
    if (seen.has(nim.toLocaleUpperCase()))
      throw new Error(`NIM duplikat: ${nim}`);
    seen.add(nim.toLocaleUpperCase());
    return {
      nim,
      nama: text(row.nama, `Nama baris ${i + 1}`),
      golongan: text(String(row.golongan || "Umum"), "Golongan", 30),
    };
  });
}
export function validateTemplate(config) {
  const result = {};
  for (const [key, fallback] of Object.entries(DEFAULT_TEMPLATE)) {
    result[key] = text(
      config?.[key] ?? fallback,
      key,
      key === "logo" ? 500000 : key === "judul" ? 240 : 180,
      !["logo", "alamat", "jurusan", "kontak", "labelDosen", "labelAsdos"].includes(key),
    );
  }
  if (
    result.logo &&
    !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(result.logo)
  )
    throw new Error("Logo harus PNG/JPEG maksimum 350 KB.");
  if (result.logo) logoDimensions(result.logo);
  return result;
}
export function weeklySchedule(
  start,
  count = 16,
  preset = "PPB",
  tempat = "F6",
) {
  validDate(start);
  if (!Number.isInteger(count) || count < 1 || count > 52)
    throw new Error("Jumlah minggu 1–52.");
  return Array.from({ length: count }, (_, i) => ({
    nomor: i + 1,
    tanggal: new Date(Date.parse(start + "T00:00:00Z") + i * 604800000)
      .toISOString()
      .slice(0, 10),
    tempat,
    tipe:
      preset === "PPB"
        ? i === 0
          ? "TEORI"
          : i === 7
            ? "UTS"
            : i === 15
              ? "UAS"
              : "REGULER"
        : "REGULER",
  }));
}
export function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .trim();
}
export function matches(value, query) {
  return fold(query)
    .split(/\s+/)
    .every((part) => fold(value).includes(part));
}
export function previewRoster(rows, mapping, existing = []) {
  const seen = new Set();
  return rows.map((row, index) => {
    const item = {
      nim: String(row[mapping.nim] ?? "").trim(),
      nama: String(row[mapping.nama] ?? "").trim(),
      golongan: String(row[mapping.golongan] ?? "Umum").trim() || "Umum",
    };
    let error = "";
    if (!item.nim || !item.nama) error = "NIM dan nama wajib diisi";
    else if (
      item.nim.length > 40 ||
      item.nama.length > 160 ||
      item.golongan.length > 30
    )
      error = "Teks melebihi batas";
    else if (seen.has(item.nim.toUpperCase()))
      error = "NIM duplikat dalam file";
    seen.add(item.nim.toUpperCase());
    const old = existing.find(
      (p) => p.nim.toUpperCase() === item.nim.toUpperCase(),
    );
    return {
      ...item,
      row: index + 2,
      error,
      action: old
        ? old.nama === item.nama && old.golongan === item.golongan
          ? "Tetap"
          : "Perbarui"
        : "Tambah",
    };
  });
}
