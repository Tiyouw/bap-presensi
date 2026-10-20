import Brand from "./Brand.jsx";
import { ThemeSelect } from "./Theme.jsx";
import { SkeletonRows } from "./Loading.jsx";
import { useContext } from "react";
import { WorkspaceContext } from "../lib/ScopedStorage.jsx";

export function Header({
  onKeluar,
  onKembali,
  onBap,
  onUndo,
  onHelp,
  undoDisabled,
  busy,
}) {
  const workspace = useContext(WorkspaceContext);
  if (workspace)
    return onKembali || onBap || onUndo ? (
      <div className="mg-local-toolbar">
        {onKembali && (
          <button
            className="button button--quiet"
            disabled={busy}
            onClick={onKembali}
          >
            ← Pertemuan
          </button>
        )}
        <div>
          {onUndo && (
            <button
              className="button button--quiet"
              disabled={undoDisabled || busy}
              onClick={onUndo}
            >
              Urungkan
            </button>
          )}
          {onBap && (
            <button className="button button--quiet" onClick={onBap}>
              BAP
            </button>
          )}
          {onHelp && (
            <button
              className="button button--quiet"
              onClick={onHelp}
              aria-label="Bantuan"
            >
              ?
            </button>
          )}
        </div>
      </div>
    ) : null;
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
          {onHelp && (
            <button
              className="button button--quiet help-button"
              onClick={onHelp}
              aria-label="Bantuan"
              title="Bantuan"
            >
              <span aria-hidden="true">?</span>
            </button>
          )}
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
      <SkeletonRows title={title} />
    </main>
  );
}
