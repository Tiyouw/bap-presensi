import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import "./DateField.css";

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [y, m, d] = value.split("-").map(Number),
    date = new Date(y, m - 1, d);
  return y >= 1900 && y <= 9999 && iso(date) === value ? date : null;
};
const months = Array.from({ length: 12 }, (_, m) =>
  new Intl.DateTimeFormat("id-ID", { month: "long" }).format(
    new Date(2026, m, 1),
  ),
);
export default function DateField({ value, onChange, label, id, ...props }) {
  const [open, setOpen] = useState(false),
    [invalid, setInvalid] = useState(false),
    [shown, setShown] = useState(new Date()),
    [cursor, setCursor] = useState(value),
    [yearText, setYearText] = useState(String(new Date().getFullYear())),
    input = useRef(),
    trigger = useRef();
  const chosen = parseDate(value),
    year = shown.getFullYear(),
    month = shown.getMonth(),
    start = (new Date(year, month, 1).getDay() + 6) % 7,
    count = new Date(year, month + 1, 0).getDate();
  useEffect(() => setYearText(String(year)), [year]);
  const focusedDate = parseDate(cursor),
    focusDay =
      focusedDate?.getMonth() === month && focusedDate?.getFullYear() === year
        ? cursor
        : iso(new Date(year, month, 1));
  useEffect(() => {
    input.current?.setCustomValidity(
      value && !parseDate(value)
        ? "Isi tanggal yang valid dalam format YYYY-MM-DD."
        : "",
    );
  }, [value]);
  const pick = (date) => {
    const next = iso(date);
    onChange(next);
    setCursor(next);
    setOpen(false);
    setInvalid(false);
    input.current?.setCustomValidity("");
  };
  const move = (amount) => {
    const date =
      parseDate(document.activeElement?.getAttribute("data-calendar-date")) ||
      parseDate(cursor) ||
      chosen ||
      new Date();
    date.setDate(date.getDate() + amount);
    setShown(date);
    setCursor(iso(date));
    requestAnimationFrame(() =>
      document.querySelector(`[data-calendar-date="${iso(date)}"]`)?.focus(),
    );
  };
  return (
    <div className="date-field">
      <div className="date-field-control">
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          aria-label={label}
          value={value || ""}
          {...props}
          aria-invalid={(invalid && !parseDate(value)) || undefined}
          aria-describedby={
            [props["aria-describedby"], invalid ? `${id}-date-error` : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onInvalid={(e) => {
            e.preventDefault();
            setInvalid(true);
            input.current?.focus();
            input.current?.scrollIntoView({block:"center"});
          }}
          onBlur={() => setInvalid(Boolean(value && !parseDate(value)))}
          onChange={(e) => {
            onChange(e.target.value);
            if (parseDate(e.target.value)) setInvalid(false);
            e.target.setCustomValidity(
              e.target.value && !parseDate(e.target.value)
                ? "Isi tanggal yang valid dalam format YYYY-MM-DD."
                : "",
            );
          }}
        />
        <button
          ref={trigger}
          type="button"
          className="button button--outline"
          disabled={props.disabled}
          aria-label={`Pilih tanggal: ${label}`}
          aria-haspopup="dialog"
          onClick={() => {
            const date = chosen || new Date();
            setShown(date);
            setCursor(iso(date));
            setOpen(true);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M4 5h16v16H4zM4 10h16M8 2v6m8-6v6" />
          </svg>
        </button>
      </div>
      {invalid && !parseDate(value) && (
        <p className="file-drop-error" id={`${id}-date-error`} role="alert">
          Isi tanggal yang valid dalam format YYYY-MM-DD.
        </p>
      )}
      {open && (
        <Modal
          className="calendar-dialog"
          title={`Pilih tanggal · ${label}`}
          onClose={() => setOpen(false)}
          returnFocusRef={trigger}
          initialFocusSelector='[data-calendar-focus="true"]'
          onKeyDown={(e) => {
            if (e.target.hasAttribute("data-calendar-date")) {
              const keys = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -7,
                ArrowDown: 7,
              };
              if (keys[e.key]) {
                e.preventDefault();
                move(keys[e.key]);
              }
              if (e.key === "Home") {
                e.preventDefault();
                move(-((parseDate(cursor).getDay() + 6) % 7));
              }
              if (e.key === "End") {
                e.preventDefault();
                move(6 - ((parseDate(cursor).getDay() + 6) % 7));
              }
            }
          }}
        >
          <div className="calendar-month">
            <button
              type="button"
              className="button button--outline"
              aria-label="Bulan sebelumnya"
              disabled={year === 1900 && month === 0}
              onClick={() => setShown(new Date(year, month - 1, 1))}
            >
              ‹
            </button>
            <label>
              <span className="sr-only">Bulan kalender</span>
              <select
                aria-label="Bulan kalender"
                value={month}
                onChange={(e) =>
                  setShown(new Date(year, Number(e.target.value), 1))
                }
              >
                {months.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Tahun kalender</span>
              <input
                aria-label="Tahun kalender"
                type="number"
                min="1900"
                max="9999"
                value={yearText}
                onChange={(e) => {
                  setYearText(e.target.value);
                  const n = Number(e.target.value);
                  if (n >= 1900 && n <= 9999) setShown(new Date(n, month, 1));
                }}
                onBlur={() => setYearText(String(year))}
              />
            </label>
            <button
              type="button"
              className="button button--outline"
              aria-label="Bulan berikutnya"
              disabled={year === 9999 && month === 11}
              onClick={() => setShown(new Date(year, month + 1, 1))}
            >
              ›
            </button>
          </div>
          <p className="sr-only" role="status">
            {months[month]} {year}
          </p>
          <div
            className="calendar-days"
            role="group"
            aria-label={`${months[month]} ${year}`}
          >
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
              <span key={day} aria-hidden="true">
                {day}
              </span>
            ))}
            {Array.from({ length: start }, (_, i) => (
              <span key={`blank${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const date = new Date(year, month, i + 1),
                key = iso(date);
              return (
                <button
                  type="button"
                  key={key}
                  data-calendar-date={key}
                  data-calendar-focus={key === focusDay}
                  tabIndex={key === focusDay ? 0 : -1}
                  onFocus={() => setCursor(key)}
                  aria-pressed={key === value}
                  aria-current={key === iso(new Date()) ? "date" : undefined}
                  aria-label={new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "full",
                  }).format(date)}
                  onClick={() => pick(date)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="muted">
            Gunakan tombol panah untuk berpindah hari, Enter untuk memilih.
          </p>
          <div className="calendar-actions">
            <button
              type="button"
              className="button button--outline"
              onClick={() => pick(new Date())}
            >
              Hari ini
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => {
                onChange("");
                setOpen(false);
                input.current?.setCustomValidity("");
              }}
            >
              Kosongkan tanggal
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
