import { useEffect, useRef, useState } from "react";
import Brand from "./Brand.jsx";

export function LoginSplash({ title = "Menyiapkan ruang kerja" }) {
  return (
    <main className="login-splash" role="status" aria-live="polite">
      <div className="login-splash-content">
        <div className="login-splash-brand">
          <Brand large />
        </div>
        <p className="eyebrow">Presensi & dokumen praktikum</p>
        <h1>{title}</h1>
        <p className="lede">Menyiapkan akses ke presensi dan dokumen BAP.</p>
        <div className="login-loading-track" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  );
}

export function SkeletonRows({ title, rows = 4 }) {
  return (
    <div
      className="skeleton-region"
      role="status"
      aria-busy="true"
      aria-label={title}
    >
      <span className="sr-only">{title}</span>
      <div aria-hidden="true">
        <div className="skeleton skeleton--heading" />
        {Array.from({ length: rows }, (_, i) => (
          <div className="skeleton skeleton--row" key={i} />
        ))}
      </div>
    </div>
  );
}

export function RefreshHint({ value, pending = false }) {
  const previous = useRef(value);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const old = previous.current;
    previous.current = value;
    if (!value || !old || old === value) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    const timer = setTimeout(() => setRefreshing(false), 220);
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <>
      <div
        className={`refresh-hint${pending || refreshing ? " is-loading" : ""}`}
        aria-hidden="true"
      >
        <div className="skeleton" />
      </div>
      <span className="sr-only" role="status">
        {pending || refreshing ? "Memperbarui data" : ""}
      </span>
    </>
  );
}
