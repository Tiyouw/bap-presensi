import { HelpButton } from "./Help.jsx";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Modal from "./Modal.jsx";
import { helpIsActive, useHelpActivity } from "../lib/helpActivity.js";
import { LABEL } from "../lib/presensi.js";
import { STATUS_PANGGIL, golonganPanggil } from "../lib/panggil.js";
import {
  CallIcon,
  GroupPicker,
  GroupResult,
  PanggilHelp,
} from "./PanggilGroups.jsx";
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
  autoExit,
  resume = false,
  canEdit,
  unsafe,
  nomor,
  kode,
  onChoose,
  onProgress,
  onAuto,
  onAutoExit,
  onClose,
  onReview,
  returnFocusRef,
}) {
  const externalHelp = useHelpActivity();
  const groups = useMemo(() => golonganPanggil(peserta), [peserta]);
  const [selected, setSelected] = useState(() => {
    const saved = groups.find((g) => g.key === progress.groupKey);
    if (
      resume ||
      (progress.started &&
        saved?.peserta.some((p) => !progress.reviewedIds.includes(p.id)))
    )
      return saved?.key ?? groups[0].key;
    return (
      groups.find((g) =>
        g.peserta.some((p) => !progress.reviewedIds.includes(p.id)),
      )?.key ??
      saved?.key ??
      groups[0].key
    );
  });
  const [phase, setPhase] = useState(resume ? "calling" : "choose");
  const [help, setHelp] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const helpId = useId();
  const helpButton = useRef(null);
  const [motion, setMotion] = useState("");
  const [feedback, setFeedback] = useState("");
  const pending = useRef(null);
  const arriving = useRef(null);
  const travelling = useRef(false);
  const card = useRef(null);
  const root = useRef(null);
  const latest = useRef(null);
  const group = groups.find((g) => g.key === selected) || groups[0];
  const list = group.peserta;
  const position =
    progress.groupKey === group.key
      ? progress.currentId
      : progress.positions[group.key];
  const index = Math.max(
    0,
    list.findIndex((p) => p.id === position),
  );
  const person = list[index];
  const reviewed = new Set(progress.reviewedIds);
  const checked = reviewed.has(person.id);
  const value = statuses[person.id];
  const groupChecked = list.filter((p) => reviewed.has(p.id)).length;
  const groupsDone = groups.filter((g) =>
    g.peserta.every((p) => reviewed.has(p.id)),
  ).length;
  const nextGroup = groups[groups.findIndex((g) => g.key === group.key) + 1];
  latest.current = {
    progress,
    index,
    canEdit,
    unsafe,
    help,
    phase,
    group,
    onClose,
  };

  function cancel() {
    clearTimeout(pending.current);
    clearTimeout(arriving.current);
    pending.current = null;
    travelling.current = false;
  }
  useEffect(() => {
    if (externalHelp) {
      cancel();
      setMotion("");
      setCountdown(null);
    }
  }, [externalHelp]);
  useEffect(() => () => cancel(), []);
  useLayoutEffect(() => {
    if (!help) return;
    // Keep Escape inside this dialog even when WebKit doesn't focus a clicked button.
    root.current
      ?.querySelector(".call-help-panel h3")
      ?.focus({ preventScroll: true });
    root.current?.closest(".call-modal")?.scrollTo({ top: 0 });
  }, [help]);
  useEffect(() => {
    if (!canEdit || unsafe) {
      cancel();
      setMotion("");
      setCountdown(null);
    }
  }, [canEdit, unsafe]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) {
        cancel();
        setMotion("");
        setCountdown(null);
      }
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  useEffect(() => {
    if (
      countdown === null ||
      help ||
      externalHelp ||
      phase !== "finish" ||
      !canEdit ||
      unsafe
    )
      return;
    const timer = setTimeout(() => {
      if (countdown <= 1)
        close(
          `${group.label} selesai. Draf tetap tersimpan dan belum dikunci.`,
        );
      else setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, help, externalHelp, phase, canEdit, unsafe]);

  function focusPanel(selector) {
    requestAnimationFrame(() =>
      root.current?.querySelector(selector)?.focus({ preventScroll: true }),
    );
  }
  function begin(target, force = false, id) {
    cancel();
    setMotion("");
    setFeedback("");
    setCountdown(null);
    setSelected(target.key);
    if (!force && target.peserta.every((p) => reviewed.has(p.id))) {
      setPhase("finish");
      focusPanel(".call-group-result h3");
      return;
    }
    const currentId =
      id || progress.positions[target.key] || target.peserta[0].id;
    onProgress({ groupKey: target.key, currentId, started: true });
    setPhase("calling");
    focusStatus();
  }
  function finish() {
    cancel();
    setMotion("");
    setPhase("finish");
    const current = latest.current;
    const complete = current.group.peserta.every((p) =>
      current.progress.reviewedIds.includes(p.id),
    );
    setCountdown(
      complete && autoExit && !current.unsafe && !document.hidden ? 3 : null,
    );
    focusPanel(".call-group-result h3");
  }
  function toggleHelp() {
    cancel();
    setMotion("");
    setCountdown(null);
    setHelp((value) => !value);
    if (help)
      requestAnimationFrame(() =>
        helpButton.current?.focus({ preventScroll: true }),
      );
  }

  function focusStatus() {
    requestAnimationFrame(() => {
      const selected =
        root.current?.querySelector('.call-choice[aria-pressed="true"]') ||
        root.current?.querySelector(".call-choice");
      selected?.focus({ preventScroll: true });
    });
  }

  function move(to, direction = 1) {
    if (
      !latest.current.canEdit ||
      latest.current.help ||
      latest.current.phase !== "calling" ||
      travelling.current
    )
      return;
    cancel();
    const target = latest.current.group.peserta[to];
    if (!target) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    travelling.current = true;
    setMotion(reduced ? "" : direction < 0 ? "depart-prev" : "depart-next");
    const arrive = () => {
      if (
        !latest.current.canEdit ||
        latest.current.help ||
        latest.current.phase !== "calling"
      ) {
        cancel();
        return;
      }
      onProgress({ currentId: target.id, groupKey: group.key, started: true });
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
      current.help ||
      current.phase !== "calling" ||
      travelling.current ||
      !current.progress.reviewedIds.includes(
        current.group.peserta[current.index].id,
      )
    )
      return;
    cancel();
    if (current.index === current.group.peserta.length - 1) finish();
    else move(current.index + 1);
  }

  function choose(status) {
    if (
      !latest.current.canEdit ||
      latest.current.help ||
      latest.current.phase !== "calling" ||
      travelling.current
    )
      return;
    cancel();
    // Include same-as-default choices in reviewed progress, without a second draft.
    onChoose(person.id, status);
    setFeedback(`${person.nama} → ${LABEL[status]}`);
    setMotion("");
    card.current?.getAnimations().forEach((animation) => animation.cancel());
    requestAnimationFrame(() => {
      if (card.current && !travelling.current) setMotion("hit");
    });
    if (auto && !unsafe) pending.current = setTimeout(next, 700);
  }

  function skip() {
    if (!canEdit || travelling.current) return;
    cancel();
    if (index === list.length - 1) finish();
    else move(index + 1);
  }

  function keys(event) {
    if (helpIsActive() || event.target.closest(".help-trigger")) return;
    if (event.key === "Escape" && help) {
      event.preventDefault();
      event.stopPropagation();
      toggleHelp();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      // Yield to global search and stop pending auto advance behind that dialog.
      close();
      return;
    }
    if (help || phase !== "calling") return;
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

  function close(message) {
    cancel();
    setCountdown(null);
    latest.current.onClose(typeof message === "string" ? message : undefined);
  }

  return (
    <Modal
      title="Mode Panggil"
      className="call-modal"
      onClose={close}
      onKeyDown={keys}
      returnFocusRef={returnFocusRef}
      initialFocusSelector={resume ? ".call-choice" : ".call-start"}
      headerActions={
        <button
          ref={helpButton}
          type="button"
          className="button button--quiet call-help-toggle"
          aria-expanded={help}
          aria-controls={helpId}
          onClick={toggleHelp}
        >
          <CallIcon name="help" />
          Bantuan
        </button>
      }
    >
      <div ref={root}>
        <p className="call-context">
          <PanggilIcon /> {kode} · Pertemuan {nomor}
          <HelpButton topic="calling" />
        </p>
        {!help && phase !== "choose" && (
          <>
            <div className="call-current-group">
              <CallIcon />
              <strong>{group.label}</strong>
              <button
                className="button button--quiet"
                onClick={() => {
                  cancel();
                  setCountdown(null);
                  setPhase("choose");
                  focusPanel(".call-start");
                }}
              >
                Ganti golongan
              </button>
            </div>
            <div className="call-progress-copy">
              <span>
                {groupChecked} dari {list.length} diperiksa
              </span>
              <span>Belum dikunci</span>
            </div>
            <progress
              className="call-progress"
              max={list.length}
              value={groupChecked}
              aria-label={`Mahasiswa ${group.label} yang sudah diperiksa`}
            />
            <p className="call-scope">
              Kelas: {groupsDone} dari {groups.length} golongan selesai · belum
              dikunci
            </p>
          </>
        )}
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
        {help ? (
          <div id={helpId}>
            <PanggilHelp onBack={toggleHelp} />
          </div>
        ) : phase === "choose" ? (
          <GroupPicker
            groups={groups}
            selected={group}
            reviewed={reviewed}
            autoExit={autoExit}
            canEdit={canEdit}
            onSelect={setSelected}
            onStart={() => begin(group)}
            onAutoExit={onAutoExit}
          />
        ) : phase === "finish" ? (
          <GroupResult
            group={group}
            nextGroup={nextGroup}
            statuses={statuses}
            reviewed={reviewed}
            countdown={countdown}
            autoExit={autoExit}
            unsafe={unsafe}
            canEdit={canEdit}
            onCancel={() => setCountdown(null)}
            onExit={() => close()}
            onNextGroup={() => begin(nextGroup)}
            onRemaining={(id) => begin(group, true, id)}
            onRecheck={() => begin(group, true, list[0].id)}
            onReview={() => {
              cancel();
              setCountdown(null);
              onReview();
            }}
          />
        ) : (
          <>
            <div className="call-stack">
              <article
                ref={card}
                tabIndex={0}
                aria-label={`Kartu ${person.nama}`}
                className={`call-card ${checked ? value : ""} ${motion ? `call-${motion}` : ""}`}
              >
                <div className="call-card-meta">
                  <span>
                    Nama {String(index + 1).padStart(2, "0")} / {list.length}
                  </span>
                  <span className="call-group">
                    <CallIcon />
                    {group.label}
                  </span>
                </div>
                <div className="call-person">
                  <h3>{person.nama}</h3>
                  <p>
                    {person.nim} · {group.label}
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
                      <span aria-hidden="true">{SYMBOL[value]}</span>{" "}
                      {LABEL[value]}
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
                {index === list.length - 1
                  ? "Selesaikan golongan"
                  : "Selanjutnya"}{" "}
                →
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
                {index < list.length - 1
                  ? `Berikutnya: ${list[index + 1].nama}`
                  : "Nama terakhir di golongan ini"}
              </span>
              <span>Status bisa dikoreksi kapan saja</span>
            </footer>
          </>
        )}
      </div>
    </Modal>
  );
}
