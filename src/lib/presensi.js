import { bacaToken } from "./store.js";
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
      (golongan === null || p.golongan === golongan) &&
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
  if (text.includes("SNAPSHOT_TERLALU_BESAR"))
    return detail?.message || "Data sesi terlalu besar. Kurangi ukuran logo atau bagi peserta ke kelas lain. Presensi belum diubah.";
  if (/TOKEN_|TANPA_TOKEN/.test(text))
    return "Sesi berakhir. Masuk kembali; draf tetap ada di perangkat ini.";
  if (text.includes("KONFLIK_REVISI"))
    return "Data sudah berubah di perangkat lain. Periksa perubahan sebelum menyimpan.";
  if (/TANPA_PRAKTIKUM|UTS_UAS_TANPA_BAP/.test(text))
    return "Minggu teori, UTS, dan UAS tidak memiliki presensi atau BAP praktikum.";
  if (text.includes("BELUM_DIKUNCI"))
    return "Kunci presensi dulu sebelum membuat BAP.";
  if (/PESERTA_KURANG|PESERTA_ASING|PESERTA_DOBEL/.test(text))
    return "Daftar peserta tidak cocok dengan server. Muat ulang data kelas; draf tetap disimpan.";
  const messages = {
    BACKUP_IDENTITAS_TIDAK_VALID:"Identitas dalam backup tidak lengkap atau tidak valid.",
    BACKUP_TIDAK_VALID:"Isi backup tidak valid. Gunakan file hasil ekspor aplikasi.",
    BACKUP_PILIH_BAGIAN:"Bagian backup terlalu besar. Pilih satu versi pertemuan; pulihkan roster maksimal 500 peserta per kelompok terlebih dahulu, lalu ulangi bagian berikutnya.",
    BACKUP_PESERTA_DOBEL:"Pencocokan peserta menghasilkan ID atau NIM ganda. Periksa pilihan pemetaan.",
    BACKUP_PESERTA_ASING:"Peserta atau tujuan pemetaan bukan bagian dari backup/kelas ini.",
    BACKUP_LINTAS_KELAS_KONFIRMASI:"Sumber backup berbeda. Centang izin lintas kelas/deployment dan periksa pencocokan peserta terlebih dahulu.",
    BACKUP_DATA_BERUBAH:"Data berubah selama ekspor. Ulangi agar backup konsisten.",
    GUNAKAN_IDENTITAS_PER_KELAS:"Mata kuliah ini digunakan kelas di luar aksesmu. Ubah nama/kode melalui Identitas kelas.",
    GUNAKAN_EDITOR_ROSTER:"Klien ini belum mendukung pilihan pembaruan peserta. Muat ulang aplikasi dan pilih peserta yang akan diperbarui.",
    GUNAKAN_EDITOR_KOREKSI:"Gunakan editor koreksi dan pilih kategori yang akan diperbarui. Muat ulang aplikasi bila perlu.",
    KOREKSI_BELUM_AKTIF:"Editor koreksi belum diaktifkan untuk kelas ini.",
    IZIN_KELAS_KURANG:"Izin untuk tindakan ini belum diberikan pada kelas ini. Draf tetap disimpan.",
    PREVIEW_KOREKSI_BERUBAH:"Isi atau sumber data berubah. Periksa preview terbaru sebelum menyimpan.",
    CATATAN_KOREKSI_WAJIB:"Tambahkan catatan singkat untuk koreksi sesi bersejarah.",
    KOREKSI_TANPA_PERUBAHAN:"Belum ada perubahan untuk disimpan.",
    NOMOR_PERTEMUAN_DUPLIKAT:"Nomor pertemuan sudah digunakan sesi aktif lain. Pilih nomor berbeda.",
    PERIKSA_ROSTER_KOREKSI:"Periksa dan konfirmasikan daftar serta status peserta yang berubah.",
    REVISI_LAMA_PARSIAL:"Riwayat versi lama tidak lengkap; pemulihan otomatis belum dapat dilakukan. File arsip tetap tersedia.",
    PRESENSI_KOREKSI_TIDAK_LENGKAP:"Daftar status koreksi belum lengkap atau tidak sesuai peserta. Periksa kembali semua peserta.",
    PERTEMUAN_DIBATALKAN:"Sesi dibatalkan. Pulihkan terlebih dahulu untuk mengubah data atau membuat BAP aktif.",
    PILIH_PRESENSI_KEMBALI:"Pilih pulihkan presensi sebelumnya atau mulai kosong saat sesi kembali menjadi praktikum.",
    BATCH_RIWAYAT_BELUM_DIPILIH:"Aktifkan pilihan sesi bersejarah sebelum memasukkannya dalam perubahan massal.",
    BATCH_PERIKSA_ULANG:"Data berubah selama pengerjaan. Periksa ulang sisa pekerjaan sebelum melanjutkan.",
    BATCH_PILIH_LEWATI:"Ada sesi yang dibatalkan atau dihapus. Pilih lewati sesi tersebut pada preview agar sisa pekerjaan dapat dilanjutkan.",
    BATCH_TIDAK_ADA_YANG_DIPULIHKAN:"Tidak ada hasil batch yang dapat dipulihkan otomatis. Sesi mungkin sudah dipulihkan atau diubah lagi; periksa riwayatnya.",
    GUNAKAN_EDITOR_JADWAL:"Gunakan editor jadwal terbaru untuk mempertahankan revisi. Muat ulang aplikasi terlebih dahulu.",
    GUNAKAN_PEMBATALAN_SESI:"Sesi ini memiliki riwayat. Gunakan Batalkan pertemuan agar presensi dan arsip tetap tersimpan.",
    BATAS_SESI_AKTIF:"Kelas sudah memiliki 100 sesi aktif. Batalkan sesi yang tidak dipakai sebelum menambahkan lagi.",
    PAKET_TERLALU_BESAR:"Data paket terlalu besar. Pilih lebih sedikit pertemuan dan unduh dalam beberapa paket; revisi serta arsip tetap utuh.",
    KUNCI_OPERASI_DIPAKAI:"Identitas penyimpanan telah digunakan. Muat versi terbaru dan periksa ulang draf.",
    AKSES_DITOLAK: "Akunmu tidak memiliki izin untuk tindakan ini.",
    ADMIN_TERAKHIR: "Harus tetap ada setidaknya satu admin aktif.",
    KELAS_DIARSIPKAN: "Kelas diarsipkan. Pulihkan kelas sebelum mengubah data.",
    PASSWORD_MIN_12: "Gunakan password 12–128 karakter.",
    PASSWORD_SALAH: "Username atau password tidak sesuai.",
    NIM_SUDAH_ADA:
      "NIM sudah ada di kelas ini. Ubah data mahasiswa yang tersedia.",
    JADWAL_TERKUNCI: "Jadwal yang memiliki riwayat presensi dipertahankan.",
    KONFIRMASI_PERUBARUI:
      "Periksa dan setujui perubahan mahasiswa sebelum impor.",
    WAJIB_GANTI_PASSWORD: "Ganti password sementara sebelum melanjutkan.",
    USERNAME_SUDAH_ADA: "Username sudah dipakai. Pilih username lain.",
  };
  for (const [code, message] of Object.entries(messages))
    if (text.includes(code)) return message;
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
  const response = await authenticatedDocument(url);
  if (!response.ok) throw new Error("Unduhan gagal");
  const blob = await response.blob();
  unduhBlob(blob, fileName);
}
export async function authenticatedDocument(url) {
  const target = new URL(url, window.location.href);
  const backend = import.meta.env?.VITE_CONVEX_URL;
  const expected = backend
    ? new URL(backend).hostname.replace(/\.convex\.cloud$/, ".convex.site")
    : "";
  return fetch(
    url,
    target.hostname === expected && target.pathname === "/documents"
      ? { headers: { Authorization: `Bearer ${bacaToken()}` } }
      : {},
  );
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
