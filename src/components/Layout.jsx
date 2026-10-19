import Brand from "./Brand.jsx";
import { ThemeSelect } from "./Theme.jsx";

export function Header({
  onKeluar,
  onKembali,
  onBap,
  onUndo,
  undoDisabled,
  busy,
}) {
  return (
    <header className="app-header">
      <div
        className={`app-header-inner${onKembali ? " app-header-inner--workspace" : ""}`}
      >
        {onKembali ? (
          <div className="workspace-header-start">
            <button
              className="button button--quiet"
              onClick={onKembali}
              disabled={busy}
            >
              ← Pertemuan
            </button>
            <span className="desktop-brand">
              <Brand />
            </span>
          </div>
        ) : (
          <Brand />
        )}
        <div className="header-actions">
          {onUndo && (
            <button
              className="button button--quiet"
              onClick={onUndo}
              disabled={undoDisabled}
            >
              Urungkan
            </button>
          )}
          {onBap && (
            <button className="button button--quiet" onClick={onBap}>
              BAP
            </button>
          )}
          <ThemeSelect />
          {onKeluar && (
            <button className="button button--quiet" onClick={onKeluar}>
              Keluar
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function ConnectionStatus({ network }) {
  return (
    <span
      className={`connection ${network.online ? "connection--online" : "connection--offline"}`}
    >
      <span className="connection-dot" aria-hidden="true" />
      {network.online
        ? "Tersambung"
        : network.deviceOnline
          ? "Menghubungkan…"
          : "Offline"}
    </span>
  );
}

export function Notice({ kind = "info", children, actions }) {
  return (
    <div
      className={`notice notice--${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <div>{children}</div>
      {actions && <div className="notice-actions">{actions}</div>}
    </div>
  );
}

export function Loading({ title = "Menyiapkan data kelas" }) {
  return (
    <main className="page loading-page" aria-busy="true" aria-label={title}>
      <p className="eyebrow">BAP Praktikum</p>
      <h1>{title}</h1>
      <div className="skeleton skeleton--heading" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton--row" />
      ))}
    </main>
  );
}
