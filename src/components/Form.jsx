import { useState } from "react";
import { Notice } from "./Layout.jsx";
import { pesanGalat } from "../lib/presensi.js";
export function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
  help,
  required = false,
  ...props
}) {
  return (
    <label className="mg-field">
      <span>
        {label}
        {required && " *"}
      </span>
      {options ? (
        <select
          aria-label={label}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        >
          {options.map((o) => (
            <option
              key={typeof o === "string" ? o : o.value}
              value={typeof o === "string" ? o : o.value}
              disabled={typeof o === "object" && Boolean(o.disabled)}
            >
              {typeof o === "string" ? o : o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label={label}
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          {...props}
        />
      )}
      {help && <small>{help}</small>}
    </label>
  );
}
export function useTask() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  return {
    busy,
    error,
    success,
    clear: () => {
      setError("");
      setSuccess("");
    },
    async run(fn, message = "Tersimpan.") {
      if (busy) return;
      setBusy(true);
      setError("");
      setSuccess("");
      try {
        const result = await fn();
        setSuccess(message);
        return result;
      } catch (e) {
        const raw = e?.data?.message || e?.data || e.message;
        setError(
          typeof raw === "string" && !/^[A-Z_]+$/.test(raw)
            ? raw
            : pesanGalat(e),
        );
        throw e;
      } finally {
        setBusy(false);
      }
    },
  };
}
export function Feedback({ task }) {
  return (
    <>
      {task.error && <Notice kind="error">{task.error}</Notice>}
      {task.success && <Notice>{task.success}</Notice>}
    </>
  );
}
export function RevisionNotice({ base, current, onReload }) {
  if (base === undefined || base === current) return null;
  return (
    <Notice kind="warning">
      Data kelas berubah sejak editor dibuka. Perubahanmu belum ditimpa. Salin
      perubahan penting sebelum memuat ulang.
      <button
        type="button"
        className="button button--outline"
        onClick={() => {
          if (
            window.confirm("Buang perubahan editor ini dan muat data terbaru?")
          )
            onReload();
        }}
      >
        Muat data terbaru
      </button>
    </Notice>
  );
}
export function TaskForm({ task, onSubmit, children, ...props }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit().catch(() => {});
      }}
      {...props}
    >
      <Feedback task={task} />
      <fieldset disabled={task.busy}>{children}</fieldset>
    </form>
  );
}
