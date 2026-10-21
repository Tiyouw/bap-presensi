import { LABEL } from "../lib/presensi.js";

const labelKalimat = (group) =>
  group.key ? `golongan ${group.key}` : "tanpa golongan";

export function CallIcon({ name = "group" }) {
  const paths = {
    group: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6m2 3a6 6 0 0 1 3 5v2" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3v1" />
      </>
    ),
    timer: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M9 2h6m-3 3v8l3 2M18 5l2-2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    status: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="m8 9 2 2 5-5M8 15h8m-8 3h5" />
      </>
    ),
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.group}
    </svg>
  );
}

export function GroupPicker({
  groups,
  selected,
  reviewed,
  autoExit,
  canEdit,
  onSelect,
  onStart,
  onAutoExit,
}) {
  return (
    <section className="call-picker" aria-label="Pilih golongan">
      <p className="call-eyebrow">Panggil per golongan</p>
      <h3>Golongan mana yang hadir sekarang?</h3>
      <p className="call-intro">
        Pilih golongan sesuai jadwal saat ini, lalu panggil namanya satu per
        satu. Buka <strong>Bantuan</strong> untuk melihat cara pakai.
      </p>
      <div className="call-group-options">
        {groups.map((g) => {
          const count = g.peserta.filter((p) => reviewed.has(p.id)).length;
          return (
            <button
              key={g.key}
              type="button"
              data-call-group={g.key}
              className="call-group-option"
              aria-pressed={g.key === selected.key}
              disabled={!canEdit}
              onClick={() => onSelect(g.key)}
            >
              <span className="call-group-icon">
                <CallIcon />
              </span>
              <strong>{g.label}</strong>
              <span>{g.peserta.length} mahasiswa</span>
              <small>
                {count === g.peserta.length
                  ? "Selesai"
                  : count
                    ? `${count} diperiksa`
                    : "Belum dipanggil"}
              </small>
            </button>
          );
        })}
      </div>
      <label className="call-auto">
        <input
          type="checkbox"
          checked={autoExit}
          disabled={!canEdit}
          onChange={(e) => onAutoExit(e.target.checked)}
        />
        Keluar otomatis 3 detik setelah golongan selesai
      </label>
      <p className="call-intro">
        Draf tetap ada saat keluar. Golongan berikutnya dimulai saat kamu
        memilihnya.
      </p>
      <button
        className="button button--primary button--full call-start"
        disabled={!canEdit}
        onClick={onStart}
      >
        {selected.peserta.every((p) => reviewed.has(p.id))
          ? "Lihat hasil"
          : selected.peserta.some((p) => reviewed.has(p.id))
            ? "Lanjutkan"
            : "Mulai"}{" "}
        {labelKalimat(selected)}
      </button>
    </section>
  );
}

export function PanggilHelp({ onBack }) {
  return (
    <section className="call-help-panel" aria-label="Cara memakai Mode Panggil">
      <p className="call-eyebrow">Panduan singkat</p>
      <h3 tabIndex={-1}>Cara memakai Mode Panggil</h3>
      <ol>
        <li>
          <CallIcon />
          <div>
            <strong>Pilih golongan yang sedang hadir</strong>
            <p>
              Kartu dan progress bar hanya menghitung golongan yang dipilih.
            </p>
          </div>
        </li>
        <li>
          <CallIcon name="status" />
          <div>
            <strong>Pilih status setiap mahasiswa</strong>
            <p>
              Klik Hadir, Alpha, Sakit atau Izin. Lewati dulu tidak mengubah
              status atau menambah progress pemeriksaan.
            </p>
          </div>
        </li>
        <li>
          <CallIcon name="timer" />
          <div>
            <strong>Selesai golongan → keluar dalam 3 detik</strong>
            <p>
              Kamu bisa kembali sekarang, membatalkan hitung mundur, atau
              memilih golongan berikutnya jika sudah siap.
            </p>
          </div>
        </li>
        <li>
          <CallIcon name="check" />
          <div>
            <strong>Periksa seluruh kelas sebelum mengunci</strong>
            <p>
              Menutup kartu mempertahankan draf dan posisi. Simpan &amp; Kunci
              tetap dilakukan melalui review presensi kelas.
            </p>
          </div>
        </li>
      </ol>
      <dl className="call-help-keys">
        {[
          ["1", "Hadir"],
          ["2", "Alpha"],
          ["3", "Sakit"],
          ["4", "Izin"],
          ["←", "Sebelumnya"],
          ["→ / Enter", "Berikutnya setelah memilih"],
          ["Esc", "Tutup bantuan"],
        ].map(([key, text]) => (
          <div key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <p className="call-intro">
        Perpindahan kartu dan hitung mundur dijeda selama bantuan dibuka.
        Setelah menutup bantuan, lanjutkan dengan tombol yang tersedia.
      </p>
      <button
        className="button button--primary button--full call-help-back"
        onClick={onBack}
      >
        Mengerti, kembali
      </button>
    </section>
  );
}

export function GroupResult({
  group,
  nextGroup,
  statuses,
  reviewed,
  countdown,
  autoExit,
  unsafe,
  canEdit,
  onCancel,
  onExit,
  onNextGroup,
  onRemaining,
  onRecheck,
  onReview,
}) {
  const missing = group.peserta.filter((p) => !reviewed.has(p.id));
  return (
    <section className="call-group-result" aria-label={`Hasil ${group.label}`}>
      <span className="call-result-icon">
        <CallIcon name={missing.length ? "group" : "check"} />
      </span>
      <p className="call-eyebrow">
        {missing.length ? "Masih ada nama yang dilewati" : "Panggilan selesai"}
      </p>
      <h3 tabIndex={-1}>
        {group.label} {missing.length ? "belum selesai." : "selesai."}
      </h3>
      <p className="call-intro">
        {group.peserta.length - missing.length} dari {group.peserta.length}{" "}
        mahasiswa sudah diperiksa.
      </p>
      {missing.length ? (
        <>
          <ul className="call-missing-list">
            {missing.map((p) => (
              <li key={p.id}>
                <strong>{p.nama}</strong>
                <span>
                  {p.nim} · {LABEL[statuses[p.id]]} · belum diperiksa
                </span>
              </li>
            ))}
          </ul>
          <button
            className="button button--primary button--full"
            disabled={!canEdit}
            onClick={() => onRemaining(missing[0].id)}
          >
            Periksa nama yang dilewati
          </button>
          <p className="call-intro">
            Hitung mundur belum dimulai. Status nama yang dilewati tidak
            berubah.
          </p>
        </>
      ) : (
        <>
          <div className="review-stats">
            {Object.keys(LABEL).map((s) => (
              <span className={`status-badge ${s}`} key={s}>
                {group.peserta.filter((p) => statuses[p.id] === s).length}{" "}
                {LABEL[s]}
              </span>
            ))}
          </div>
          {countdown !== null ? (
            <div className="call-exit-countdown">
              <div role="status" aria-live="polite">
                <span>Kembali ke daftar dalam {countdown} detik…</span>
                <strong>{countdown}</strong>
              </div>
              <progress
                max="3"
                value={countdown}
                aria-label="Waktu sebelum kembali ke daftar"
              />
              <button className="button button--quiet" onClick={onCancel}>
                Batalkan hitung mundur
              </button>
            </div>
          ) : (
            <p className="call-intro">
              {unsafe
                ? "Keluar otomatis dijeda karena draf atau pengaturan belum tersimpan di perangkat."
                : autoExit
                  ? "Hitung mundur tidak berjalan. Pilih kapan kembali atau lanjutkan golongan berikutnya."
                  : "Keluar otomatis dimatikan. Pilih kapan kembali ke daftar."}
            </p>
          )}
        </>
      )}
      <div className="call-result-actions">
        <button
          className={`button ${missing.length ? "button--outline" : "button--primary"}`}
          onClick={onExit}
        >
          Kembali ke daftar sekarang
        </button>
        {!missing.length && (
          <button
            className="button button--outline"
            disabled={!canEdit}
            onClick={onRecheck}
          >
            Periksa ulang {labelKalimat(group)}
          </button>
        )}
        {nextGroup && (
          <button
            className="button button--outline"
            disabled={!canEdit}
            onClick={onNextGroup}
          >
            Lanjut ke {labelKalimat(nextGroup)}
          </button>
        )}
        <button className="button button--quiet" onClick={onReview}>
          Periksa presensi seluruh kelas
        </button>
      </div>
      {nextGroup && (
        <p className="call-intro">
          {nextGroup.label} · {nextGroup.peserta.length} mahasiswa. Mulai hanya
          jika golongannya sudah siap.
        </p>
      )}
    </section>
  );
}
