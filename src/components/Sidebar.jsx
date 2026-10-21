import { navigate } from "../lib/navigation.js";
import WorkspaceIcon from "./WorkspaceIcon.jsx";

const icons = { "/": "home", "/kelas": "classes", "/dokumen": "documents", "/akun": "accounts", "/pengaturan": "settings" };

export default function Sidebar({ navigation: n, nav, path, onHelp, apple }) {
  const modifier = apple ? "⌘" : "Ctrl";
  const help = () => { n.onNavigate(); onHelp(); };
  return (
    <>
      {n.mobile && n.mobileOpen && <button className="ws-sidebar-backdrop" aria-label="Tutup menu utama" onClick={() => n.closeMobile()} />}
      <aside
        id="workspace-sidebar"
        className="mg-sidebar ws-sidebar"
        ref={n.sidebarRef}
        aria-label="Navigasi utama"
        role={n.mobile && n.mobileOpen ? "dialog" : undefined}
        aria-modal={n.mobile && n.mobileOpen ? "true" : undefined}
        data-expanded={n.expanded}
        data-hit-open={n.hitOpen}
        data-mobile-open={n.mobileOpen}
        onPointerEnter={n.enter}
        onPointerLeave={n.leave}
        onFocusCapture={n.focus}
        onBlurCapture={n.blur}
      >
        <div className="ws-sidebar-panel">
          <div className="ws-drawer-heading">
            <strong>Menu utama</strong>
            <button type="button" className="ws-icon-button" data-sidebar-close aria-label="Tutup menu utama" onClick={() => n.closeMobile()}><WorkspaceIcon name="close" /></button>
          </div>
          <div className="ws-sidebar-scroll">
            <p className="ws-nav-group"><span className="ws-nav-label">Ruang kerja</span></p>
            <nav aria-label="Menu ruang kerja">
              {nav.map(item => {
                const active = item.path === "/" ? path === "/" : path.startsWith(item.path);
                return (
                  <a key={item.path} href={item.path} className={`ws-nav-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} aria-label={item.title}
                    onClick={event => {
                      if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                        event.preventDefault();
                        if (navigate(item.path)) n.onNavigate();
                      }
                    }}>
                    <span className="ws-nav-symbol"><WorkspaceIcon name={icons[item.path]} /></span>
                    <span className="ws-nav-label">{item.title}</span>
                  </a>
                );
              })}
            </nav>
          </div>
          <footer className="ws-sidebar-footer">
            <button type="button" className="ws-nav-item" onClick={help} aria-label="Bantuan & panduan">
              <span className="ws-nav-symbol"><WorkspaceIcon name="help" /></span><span className="ws-nav-label">Bantuan & panduan</span>
            </button>
            <button type="button" className="ws-nav-item ws-pin-button" data-sidebar-pin aria-pressed={n.pinned} aria-label={n.pinned ? "Aktifkan mode hover" : "Sematkan sidebar"} title={`${n.pinned ? "Mode hover" : "Sematkan sidebar"} · ${modifier} B`} onClick={n.togglePinned}>
              <span className="ws-nav-symbol"><WorkspaceIcon name="panel" /></span>
              <span className="ws-nav-label ws-pin-label"><span>{n.pinned ? "Mode hover" : "Sematkan sidebar"}</span><kbd>{modifier} B</kbd></span>
            </button>
          </footer>
        </div>
      </aside>
    </>
  );
}
