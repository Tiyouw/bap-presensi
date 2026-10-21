import { useEffect, useLayoutEffect, useRef, useState } from "react";

const storageKey = (userId) => `bap.sidebar.v1.${userId}`;
const readPinned = (userId) => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)));
    return typeof saved?.pinned === "boolean" ? saved.pinned : true;
  } catch {
    return true;
  }
};
const editable = (target) => target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])");

export default function useSidebar({ userId, path, suspended }) {
  const [preference, setPreference] = useState(() => ({ userId, pinned: readPinned(userId) }));
  const pinned = preference.userId === userId ? preference.pinned : readPinned(userId);
  const [mobile, setMobile] = useState(() => matchMedia("(max-width: 640px)").matches);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const sidebarRef = useRef(null), triggerRef = useRef(null), searchRef = useRef(null);
  const topbarRef = useRef(null), workspaceRef = useRef(null);
  const pointerInside = useRef(false), keyboardWithin = useRef(false), keyboardInput = useRef(false);
  const restoreFocus = useRef(true);
  const timers = useRef({});
  const previousExpanded = useRef(pinned);
  const current = useRef({ pinned, mobile, mobileOpen, suspended, modalOpen, revealed, closing });
  current.current = { pinned, mobile, mobileOpen, suspended, modalOpen, revealed, closing };
  const hasDialog = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"], dialog[open]')].some(el => !sidebarRef.current?.contains(el));
  const blocked = () => current.current.suspended || hasDialog();
  function cancel(name) {
    clearTimeout(timers.current[name]);
    delete timers.current[name];
  }
  function cancelAll() {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  }
  function closeMobile(focus = true) {
    restoreFocus.current = focus;
    setMobileOpen(false);
  }
  function resetTransient() {
    cancelAll();
    pointerInside.current = false;
    keyboardWithin.current = false;
    setRevealed(false);
    setClosing(false);
  }
  function scheduleClose() {
    cancel("open");
    cancel("close");
    timers.current.close = setTimeout(() => {
      if (!pointerInside.current && !keyboardWithin.current) setRevealed(false);
    }, 180);
  }
  function enter(event) {
    if (event.pointerType !== "mouse") return;
    pointerInside.current = true;
    cancel("close");
    if (current.current.pinned || current.current.mobile || blocked()) return;
    cancel("open");
    if (current.current.closing || current.current.revealed) {
      cancel("settle");
      setClosing(false);
      setRevealed(true);
      return;
    }
    timers.current.open = setTimeout(() => {
      if (pointerInside.current && !current.current.mobile && !blocked()) setRevealed(true);
    }, 100);
  }
  function leave(event) {
    if (event.pointerType !== "mouse") return;
    pointerInside.current = false;
    if (!current.current.mobile) scheduleClose();
  }
  function focus(event) {
    if (!keyboardInput.current || current.current.mobile || blocked()) return;
    keyboardWithin.current = true;
    cancel("close");
    cancel("open");
    setRevealed(true);
  }
  function blur(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    keyboardWithin.current = false;
    if (!current.current.mobile) scheduleClose();
  }
  function togglePinned() {
    cancelAll();
    const next = !current.current.pinned;
    setPreference({ userId, pinned: next });
    setClosing(false);
    setRevealed(!next && !blocked() && (pointerInside.current || keyboardWithin.current));
    try { localStorage.setItem(storageKey(userId), JSON.stringify({ pinned: next })); } catch {}
  }
  function toggleMobile() {
    restoreFocus.current = true;
    setMobileOpen(value => !value);
  }

  useEffect(() => {
    resetTransient();
    closeMobile(false);
    setPreference({ userId, pinned: readPinned(userId) });
  }, [userId]);
  useEffect(() => {
    resetTransient();
    closeMobile(false);
  }, [path]);
  useEffect(() => {
    const query = matchMedia("(max-width: 640px)");
    const change = () => { resetTransient(); closeMobile(true); setMobile(query.matches); };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const observe = () => setModalOpen(hasDialog());
    const observer = new MutationObserver(observe);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role", "aria-modal", "open"] });
    observe();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (suspended || modalOpen) { resetTransient(); closeMobile(false); }
    else if (matchMedia("(hover: hover) and (pointer: fine)").matches && sidebarRef.current?.matches(":hover")) enter({ pointerType: "mouse" });
  }, [suspended, modalOpen]);
  useEffect(() => {
    cancel("settle");
    const expanded = pinned || revealed;
    if (expanded || mobile) setClosing(false);
    else if (previousExpanded.current) {
      setClosing(true);
      const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
      timers.current.settle = setTimeout(() => setClosing(false), duration);
    }
    previousExpanded.current = expanded;
    return () => cancel("settle");
  }, [pinned, mobile, revealed]);
  useEffect(() => () => cancelAll(), []);

  useLayoutEffect(() => {
    if (!mobile || !mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const background = [topbarRef.current, workspaceRef.current].filter(Boolean);
    const previousInert = background.map(el => el.inert);
    document.body.style.overflow = "hidden";
    background.forEach(el => { el.inert = true; });
    if (sidebarRef.current) sidebarRef.current.inert = false;
    sidebarRef.current?.querySelector('[data-sidebar-close]')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((el, i) => { el.inert = previousInert[i]; });
      if (restoreFocus.current && triggerRef.current?.getClientRects().length) triggerRef.current.focus({ preventScroll: true });
    };
  }, [mobile, mobileOpen]);
  useLayoutEffect(() => {
    if (sidebarRef.current) sidebarRef.current.inert = modalOpen || (mobile && !mobileOpen);
  }, [modalOpen, mobile, mobileOpen]);
  useEffect(() => {
    const pointer = () => {
      keyboardInput.current = false;
      if (keyboardWithin.current) {
        keyboardWithin.current = false;
        if (!pointerInside.current) scheduleClose();
      }
    };
    const key = (event) => {
      if (event.key === "Tab") keyboardInput.current = true;
      if (blocked()) return;
      const value = current.current;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && !event.isComposing && event.key.toLowerCase() === "b" && !editable(event.target)) {
        event.preventDefault();
        if (!event.repeat) value.mobile ? toggleMobile() : togglePinned();
        return;
      }
      if (event.key === "Escape") {
        if (value.mobile && value.mobileOpen) { event.preventDefault(); closeMobile(); }
        else if (!value.pinned && !value.mobile && sidebarRef.current?.contains(event.target)) {
          event.preventDefault(); resetTransient(); searchRef.current?.focus();
        }
      }
      if (event.key === "Tab" && value.mobile && value.mobileOpen) {
        const nodes = [...sidebarRef.current.querySelectorAll('button:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && (document.activeElement === first || !sidebarRef.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !sidebarRef.current.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [userId]);

  return { pinned, mobile, mobileOpen, expanded: pinned || revealed, hitOpen: pinned || revealed || closing, modalOpen,
    sidebarRef, triggerRef, searchRef, topbarRef, workspaceRef, enter, leave, focus, blur,
    togglePinned, toggleMobile, closeMobile, hasDialog,
    onNavigate: () => { resetTransient(); closeMobile(false); },
  };
}
