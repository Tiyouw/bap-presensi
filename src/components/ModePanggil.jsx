import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { LABEL } from "../lib/presensi.js";
import { STATUS_PANGGIL } from "../lib/panggil.js";
import "./ModePanggil.css";

const SYMBOL = { HADIR: "✓", ALPHA: "×", SAKIT: "♡", IZIN: "✉" };

export function PanggilIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5" />
    </svg>
  );
}

export default function ModePanggil({
  peserta,
  statuses,
  progress,
  auto,
  canEdit,
  unsafe,
  nomor,
  kode,
  onChoose,
  onProgress,
  onAuto,
  onClose,
  onReview,
  returnFocusRef,
}) {
  const [motion, setMotion] = useState("");
  const [feedback, setFeedback] = useState("");
  const pending = useRef(null);
  const arriving = useRef(null);
  const travelling = useRef(false);
  const card = useRef(null);
  const root = useRef(null);
  const latest = useRef(null);
  const index = Math.max(
    0,
    peserta.findIndex((p) => p.id === progress.currentId),
  );
  const person = peserta[index];
  const reviewed = new Set(progress.reviewedIds);
  const checked = reviewed.has(person.id);
  const value = statuses[person.id];
  latest.current = { progress, index, canEdit };

  function cancel() {
    clearTimeout(pending.current);
    clearTimeout(arriving.current);
    pending.current = null;
    travelling.current = false;
  }
  useEffect(() => () => cancel(), []);
  useEffect(() => {
    if (!canEdit) {
      cancel();
      setMotion("");
    }
  }, [canEdit]);

  function focusStatus() {
    requestAnimationFrame(() => {
      const selected =
        root.current?.querySelector('.call-choice[aria-pressed="true"]') ||
        root.current?.querySelector(".call-choice");
      selected?.focus({ preventScroll: true });
    });
  }

  function move(to, direction = 1) {
    if (!latest.current.canEdit || travelling.current) return;
    cancel();
    const target = peserta[to];
    if (!target) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    travelling.current = true;
    setMotion(reduced ? "" : direction < 0 ? "depart-prev" : "depart-next");
    const arrive = () => {
      if (!latest.current.canEdit) {
        cancel();
        return;
      }
      onProgress({ currentId: target.id, started: true });
      travelling.current = false;
      pending.current = null;
      setFeedback("");
      setMotion(reduced ? "" : direction < 0 ? "arrive-prev" : "arrive-next");
      arriving.current = setTimeout(() => setMotion(""), 240);
      focusStatus();
    };
    if (reduced) arrive();
    else pending.current = setTimeout(arrive, 160);
  }

  function next() {
    const current = latest.current;
    if (
      !current.canEdit ||
      travelling.current ||
      !current.progress.reviewedIds.includes(peserta[current.index].id)
    )
      return;
    cancel();
    if (current.index === peserta.length - 1) onReview();
    else move(current.index + 1);
  }

  function choose(status) {
    if (!latest.current.canEdit || travelling.current) return;
    cancel();
    // Include same-as-default choices in reviewed progress, without a second draft.
    onChoose(person.id, status);
    setFeedback(`${person.nama} → ${LABEL[status]}`);
    setMotion("");
    card.current?.getAnimations().forEach((animation) => animation.cancel());
    requestAnimationFrame(() => {
      if (card.current && !travelling.current) setMotion("hit");
    });
    if (auto) pending.current = setTimeout(next, 700);
  }

  function skip() {
    if (!canEdit || travelling.current) return;
    cancel();
    if (index === peserta.length - 1) onReview();
    else move(index + 1);
  }

  function keys(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      // Yield to global search and stop pending auto advance behind that dialog.
      close();
      return;
    }
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.isComposing ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
    )
      return;
    const enter =
      event.key === "Enter" &&
      event.target.closest(".call-choice, .call-next, .call-card");
    const shortcut =
      ["1", "2", "3", "4", "ArrowLeft", "ArrowRight"].includes(event.key) ||
      enter;
    if (!shortcut) return;
    event.preventDefault();
    if (event.repeat || !canEdit || travelling.current) return;
    if (/^[1-4]$/.test(event.key)) {
      choose(STATUS_PANGGIL[Number(event.key) - 1]);
      focusStatus();
    } else if (event.key === "ArrowLeft") move(index - 1, -1);
    else next();
  }

  function close() {
    cancel();
    onClose();
  }

  return (
    <Modal
      title="Mode Panggil"
      className="call-modal"
      onClose={close}
      onKeyDown={keys}
      returnFocusRef={returnFocusRef}
    >
      <div ref={root}>
        <p className="call-context">
          <PanggilIcon /> {kode} · Pertemuan {nomor}
        </p>
        <div className="call-progress-copy">
          <span>
            {reviewed.size} dari {peserta.length} diperiksa
          </span>
          <span>Belum dikunci</span>
        </div>
        <progress
          className="call-progress"
          max={peserta.length}
          value={reviewed.size}
          aria-label="Mahasiswa yang sudah diperiksa"
        />
        <p className="call-scope">
          Seluruh mahasiswa · tidak mengikuti filter daftar
        </p>
        {!canEdit && (
          <p role="alert" className="call-warning">
            Pengeditan dihentikan karena data atau akses berubah. Tutup mode ini
            dan periksa pemberitahuan pada daftar.
          </p>
        )}
        {unsafe && (
          <p role="alert" className="call-warning">
            Draf atau pengaturan belum tersimpan di perangkat. Jangan tutup
            halaman sebelum penyimpanan berhasil.
          </p>
        )}
        <div className="call-stack">
          <article
            ref={card}
            tabIndex={0}
            aria-label={`Kartu ${person.nama}`}
            className={`call-card ${checked ? value : ""} ${motion ? `call-${motion}` : ""}`}
          >
            <div className="call-card-meta">
              <span>
                Nama {String(index + 1).padStart(2, "0")} / {peserta.length}
              </span>
              <span className="call-group">Golongan {person.golongan}</span>
            </div>
            <div className="call-person">
              <h3>{person.nama}</h3>
              <p>
                {person.nim} · Golongan {person.golongan}
              </p>
            </div>
            <div className="call-card-bottom">
              <span>
                {checked
                  ? "Pilihan untuk nama ini"
                  : `Status saat ini: ${LABEL[value]} · belum diperiksa`}
              </span>
              {checked && (
                <span className="call-stamp">
                  <span aria-hidden="true">{SYMBOL[value]}</span> {LABEL[value]}
                </span>
              )}
            </div>
          </article>
        </div>
        <fieldset className="call-fieldset" disabled={!canEdit}>
          <legend>Bagaimana kehadirannya?</legend>
          <div className="call-choices">
            {STATUS_PANGGIL.map((s, i) => (
              <button
                key={s}
                className={`call-choice ${s}`}
                type="button"
                aria-pressed={checked && value === s}
                onClick={(event) => {
                  event.currentTarget.focus({ preventScroll: true });
                  choose(s);
                }}
              >
                <span aria-hidden="true">{SYMBOL[s]}</span>
                <span>{LABEL[s]}</span>
                <kbd>{i + 1}</kbd>
              </button>
            ))}
          </div>
          <label className="call-auto">
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) => {
                cancel();
                setMotion("");
                onAuto(event.target.checked);
              }}
            />
            Lanjut otomatis setelah pilih status
          </label>
        </fieldset>
        <p className="call-feedback" role="status" aria-live="polite">
          {feedback ||
            (checked
              ? `${person.nama} · ${LABEL[value]}`
              : "Pilih status untuk menandai nama ini sudah diperiksa.")}
        </p>
        <div className="call-navigation">
          <button
            className="button button--outline"
            disabled={!canEdit || index === 0}
            onClick={() => move(index - 1, -1)}
          >
            ← Sebelumnya
          </button>
          <button
            className="button button--primary call-next"
            disabled={!canEdit || !checked}
            onClick={next}
          >
            {index === peserta.length - 1 ? "Periksa hasil" : "Selanjutnya"} →
          </button>
        </div>
        <button
          className="button button--quiet call-skip"
          disabled={!canEdit}
          onClick={skip}
        >
          Lewati dulu
        </button>
        <p className="call-keyboard">
          ← Sebelumnya <span>→ / Enter Berikutnya</span> Esc Keluar
        </p>
        <footer className="call-footer">
          <span>
            {index < peserta.length - 1
              ? `Berikutnya: ${peserta[index + 1].nama}`
              : "Nama terakhir · lanjut ke review"}
          </span>
          <span>Status bisa dikoreksi kapan saja</span>
        </footer>
      </div>
    </Modal>
  );
}
