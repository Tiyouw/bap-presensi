import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Guide from "./Guide.jsx";
import {
  HELP_AREAS,
  HELP_VERSION,
  helpTopic,
  pageHelpArea,
} from "../lib/helpContent.js";
import { beginHelpLayer, restoreHelpFocus } from "../lib/helpActivity.js";
import { lockBodyScroll } from "../lib/scrollLock.js";
import "./Help.css";

const HelpContext = createContext(null);
const defaults = {
  userId: "",
  role: "",
  enabled: false,
  capabilities: [],
  online: true,
  area: "login",
  path: "",
  classId: "",
};
const focusables = (root) =>
  [
    ...root.querySelectorAll(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ),
  ].filter(
    (e) =>
      e.getClientRects().length && getComputedStyle(e).visibility !== "hidden",
  );
const returnFocus = restoreHelpFocus;

export function HelpProvider({ children }) {
  const [scopes, setScopes] = useState({}),
    [panel, setPanel] = useState(null),
    [tooltip, setTooltip] = useState(null),
    [notice, setNotice] = useState("");
  const tooltipTimer = useRef(null),
    tour = useRef(null),
    launch = useRef(0),
    panelRef = useRef(null),
    live = useRef(null),
    panelState = useRef(null),
    suppressHint = useRef(null),
    tourController = useRef(null);
  panelState.current = panel;
  const cancelLaunch = useCallback(() => {
    launch.current++;
    tourController.current?.abort();
    tourController.current = null;
  }, []);
  const register = useCallback(
    (key, value, priority) =>
      setScopes((old) => ({ ...old, [key]: { value, priority } })),
    [],
  );
  const unregister = useCallback(
    (key) =>
      setScopes((old) => {
        const next = { ...old };
        delete next[key];
        return next;
      }),
    [],
  );
  const context = useMemo(
    () =>
      Object.values(scopes)
        .sort((a, b) => a.priority - b.priority)
        .reduce((value, s) => ({ ...value, ...s.value }), defaults),
    [scopes],
  );
  live.current = context;
  const hideTooltip = useCallback(() => {
    clearTimeout(tooltipTimer.current);
    setTooltip(null);
  }, []);
  const close = useCallback(() => {
    const old = panelState.current;
    suppressHint.current = old?.anchor;
    setPanel(null);
    if (old) requestAnimationFrame(() => returnFocus(old.anchor));
  }, []);
  const signature = JSON.stringify([
      context.userId,
      context.path,
      context.classId,
      context.role,
      context.enabled,
      context.capabilities,
      context.archived,
      context.meetingId,
      context.meetingStatus,
    ]),
    previousSignature = useRef(signature);
  useEffect(() => {
    if (previousSignature.current !== signature) {
      cancelLaunch();
      tour.current?.stop("context");
      tour.current = null;
      setPanel(null);
      hideTooltip();
      setNotice("");
      previousSignature.current = signature;
    }
  }, [signature, hideTooltip]);
  useEffect(
    () => () => {
      clearTimeout(tooltipTimer.current);
      cancelLaunch();
      tour.current?.stop("unmount");
    },
    [],
  );
  const showTooltip = useCallback(
    (id, anchor, immediate = false) => {
      clearTimeout(tooltipTimer.current);
      if (immediate && suppressHint.current === anchor) {
        suppressHint.current = null;
        return;
      }
      if (panel || tour.current || !helpTopic(id, live.current)) return;
      tooltipTimer.current = setTimeout(
        () => setTooltip({ id, anchor }),
        immediate ? 0 : 350,
      );
    },
    [panel],
  );
  const delayHideTooltip = useCallback(() => {
      clearTimeout(tooltipTimer.current);
      tooltipTimer.current = setTimeout(() => setTooltip(null), 150);
    }, []),
    keepTooltip = useCallback(() => clearTimeout(tooltipTimer.current), []);
  const openTopic = useCallback(
    (id, anchor) => {
      if (!helpTopic(id, live.current)) return;
      cancelLaunch();
      hideTooltip();
      tour.current?.stop("help");
      setPanel({ kind: "topic", id, anchor });
    },
    [hideTooltip],
  );
  const openCenter = useCallback(
    (options = {}) => {
      cancelLaunch();
      hideTooltip();
      tour.current?.stop("help");
      setPanel({
        kind: "center",
        anchor: options.anchor || document.activeElement,
        area: options.area ?? live.current.area,
        topic: options.topic || "",
      });
    },
    [hideTooltip],
  );
  const tourId =
    context.area === "presensi"
      ? "attendance"
      : context.area === "koreksi"
        ? "correction"
        : context.classId
          ? "class"
          : null;
  const startTour = useCallback(
    async (anchor) => {
      const id =
        live.current.area === "presensi"
          ? "attendance"
          : live.current.area === "koreksi"
            ? "correction"
            : live.current.classId
              ? "class"
              : null;
      if (!id || !live.current.userId) return;
      cancelLaunch();
      const request = ++launch.current,
        ctx = { ...live.current },
        controller = new AbortController();
      tourController.current = controller;
      hideTooltip();
      setPanel(null);
      setNotice("Memuat panduan langkah…");
      try {
        const { runHelpTour } = await import("../lib/helpTour.js");
        if (request !== launch.current) return;
        tour.current?.stop("replace");
        const running = await runHelpTour({
          id,
          context: ctx,
          anchor,
          signal: controller.signal,
          onNotice: setNotice,
          onEnd: () => {
            tour.current = null;
          },
        });
        if (request !== launch.current) {
          running.stop("context");
          return;
        }
        tour.current = running.isActive() ? running : null;
      } catch {
        if (request === launch.current)
          setNotice(
            "Tur belum dapat dimuat. Buka Bantuan halaman ini untuk membaca langkahnya; coba tur lagi setelah tersambung.",
          );
      }
    },
    [hideTooltip],
  );
  const value = useMemo(
    () => ({
      context,
      register,
      unregister,
      panel,
      tooltip,
      showTooltip,
      delayHideTooltip,
      keepTooltip,
      hideTooltip,
      openTopic,
      openCenter,
      startTour,
      tourId,
    }),
    [
      context,
      register,
      unregister,
      panel,
      tooltip,
      showTooltip,
      delayHideTooltip,
      keepTooltip,
      hideTooltip,
      openTopic,
      openCenter,
      startTour,
      tourId,
    ],
  );
  useEffect(() => {
    if (!panel && !tooltip) return;
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (panel) close();
        else hideTooltip();
        return;
      }
      if (!panel) return;
      if (e.key === "Tab") {
        const nodes = panelRef.current ? focusables(panelRef.current) : [];
        e.preventDefault();
        const i = nodes.indexOf(document.activeElement);
        nodes[
          i < 0
            ? e.shiftKey
              ? nodes.length - 1
              : 0
            : (i + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length
        ]?.focus();
      }
      e.stopPropagation();
    };
    const keyup = (e) => {
      if (panel) e.stopPropagation();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", keyup, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", keyup, true);
    };
  }, [panel, tooltip, close, hideTooltip]);
  useEffect(() => {
    if (!panel) return;
    const endLayer = beginHelpLayer(),
      releaseScroll = lockBodyScroll();
    return () => {
      endLayer();
      releaseScroll();
    };
  }, [Boolean(panel)]);
  const current = panel?.kind === "topic" ? helpTopic(panel.id, context) : null;
  useEffect(() => {
    if (panel?.kind === "topic" && !current) close();
  }, [panel?.id, current?.title, close]);
  const portal =
    panel?.anchor?.closest?.('.modal[role="dialog"]') || document.body;
  return (
    <HelpContext.Provider value={value}>
      {children}
      {notice && (
        <div className="help-global-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => {
              cancelLaunch();
              setNotice("");
            }}
            aria-label="Tutup pemberitahuan bantuan"
          >
            ×
          </button>
        </div>
      )}
      {panel &&
        (panel.kind === "center" || current) &&
        createPortal(
          <HelpPanel panel={panel} panelRef={panelRef} close={close}>
            {panel.kind === "center" ? (
              <Guide
                key={`${panel.area}:${panel.topic}`}
                context={context}
                initialArea={panel.area}
                initialTopic={panel.topic}
                onClose={close}
                tourAvailable={
                  Boolean(tourId) && !panel.anchor?.closest?.('[role="dialog"]')
                }
                onTour={() => startTour(panel.anchor)}
              />
            ) : (
              <>
                <header className="help-panel-header">
                  <h2 id="help-panel-title">{current.title}</h2>
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={close}
                    aria-label="Tutup penjelasan"
                  >
                    ×
                  </button>
                </header>
                <p className="help-summary">{current.summary}</p>
                {current.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {context.online === false && (
                  <p className="help-footnote">
                    Offline. Keadaan data dan izin mungkin tertinggal dari
                    server.
                  </p>
                )}
                <button
                  type="button"
                  className="button button--outline"
                  onClick={() =>
                    openCenter({
                      anchor: panel.anchor,
                      topic: panel.id,
                      area: "",
                    })
                  }
                >
                  Baca panduan terkait
                </button>
              </>
            )}
          </HelpPanel>,
          portal,
        )}
      {tooltip &&
        !panel &&
        helpTopic(tooltip.id, context) &&
        createPortal(
          <HelpTooltip
            data={tooltip}
            onEnter={keepTooltip}
            onLeave={delayHideTooltip}
            onMissing={hideTooltip}
          >
            {helpTopic(tooltip.id, context).summary}
          </HelpTooltip>,
          tooltip.anchor.closest('.modal[role="dialog"]') || document.body,
        )}
    </HelpContext.Provider>
  );
}
export function useHelp() {
  return useContext(HelpContext);
}
export function useHelpScope(value, priority = 10) {
  const help = useHelp(),
    id = useId(),
    serialized = JSON.stringify(value);
  useEffect(() => {
    help?.register(id, JSON.parse(serialized), priority);
    return () => help?.unregister(id);
  }, [help?.register, help?.unregister, id, serialized, priority]);
}
export function HelpScope({ value, priority }) {
  useHelpScope(value, priority);
  return null;
}
function usePosition(anchor, ref, center = false, onMissing) {
  const [style, setStyle] = useState({ visibility: "hidden" });
  useLayoutEffect(() => {
    const place = () => {
      if (center) {
        setStyle({});
        return;
      }
      if (!anchor?.isConnected) {
        onMissing?.();
        return;
      }
      const r = anchor.getBoundingClientRect(),
        height = ref.current?.offsetHeight || 200,
        width = Math.min(380, window.innerWidth - 24),
        left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      let top = r.bottom + 8;
      if (top + height > window.innerHeight - 12)
        top = Math.max(12, r.top - height - 8);
      top = Math.max(
        12,
        Math.min(
          top,
          window.innerHeight - Math.min(height, window.innerHeight - 24) - 12,
        ),
      );
      setStyle({ left, top, width, maxHeight: window.innerHeight - 24 });
    };
    place();
    const resize = new ResizeObserver(place);
    if (ref.current) resize.observe(ref.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, ref, center, onMissing]);
  return style;
}
function HelpPanel({ panel, panelRef, close, children }) {
  const style = usePosition(
    panel.anchor,
    panelRef,
    panel.kind === "center",
    close,
  );
  useLayoutEffect(() => {
    panelRef.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [panel.kind, panel.id]);
  return (
    <div
      className={`help-scrim ${panel.kind === "center" ? "help-scrim--center" : ""}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <section
        ref={panelRef}
        className={`help-panel ${panel.kind === "center" ? "help-panel--center" : ""}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-panel-title"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}
function HelpTooltip({ data, children, onEnter, onLeave, onMissing }) {
  const ref = useRef(null),
    style = usePosition(data.anchor, ref, false, onMissing);
  return (
    <div
      ref={ref}
      id={`help-tooltip-${data.id}`}
      role="tooltip"
      className="help-tooltip"
      style={style}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {children}
    </div>
  );
}
export function HelpButton({ topic, className = "" }) {
  const help = useHelp(),
    ref = useRef(null),
    content = helpTopic(topic, help?.context);
  if (!help || !content) return null;
  return (
    <button
      type="button"
      ref={ref}
      className={`help-trigger ${className}`}
      aria-label={`Penjelasan ${content.title}`}
      aria-haspopup="dialog"
      aria-expanded={
        help.panel?.kind === "topic" &&
        help.panel.id === topic &&
        help.panel.anchor === ref.current
      }
      aria-describedby={
        help.tooltip?.id === topic && help.tooltip.anchor === ref.current
          ? `help-tooltip-${topic}`
          : undefined
      }
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") help.showTooltip(topic, e.currentTarget);
      }}
      onPointerLeave={help.delayHideTooltip}
      onFocus={(e) => help.showTooltip(topic, e.currentTarget, true)}
      onBlur={help.delayHideTooltip}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        help.openTopic(topic, e.currentTarget);
      }}
    >
      <span aria-hidden="true">?</span>
    </button>
  );
}
export function HelpGroup({ topic, children, className = "" }) {
  return (
    <div className={`help-group ${className}`}>
      <span>{children}</span>
      <HelpButton topic={topic} />
    </div>
  );
}
export function PageHelp({ area }) {
  const help = useHelp();
  if (!help) return null;
  const current = area || help.context.area || pageHelpArea(help.context.path);
  return (
    <button
      type="button"
      className="help-trigger help-page-button"
      data-tour="page-help"
      title="Bantuan halaman ini"
      aria-label={`Bantuan halaman ini: ${HELP_AREAS[current] || "Panduan"}`}
      aria-haspopup="dialog"
      onClick={(e) =>
        help.openCenter({ anchor: e.currentTarget, area: current })
      }
    >
      <span aria-hidden="true">?</span>
    </button>
  );
}
export function DisabledReason({ children, id }) {
  return children ? (
    <p className="help-disabled-reason" id={id}>
      {children}
    </p>
  ) : null;
}
export function HelpWelcome() {
  const help = useHelp(),
    key = `bap.help.welcome.v${HELP_VERSION}.${help?.context.userId || "anonymous"}`;
  const read = () => {
      try {
        return Boolean(localStorage.getItem(key));
      } catch {
        return false;
      }
    },
    [dismissed, setDismissed] = useState(read);
  useEffect(() => setDismissed(read()), [key]);
  if (!help?.context.userId || dismissed) return null;
  return (
    <aside className="help-welcome">
      <div>
        <strong>Kenali ruang kerja BAP</strong>
        <p>
          Buka ikon (?) di header untuk bantuan halaman dan Tunjukkan caranya.
          Draf dan presensi tetap ada ketika panduan ditutup.
        </p>
      </div>
      <button
        type="button"
        className="button button--outline"
        onClick={(e) => help.openCenter({ anchor: e.currentTarget })}
      >
        Lihat panduan
      </button>
      <button
        type="button"
        className="button button--quiet"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(key, "1");
          } catch {}
        }}
      >
        Lewati
      </button>
    </aside>
  );
}
