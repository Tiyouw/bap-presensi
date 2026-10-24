import { navigate } from "../lib/navigation.js";
export const SETUP_STEPS = [
  ["pengaturan", "Identitas"],
  ["mahasiswa", "Mahasiswa"],
  ["jadwal", "Jadwal"],
  ["template", "Template & preview"],
  ["review", "Tinjau & aktifkan"],
];
export function SetupActions({
  data,
  tab,
  checks,
  can,
  online,
  identityBusy,
  templateState,
  scheduleState,
  activating,
  onActivate,
}) {
  const index = Math.max(
      0,
      SETUP_STEPS.findIndex(([id]) => id === tab),
    ),
    id = data.kelas.id;
  const descriptions = [
    "Simpan identitas kelas, lalu masukkan daftar mahasiswa.",
    "Impor atau tambahkan mahasiswa. Berikutnya, siapkan tanggal pertemuan.",
    "Tambahkan pertemuan dan periksa tanggalnya. Setelah itu, periksa template BAP.",
    "Preview muncul otomatis. Simpan template yang akan dipakai, lalu tinjau seluruh kelas.",
    "Periksa kelima tahap persiapan sebelum mulai menggunakan kelas.",
  ];
  const submit =
    index === 0
      ? "setup-identity"
      : index === 2 && data.controls?.enabled
        ? "setup-schedule"
        : index === 3
          ? "setup-template"
          : undefined;
  const busy =
    activating ||
    (index === 0
      ? identityBusy
      : index === 2
        ? scheduleState.busy
        : index === 3
          ? templateState.busy
          : false);
  const permitted =
    index === 0
      ? can("identity")
      : index === 1
        ? can("schedule")
        : index === 2
          ? can("template")
          : index === 3
            ? can("template")
            : can("identity");
  const disabled =
    busy ||
    !permitted ||
    (!online && index !== 1) ||
    (index === 2 && !checks[2]) ||
    (index === 3 && !templateState.ready) ||
    (index === 4 && !checks.every(Boolean));
  const labels = [
    "Simpan & lanjut ke Mahasiswa →",
    "Lanjut ke Jadwal →",
    scheduleState.dirty
      ? "Periksa tanggal & lanjut →"
      : "Lanjut ke Template BAP →",
    "Simpan template & lanjut →",
    "Aktifkan kelas",
  ];
  return (
    <section className="mg-setup setup-flow" aria-label="Persiapan kelas">
      <div>
        <p className="eyebrow">Langkah {index + 1} dari 5</p>
        <h2>
          {index + 1} · {SETUP_STEPS[index][1]}
        </h2>
        <p>{descriptions[index]}</p>
      </div>
      <div className="setup-next">
        <button
          type={submit ? "submit" : "button"}
          form={submit}
          className="button button--primary"
          disabled={disabled}
          aria-busy={Boolean(busy)}
          onClick={
            submit
              ? undefined
              : () =>
                  index === 4
                    ? onActivate()
                    : navigate(`/kelas/${id}?tab=${SETUP_STEPS[index + 1][0]}`)
          }
        >
          {busy ? "Memproses…" : labels[index]}
        </button>
        {!permitted ? (
          <small>Langkah ini memerlukan izin Pengelola.</small>
        ) : index === 2 && !checks[2] ? (
          <small>Tambahkan minimal satu pertemuan praktikum.</small>
        ) : index === 3 && !templateState.ready ? (
          <small>Menunggu preview template siap.</small>
        ) : index === 4 && !checks.every(Boolean) ? (
          <small>Lengkapi bagian yang ditandai sebelum aktivasi.</small>
        ) : null}
      </div>
    </section>
  );
}
export function SetupReview({ data, checks }) {
  const c = data.kelas,
    items = [
      ["Identitas kelas", checks[0], `${c.nama} · ${c.dosen}`, "pengaturan"],
      [
        "Mahasiswa",
        checks[1],
        `${data.peserta.filter((p) => p.aktif !== false).length} mahasiswa aktif`,
        "mahasiswa",
      ],
      [
        "Jadwal",
        checks[2],
        `${data.pertemuan.filter((p) => !p.cancelled).length} pertemuan · ${data.pertemuan.filter((p) => !p.cancelled && p.tipe === "REGULER").length} praktikum`,
        "jadwal",
      ],
      [
        "Template & preview",
        checks[3],
        `Template versi ${c.templateVersion} · periksa tampilan dokumen`,
        "template",
      ],
    ];
  return (
    <section className="setup-review">
      <h2>Tinjau persiapan kelas</h2>
      <p>
        Kelas belum aktif sampai kamu memilih Aktifkan kelas. Jadwal bukan akhir
        persiapan: template BAP juga perlu diperiksa.
      </p>
      <div className="mg-panel">
        {items.map(([title, ready, description, tab]) => (
          <div className="mg-list-row" key={tab}>
            <span>
              <strong>
                {title} · {ready ? "Siap" : "Belum lengkap"}
              </strong>
              <small>{description}</small>
            </span>
            <button
              type="button"
              className="button button--outline"
              onClick={() => navigate(`/kelas/${c.id}?tab=${tab}`)}
            >
              {ready ? "Periksa" : "Lengkapi"}
            </button>
          </div>
        ))}
      </div>
      <p className="muted">
        Setelah aktif, kamu tetap dapat mengubah kelas sesuai izin akses. Data
        sesi bersejarah tetap memakai revisinya.
      </p>
    </section>
  );
}
