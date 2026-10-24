import { useEffect, useId, useRef, useState } from "react";
import "./FileDrop.css";

export default function FileDrop({
  label,
  accept,
  disabled = false,
  onChange,
}) {
  const id = useId(),
    input = useRef(),
    host = useRef(),
    depth = useRef(0);
  const [over, setOver] = useState(false),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  const shownFormats = (accept || "").split(",").map(s=>s.trim()).filter(s=>s.startsWith(".")).join(", ") || accept;
  useEffect(() => {
    // Dropping outside the target must not navigate away and lose the editor.
    const prevent = (e) => {
      if ([...(e.dataTransfer?.types || [])].includes("Files"))
        e.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);
  const choose = (files) => {
    if (disabled || input.current?.matches(":disabled") || !files?.length) return;
    setError("");
    if (files.length !== 1) {
      setError("Pilih satu file setiap kali mengunggah.");
      return;
    }
    const file = files[0],
      formats = (accept || "").split(",").map((s) => s.trim().toLowerCase());
    if (
      accept &&
      !formats.some((f) =>
        f.startsWith(".")
          ? file.name.toLowerCase().endsWith(f)
          : f.endsWith("/*")
            ? file.type.startsWith(f.slice(0, -1))
            : file.type === f,
      )
    ) {
      setError(`Format file tidak sesuai. Gunakan ${shownFormats}.`);
      return;
    }
    setName(file.name);
    onChange?.({
      target: { files: [file], value: "" },
      currentTarget: input.current,
    });
    if (input.current) input.current.value = "";
  };
  return (
    <div ref={host} className="file-drop-field">
      <label htmlFor={id}>{label}</label>
      <div
        className="file-drop"
        data-over={over}
        aria-disabled={disabled}
        onDragEnter={(e) => {
          if ([...(e.dataTransfer.types || [])].includes("Files")) {
            e.preventDefault();
            depth.current++;
            if (!disabled) setOver(true);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = disabled ? "none" : "copy";
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (!depth.current) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          depth.current = 0;
          setOver(false);
          choose(e.dataTransfer.files);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
        </svg>
        <div>
          <strong>Seret dan lepas file di sini</strong>
          <span>{name || `Atau pilih file · ${shownFormats}`}</span>
        </div>
        <input
          ref={input}
          id={id}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={accept}
          disabled={disabled}
          aria-describedby={`${id}-error`}
          onChange={(e) => choose(e.target.files)}
        />
        <button
          type="button"
          className="button button--outline"
          disabled={disabled}
          onClick={() => input.current.click()}
        >
          Pilih file
        </button>
      </div>
      <p id={`${id}-error`} className="file-drop-error" role="alert">
        {error}
      </p>
    </div>
  );
}
