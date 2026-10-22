import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { helpIsActive } from "../lib/helpActivity.js";
import { lockBodyScroll } from "../lib/scrollLock.js";

export default function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
  initialFocusSelector,
  className = "",
  onKeyDown,
  returnFocusRef,
  headerActions,
}) {
  const titleId = useId();
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const previous = document.activeElement;
    const releaseScroll = lockBodyScroll();
    ref.current
      ?.querySelector(initialFocusSelector || "button:not(:disabled)")
      ?.focus();
    const keydown = (event) => {
      if (event.defaultPrevented || helpIsActive()) return;
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = [
        ...ref.current.querySelectorAll(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ),
      ];
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !ref.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !ref.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      releaseScroll();
      document.removeEventListener("keydown", keydown);
      const target = returnFocusRef?.current || previous;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={ref}
        className={`modal${wide ? " modal--wide" : ""} ${className}`}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          {headerActions}
          <button
            className="button button--quiet"
            onClick={onClose}
            disabled={busy}
          >
            Tutup
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
