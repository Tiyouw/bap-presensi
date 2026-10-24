// One source for short hints, detailed help and guided tours. No class data or secrets.
const topic = (title, summary, body, areas, extra = {}) => ({
  title,
  summary,
  body,
  areas,
  ...extra,
});
export const HELP_VERSION = 1;
export const HELP_AREAS = {
  home: "Mulai & navigasi",
  kelas: "Pertemuan kelas",
  presensi: "Presensi",
  koreksi: "Koreksi sesi",
  jadwal: "Jadwal",
  mahasiswa: "Mahasiswa",
  template: "Template BAP",
  pengaturan: "Pengaturan kelas",
  riwayat: "Riwayat",
  dokumen: "Dokumen & cetak",
  akun: "Akses akun",
  profil: "Akun saya",
  login: "Masuk & pemulihan",
};
export const HELP_TOPICS = {
  navigation: topic(
    "Cari kelas dan fitur",
    "Pencarian hanya menampilkan data sesuai akses akunmu.",
    [
      "Pilih kelas sebelum bekerja agar mahasiswa, jadwal dan dokumen yang dipakai benar.",
      "Gunakan pencarian di navbar atau Ctrl+K (Windows) / ⌘K (Mac). Pencarian bantuan di panel ini hanya mencari penjelasan fitur, tidak membaca data kelas lain.",
    ],
    ["home", "kelas"],
  ),
  preparation: topic(
    "Siapkan dan aktifkan kelas",
    "Lengkapi identitas, mahasiswa, jadwal dan template, lalu aktifkan kelas.",
    [
      "Kelas draf menyimpan persiapan; presensi server baru dapat digunakan setelah kelas diaktifkan.",
      "Periksa dosen, peserta aktif, jadwal praktikum dan template terbit sebelum aktivasi. Salin kelas membantu persiapan semester berikutnya; data presensi kelas asal tetap terpisah.",
    ],
    ["home", "pengaturan"],
    { manage: true },
  ),
  attendance: topic(
    "Cara menandai presensi",
    "Status awal Hadir. Pilih Alpha, Sakit atau Izin, lalu tandai mahasiswa yang sesuai.",
    [
      "Periksa nomor dan tanggal pertemuan terlebih dahulu. Cari nama/NIM atau gunakan filter golongan untuk mempersempit daftar.",
      "Urungkan membatalkan perubahan lokal terbaru yang masih tersedia. Periksa seluruh kelas sebelum Simpan & Kunci; filter bukan pilihan mahasiswa yang ikut disimpan.",
    ],
    ["presensi", "kelas"],
  ),
  statuses: topic(
    "Arti status presensi",
    "Hadir, Alpha, Sakit dan Izin adalah status yang akan dipakai pada BAP.",
    [
      "Hadir berarti mengikuti pertemuan; Alpha berarti tidak hadir tanpa keterangan, sedangkan Sakit dan Izin mengikuti keterangan yang dicatat pengelola.",
      "Pilih status lalu ketuk nama mahasiswa. Periksa perubahan dan pastikan status sesuai informasi sebenarnya sebelum menyimpan.",
    ],
    ["presensi"],
  ),
  localDraft: topic(
    "Draf perangkat dan data server",
    "Draf berada di browser/perangkat ini sampai kamu menyimpannya ke server.",
    [
      "Reload dapat memulihkan draf bila penyimpanan browser tersedia. Draf tidak otomatis berpindah ke perangkat lain; bila tersedia, gunakan Unduh draf dan muat file pada akun/kelas/server yang sesuai.",
      "Jika penyimpanan perangkat gagal, pertahankan halaman terbuka dan unduh draf. Mode privat atau pembersihan data browser dapat menghapus draf. Membaca bantuan tidak menyimpan, membuang atau menerbitkan draf.",
    ],
    ["presensi", "koreksi", "jadwal"],
  ),
  discard: topic(
    "Buang draf",
    "Membuang perubahan lokal yang belum diterapkan; data yang sudah tersimpan di server tetap ada.",
    [
      "Gunakan untuk kembali ke keadaan sesi/jadwal yang berlaku. Unduh draf dahulu bila isinya masih dibutuhkan.",
      "Pekerjaan jadwal yang sudah diterima server dan revisi yang sudah terbit tetap tersedia. Draf operasi selesai tidak dipublikasikan ulang otomatis; memakai isinya lagi memerlukan pilihan eksplisit dan preview baru.",
    ],
    ["koreksi", "jadwal"],
    { feature: true },
  ),
  lock: topic(
    "Periksa, simpan dan kunci",
    "Simpan & Kunci mengirim seluruh presensi sesi dan menyiapkan versi untuk BAP.",
    [
      "Periksa jumlah serta nama mahasiswa yang tidak hadir sebelum konfirmasi. Simpan server memerlukan koneksi dan akses yang masih berlaku.",
      "Pembuatan Word/PDF adalah langkah terpisah. Jika generator gagal, presensi yang berhasil disimpan tetap ada dan pembuatan dokumen dapat dicoba lagi.",
    ],
    ["presensi", "kelas"],
  ),
  correction: topic(
    "Koreksi sesi bersejarah",
    "Periksa dampak, lalu simpan perubahan sebagai revisi baru dengan riwayat tetap tersedia.",
    [
      "Gunakan Tanggal & data sesi atau Koreksi sesi pada Jadwal. Editor memisahkan draf dari sesi yang sedang berlaku; membuka editor tidak membuka kunci untuk semua pengguna.",
      "Tanggal, ruang, nomor, jenis dan status yang boleh diubah mengikuti izin kelas. Catatan perubahan menjelaskan alasan koreksi. Dokumen versi lama tetap tersedia; buat Word/PDF baru setelah revisi tersimpan.",
    ],
    ["koreksi", "presensi", "jadwal", "riwayat"],
    { feature: true, any: ["schedule", "history"] },
  ),
  date: topic(
    "Tanggal pelaksanaan",
    "Mengubah tanggal saja mempertahankan presensi dan data kelas yang dipakai pada versi sesi.",
    [
      "Tanggal adalah hari pelaksanaan sesi, bukan tanggal file diunduh. Untuk sesi bersejarah gunakan editor koreksi jika fitur revisi tersedia.",
      "Mengganti tanggal saja tidak otomatis mengganti dosen, daftar mahasiswa atau template. Penerapan data kelas terbaru dipilih terpisah. Tanggal yang sama atau urutan tanggal tidak biasa dapat memunculkan peringatan untuk diperiksa.",
    ],
    ["jadwal", "koreksi"],
  ),
  number: topic(
    "Nomor pertemuan",
    "Nomor mengidentifikasi minggu/pertemuan dalam kelas; nomor aktif harus unik.",
    [
      "Nomor pertemuan tidak harus mengikuti urutan tanggal pelaksanaan, tetapi periksa peringatan sebelum menyimpan.",
      "Jika nomor berbenturan ketika sesi dipulihkan, pilih nomor lain. Mengubah nomor pada versi baru tidak menulis ulang nomor asal dokumen lama.",
    ],
    ["jadwal", "koreksi"],
  ),
  snapshot: topic(
    "Data kelas yang dipakai sesi",
    "Pilih identitas, daftar mahasiswa atau template yang ingin diperbarui secara eksplisit.",
    [
      "Sesi bersejarah mempertahankan data kelas saat versinya disimpan. Mengedit kelas sekarang tidak otomatis mengubah semua BAP lama.",
      "Pada editor koreksi, pilih kategori terbaru yang diperlukan. Bagian yang tidak dipilih tetap memakai versi sesi sebelumnya. Perubahan daftar mahasiswa perlu review identitas dan status, termasuk peserta baru.",
    ],
    ["koreksi", "pengaturan", "template", "mahasiswa"],
    { feature: true },
  ),
  conflict: topic(
    "Ada versi yang lebih baru",
    "Drafmu dipertahankan; tinjau data terbaru sebelum menyimpan lagi.",
    [
      "Pengguna lain atau tab lain dapat mengubah data ketika editormu masih terbuka. Aplikasi menolak penyimpanan berdasarkan versi yang sudah usang.",
      "Pada editor yang menyediakan Bawa draf ke versi terbaru, gunakan lalu periksa selisih lagi. Muat ulang biasa dapat menawarkan membuang perubahan: unduh/salin pekerjaan penting sebelum menyetujui. Jangan membuka dua editor untuk menimpa konflik.",
    ],
    ["koreksi", "jadwal", "presensi", "pengaturan"],
  ),
  offline: topic(
    "Bekerja saat offline",
    "Draf yang sudah tersedia dapat disunting; simpan server dan pembuatan BAP memerlukan koneksi.",
    [
      "Data perangkat mungkin tertinggal dari server. Sesudah tersambung, aplikasi memeriksa kembali versi dan izin sebelum menyimpan.",
      "Penjelasan bantuan tetap dapat dibaca setelah aplikasi tersimpan untuk offline. Tur yang targetnya belum tersedia tidak memindahkanmu atau menjalankan operasi server.",
    ],
    ["home", "presensi", "koreksi", "jadwal"],
  ),
  calling: topic(
    "Mode Panggil",
    "Periksa mahasiswa satu per satu per golongan; hasil tetap menjadi draf presensi kelas.",
    [
      "Pilih golongan, tandai Hadir/Alpha/Sakit/Izin dan lanjutkan kartu. Lewati dulu tidak menambah progress pemeriksaan. Shortcut 1–4 memilih status; panah memindahkan kartu sesuai kontrol yang tersedia.",
      "Menutup Mode Panggil mempertahankan draf dan posisi. Simpan & Kunci tetap dilakukan melalui review seluruh kelas. Bantuan di Mode Panggil menjeda perpindahan otomatis dan hitung mundur.",
    ],
    ["presensi"],
  ),
  schedule: topic(
    "Jadwal dan tanggal pertemuan",
    "Tambahkan kartu pertemuan, atur isinya, lalu simpan jadwal sekaligus.",
    [
      "Kartu baru tetap tertutup. Kartu pertama memakai hari ini; kartu selanjutnya mengikuti tanggal kartu sebelumnya +7 hari. Menambah lebih dari 16 pertemuan memerlukan konfirmasi. Periksa nomor, tanggal, ruang dan jenis sebelum Simpan jadwal. Teori, UTS, UAS dan Libur tidak memakai BAP praktikum aktif.",
      "Sesi kosong tanpa riwayat dapat ditambah/dihapus sesuai izin. Sesi yang memiliki riwayat menggunakan pembatalan/pemulihan agar arsip tidak hilang.",
    ],
    ["jadwal", "kelas"],
  ),
  bulk: topic(
    "Perubahan tanggal pertemuan",
    "Isi tanggal pada sesi yang perlu disesuaikan, lalu periksa perbandingan sebelum menyimpan.",
    [
      "Isi tanggal baru pada sesi tanpa riwayat. Untuk sesi bersejarah, buka Edit rincian lalu periksa selisih sebelum menyimpan.",
      "Perubahan kecil disimpan bersama; pekerjaan besar diproses bertahap. Hasil yang sudah selesai tetap ada bila pekerjaan dihentikan atau halaman ditutup. Lihat status tiap sesi, lalu lanjutkan/tinjau konflik; jangan menganggap semua berhasil dari satu pesan penerimaan.",
    ],
    ["jadwal"],
    { feature: true, any: ["schedule"] },
  ),
  batchRecovery: topic(
    "Lanjutkan, hentikan sisa dan undo",
    "Pekerjaan tersimpan dapat dilanjutkan; undo membuat perubahan kompensasi pada hasil yang masih sesuai.",
    [
      "Konflik menghentikan sisa pekerjaan untuk diperiksa. Sesi yang tidak tersedia dapat dilewati secara eksplisit. Menghentikan sisa tidak membatalkan sesi yang sudah berhasil.",
      "Undo hanya memulihkan hasil pekerjaan yang belum diedit lagi. Periksa laporan per sesi; pemulihan tetap menambah riwayat.",
    ],
    ["jadwal"],
    { feature: true, any: ["schedule"] },
  ),
  lifecycle: topic(
    "Batalkan dan pulihkan pertemuan",
    "Pembatalan mengeluarkan sesi dari rekap/paket aktif; riwayat dan file lama tetap tersedia.",
    [
      "Berikan alasan, periksa dampak, lalu simpan. Pertemuan yang dibatalkan dapat ditemukan kembali pada pilihan tampilkan dibatalkan atau riwayat yang relevan.",
      "Pulihkan sebagai revisi baru dan periksa tanggal, nomor serta jenis yang berlaku. Membuka editor saja tidak memulihkan sesi atau mengaktifkan kelas arsip.",
    ],
    ["koreksi", "jadwal", "riwayat"],
    { feature: true, any: ["lifecycle"] },
  ),
  meetingType: topic(
    "Jenis pertemuan dan presensi lama",
    "Hanya Praktikum yang masuk BAP aktif. Riwayat tetap ada saat jenis diubah.",
    [
      "Praktikum dapat diubah menjadi Teori/UTS/UAS/Libur sesuai izin. Presensi dan dokumen lamanya tetap menjadi riwayat.",
      "Ketika kembali ke Praktikum, pilih pulihkan presensi lama atau mulai kosong secara eksplisit. Mulai kosong memerlukan pencatatan/review baru; jangan menganggapnya otomatis siap dicetak.",
    ],
    ["jadwal", "koreksi"],
  ),
  history: topic(
    "Riwayat, pelaku dan revisi",
    "Setiap revisi menyimpan data asal, pelaku, waktu dan alasan perubahan.",
    [
      "Lihat perubahan untuk membandingkan nilai sebelum/sesudah. Muat halaman lebih lama bila revisi yang dicari belum terlihat.",
      "Dokumen historis memakai versi asal. Riwayat lama yang datanya tidak lengkap ditandai parsial; nomor asal yang tidak dapat dibuktikan tidak dianggap nomor historis yang pasti.",
    ],
    ["riwayat", "koreksi", "dokumen", "kelas"],
  ),
  restoreRevision: topic(
    "Pulihkan revisi sebelumnya",
    "Menyalin nilai versi pilihan menjadi revisi baru; versi sesudahnya tetap tersimpan.",
    [
      "Pilih versi, berikan catatan dan periksa seluruh dampak sebelum menyimpan. Nomor revisi tidak dimundurkan dan jejak perubahan tidak dihapus.",
      "Versi legacy parsial yang tidak memiliki seluruh status tidak dapat dipulihkan otomatis. Dokumen lama yang masih tersedia tetap dapat diunduh sesuai akses.",
    ],
    ["koreksi", "riwayat"],
    { feature: true, any: ["history"] },
  ),
  identity: topic(
    "Identitas kelas dan dosen",
    "Perubahan kelas berlaku ke depan; penerapan ke sesi bersejarah dipilih terpisah.",
    [
      "Periksa mata kuliah, kelas, semester, tahun akademik, program studi, dosen/asisten dan ruang. Nama/kode mata kuliah per kelas membantu menghindari perubahan pada kelas lain.",
      "Kelas yang telah mempunyai sesi bersejarah tetap mempertahankan data asal pada versinya. Jika fitur revisi tersedia, gunakan editor koreksi untuk menerapkan kategori identitas terbaru bila diperlukan.",
    ],
    ["pengaturan", "home"],
    { any: ["identity"], manageLegacy: true },
  ),
  roster: topic(
    "Tambah, ubah dan nonaktifkan mahasiswa",
    "Identitas peserta memakai ID stabil; mengubah NIM tidak memutus riwayatnya.",
    [
      "Periksa nama, NIM, golongan dan keaktifan. Menonaktifkan peserta mengeluarkannya dari daftar aktif ke depan, sambil mempertahankan identitas/status pada versi historis.",
      "Aktifkan kembali bila peserta yang sama kembali mengikuti kelas. Terapkan daftar mahasiswa terbaru ke sesi lama hanya melalui pilihan dan review yang sesuai.",
    ],
    ["mahasiswa"],
  ),
  import: topic(
    "Impor dan pembaruan terpilih",
    "Periksa pratinjau NIM/nama/golongan; pilih pembaruan dan reaktivasi yang benar-benar diperlukan.",
    [
      "Gunakan header NIM, Nama dan Golongan pada Excel/CSV. Simpan NIM sebagai teks agar nol awal tidak hilang sebelum file diimpor.",
      "Baris baru ditambah sesuai preview. Untuk peserta yang sudah ada, pilih perubahan identitas/reaktivasi pada preview. Tinjau duplikasi, format salah dan hasil sebagian sebelum menganggap impor selesai.",
    ],
    ["mahasiswa"],
    { any: ["roster"], manageLegacy: true },
  ),
  template: topic(
    "Draf dan versi template BAP",
    "Preview muncul otomatis dari isi editor. Saat persiapan kelas, simpan template lalu lanjutkan ke tinjauan akhir.",
    [
      "Preview tidak menyimpan perubahan. Periksa identitas, logo, tanda tangan dan susunan dokumen, lalu simpan. Pada kelas aktif, Simpan draf tetap terpisah dari Terbitkan versi baru.",
      "Sesi bersejarah tetap memakai template asal. Pada fitur revisi, penerapan template lain/terbaru dipilih secara eksplisit; file BAP lama tidak ditulis ulang.",
    ],
    ["template"],
    { any: ["template"], manageLegacy: true },
  ),
  permissions: topic(
    "Izin Operator per kelas",
    "Izin tambahan hanya berlaku pada kelas yang ditugaskan; server memeriksa akses setiap tindakan.",
    [
      "Presensi awal tetap mengikuti akses akun. Pengelola/Admin dapat memberi atau mencabut kemampuan jadwal, roster, identitas, template, lifecycle, ekspor dan koreksi historis sesuai kewenangannya.",
      "Izin historis lama dapat dipertahankan sebelum dikonfigurasi; konfigurasi kosong mencabutnya secara eksplisit. Perubahan grant dari pengguna lain perlu dimuat ulang sebelum pilihan baru disimpan. Pengguna tidak dapat memberi hak pada dirinya sendiri atau melampaui akses pemberi.",
    ],
    ["pengaturan", "akun"],
    { feature: true },
  ),
  archive: topic(
    "Kelas arsip",
    "Arsip menempatkan kelas sebagai riwayat baca-saja; pemulihan kelas adalah tindakan terpisah.",
    [
      "Dokumen dan riwayat tetap tersedia sesuai izin. Periksa kelas/semester agar tidak melanjutkan pekerjaan pada kelas yang salah.",
      "Pengelola yang berizin dapat memulihkan kelas secara eksplisit bila fiturnya tersedia. Membuka kelas/editor tidak otomatis mengaktifkannya.",
    ],
    ["pengaturan", "home", "kelas"],
  ),
  documents: topic(
    "Word/PDF dan versi dokumen",
    "Buat atau unduh dokumen dari revisi yang dipilih; periksa nomor, tanggal dan versinya.",
    [
      "Presensi praktikum harus siap/terkunci untuk membuat BAP aktif. Jika pembuatan gagal atau masih diproses, coba lagi tanpa menyimpan ulang presensi yang sudah berhasil.",
      "Setelah koreksi, file versi lama tetap memakai data asal. Buat dokumen versi baru melalui kontrol versi yang sesuai. Mengunduh file historis tidak menjadikannya versi aktif.",
    ],
    ["dokumen", "presensi", "kelas", "koreksi"],
  ),
  packet: topic(
    "Paket cetak lintas pertemuan/versi",
    "Pilih pertemuan dari kelas yang sama dan periksa versi setiap dokumen sebelum membuat paket.",
    [
      "Sesi batal/nonpraktikum tidak masuk paket aktif. Jika memilih versi historis yang tersedia, periksa peringatan bahwa paket memuat versi lama.",
      "Paket besar mungkin meminta pilihan lebih kecil agar dapat diproses. Dua form disusun per folio; satu form memuat 12 mahasiswa tidak hadir, sisanya memakai form lanjutan.",
    ],
    ["dokumen", "kelas"],
  ),
  folio: topic(
    "Cetak folio",
    "Gunakan folio 215×330 mm, skala 100%, satu halaman per lembar pada pengaturan cetak.",
    [
      "Paket dua form per folio sudah disusun dalam dokumen. Jangan memilih dua halaman per lembar lagi karena hasil akan mengecil.",
      "Periksa pratinjau Word/PDF dan ukuran kertas printer. Bila jumlah form ganjil, bagian bawah lembar terakhir dibiarkan kosong.",
    ],
    ["dokumen"],
  ),
  export: topic(
    "Ekspor CSV dan JSON",
    "CSV untuk tabel jadwal/roster/presensi; JSON untuk backup data dan versi yang dipilih.",
    [
      "Unduh CSV lewat tombol per file. File menyimpan NIM sebagai teks; saat membukanya di Excel, impor kolom NIM sebagai Text untuk menjaga nol awal.",
      "JSON memuat data akademik dan manifest hash, tanpa password/token. Bytes Word/PDF diunduh terpisah dari arsip; file tersebut tidak dikemas di JSON. Ekspor hanya mencakup data yang dapat diakses akunmu.",
    ],
    ["pengaturan", "dokumen"],
    { feature: true, any: ["export"] },
  ),
  backupRestore: topic(
    "Pulihkan backup JSON",
    "Pilih bagian/tujuan, periksa pemetaan peserta serta nilai sebelum–sesudah, lalu simpan sebagai revisi baru.",
    [
      "Sumber berbeda kelas/deployment harus dipilih secara eksplisit. ID stabil dipakai bila sesuai; lintas kelas perlu pencocokan NIM/pemetaan yang diperiksa.",
      "Restore memproses satu versi sesi dan maksimal 500 peserta yang ditulis per cohort; UI menyediakan pemilihan kelompok. Maksimal 100 sesi aktif. Pilih bagian lebih kecil jika melewati batas payload.",
      "Preview yang usang ditolak, termasuk bila sesi dibuka kuncinya tanpa kenaikan nomor revisi. Periksa ulang keadaan terkini; arsip lama tetap ada. Data legacy parsial tidak direkonstruksi.",
    ],
    ["pengaturan"],
    {
      feature: true,
      all: ["export"],
      any: [
        "identity",
        "roster",
        "template",
        "schedule",
        "history",
        "lifecycle",
      ],
    },
  ),
  accounts: topic(
    "Akun dan penugasan kelas",
    "Admin mengatur peran serta kelas yang ditugaskan; kemampuan akademik tambahan tetap mengikuti kelas.",
    [
      "Periksa nama akun, username, keaktifan, peran dan kelas tujuan sebelum menyimpan. Penugasan akun tidak memberikan akses ke semua kelas.",
      "Pencabutan penugasan/peran juga menonaktifkan grant terkait. Reset password atau kode pemulihan adalah tindakan akun yang berdampak; sampaikan kredensial melalui saluran privat yang sesuai, bukan di roster/dokumen.",
    ],
    ["akun"],
    { admin: true },
  ),
  profile: topic(
    "Password dan akun saya",
    "Gunakan password pribadi; periksa identitas akun sebelum mengubah pengaturan.",
    [
      "Jika diwajibkan mengganti password, selesaikan sebelum melanjutkan pekerjaan. Pengaturan tema dapat dipilih tanpa mengubah data akademik.",
      "Logout mempertahankan draf akun ini bila penyimpanan perangkat tersedia; akun lain tidak memakai draf tersebut. Hindari membagikan password atau kode pemulihan.",
    ],
    ["profil"],
  ),
  login: topic(
    "Masuk ke aplikasi",
    "Gunakan username dan password akun BAP yang diberikan pengelola.",
    [
      "Akun BAP berbeda dari login Vercel yang mungkin melindungi lingkungan preview. Jika halaman preview meminta autentikasi Vercel, selesaikan lapisan tersebut terlebih dahulu.",
      "Periksa username, password dan koneksi. Untuk kesulitan akses/penugasan kelas, hubungi Admin/Pengelola yang berwenang; bantuan tidak mengungkap akun atau kelas lain.",
    ],
    ["login"],
    { public: true },
  ),
  recovery: topic(
    "Pemulihan akun",
    "Gunakan alur pemulihan yang tersedia atau minta Admin mereset akses melalui saluran privat.",
    [
      "Kode pemulihan bersifat rahasia dan sekali pakai sesuai alur aplikasi. Simpan dengan aman di luar roster/BAP; jangan masukkan kode pada kolom pencarian bantuan.",
      "Mengganti kumpulan kode membuat kode sebelumnya tidak berlaku. Jika password direset, ikuti kewajiban menggantinya ketika masuk kembali.",
    ],
    ["login", "profil", "akun"],
    { public: true },
  ),
};

export function helpAllowed(id, context = {}) {
  const t = HELP_TOPICS[id];
  if (!t) return false;
  if (!context.userId) return Boolean(t.public);
  if (t.admin && context.role !== "ADMIN") return false;
  if (t.manage && context.role === "OPERATOR") return false;
  if (t.feature && !context.enabled) return false;
  if (t.all && !t.all.every((c) => (context.capabilities || []).includes(c)))
    return false;
  if (t.any && context.classId) {
    if (context.enabled)
      return t.any.some((c) => (context.capabilities || []).includes(c));
    if (t.manageLegacy) return context.role !== "OPERATOR";
  }
  // Class-only topics are not offered as actionable guidance outside a class.
  if (t.any && !context.classId) return false;
  return true;
}
export function helpTopic(id, context = {}) {
  if (!helpAllowed(id, context)) return null;
  const original = HELP_TOPICS[id];
  if (
    id === "roster" &&
    context.role === "OPERATOR" &&
    (!context.enabled || !context.capabilities?.includes("roster"))
  )
    return {
      ...original,
      body: [
        "Akunmu dapat membaca daftar mahasiswa. Untuk menambah, mengedit atau mengaktifkan kembali, minta izin roster pada Pengelola kelas.",
        ...original.body,
      ],
    };
  if (id === "lock")
    return {
      ...original,
      body: [
        ...original.body,
        context.enabled
          ? "Untuk koreksi pada fitur revisi, buka Tanggal & data sesi/Jadwal sesuai izin; tidak perlu rangkaian buka kunci manual."
          : "Pada alur lama, koreksi presensi dilakukan melalui Buka kunci lalu periksa dan simpan kembali. Jadwal sesi yang sudah bersejarah tidak dapat disunting melalui editor jadwal lama.",
      ],
    };
  return original;
}
export function helpTopics(context, area, query = "") {
  const words = query
    .trim()
    .toLocaleLowerCase("id")
    .split(/\s+/)
    .filter(Boolean);
  return Object.keys(HELP_TOPICS)
    .filter((id) => helpAllowed(id, context))
    .map((id) => ({ id, ...helpTopic(id, context) }))
    .filter(
      (t) =>
        (!area || t.areas.includes(area)) &&
        words.every((w) =>
          `${t.title} ${t.summary} ${t.body.join(" ")}`
            .toLocaleLowerCase("id")
            .includes(w),
        ),
    );
}
export function pageHelpArea(path = "") {
  if (path.includes("correct=")) return "koreksi";
  if (/\/pertemuan\//.test(path)) return "presensi";
  if (path.startsWith("/dokumen")) return "dokumen";
  if (path.startsWith("/akun")) return "akun";
  if (path === "/pengaturan") return "profil";
  if (path.startsWith("/kelas/") && !path.startsWith("/kelas/baru"))
    return (
      { pertemuan: "kelas" }[
        new URLSearchParams(path.split("?")[1]).get("tab")
      ] ||
      new URLSearchParams(path.split("?")[1]).get("tab") ||
      "kelas"
    );
  return "home";
}
export const FIELD_HELP = {
  "Tanggal pelaksanaan": "date",
  "Tanggal mulai": "date",
  "Nomor pertemuan": "number",
  "Nomor awal": "number",
  "Jenis pertemuan": "meetingType",
  Jenis: "meetingType",
  "Tindakan sesi": "lifecycle",
  "Kembali ke Praktikum": "meetingType",
  "Catatan perubahan": "correction",
  "Geser berapa hari": "bulk",
  "Catatan perubahan massal": "bulk",
  "Versi template": "template",
  "Template versi": "template",
  "Atau pilih versi template": "template",
  "Pulihkan dari revisi sebelumnya": "restoreRevision",
  NIM: "roster",
  Golongan: "roster",
  "Tahun akademik": "identity",
  "Mata kuliah": "identity",
  "Dosen pengampu": "identity",
  "Asisten dosen": "identity",
  "Kode mata kuliah": "identity",
  "Nama mata kuliah": "identity",
  "Catatan pemulihan backup": "backupRestore",
};

export function tourStorageKey(namespace, userId, tourId) {
  return `bap.help.tour.v${HELP_VERSION}.${encodeURIComponent(namespace)}.${encodeURIComponent(userId)}.${tourId}`;
}
export function readTourProgress(storage, namespace, userId, tourId) {
  try {
    const v = JSON.parse(
      storage.getItem(tourStorageKey(namespace, userId, tourId)) || "null",
    );
    return v?.version === HELP_VERSION &&
      ["started", "completed", "skipped"].includes(v.status) &&
      Number.isInteger(v.step) &&
      v.step >= 0 &&
      v.step < 30
      ? v
      : null;
  } catch {
    return null;
  }
}
export function saveTourProgress(
  storage,
  namespace,
  userId,
  tourId,
  status,
  step,
) {
  if (
    !userId ||
    !["started", "completed", "skipped"].includes(status) ||
    !Number.isInteger(step) ||
    step < 0 ||
    step >= 30
  )
    return false;
  try {
    storage.setItem(
      tourStorageKey(namespace, userId, tourId),
      JSON.stringify({
        version: HELP_VERSION,
        status,
        step,
        updatedAt: Date.now(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
