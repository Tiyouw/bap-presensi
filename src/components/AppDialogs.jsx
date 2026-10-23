import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import Modal from "./Modal.jsx";
import { beginHelpLayer } from "../lib/helpActivity.js";
import { finishDialog, getDialog, subscribeDialog } from "../lib/appDialog.js";
import "./AppDialogs.css";

export default function AppDialogs() {
  const entry = useSyncExternalStore(subscribeDialog, getDialog, () => null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const onToast = (e) => setToast(e.detail);
    window.addEventListener("bap:toast", onToast);
    return () => window.removeEventListener("bap:toast", onToast);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useLayoutEffect(() => {
    if (!entry) return;
    const release = beginHelpLayer();
    const backgrounds = [...document.body.children]
      .filter(
        (e) =>
          !e.querySelector(".app-dialog") &&
          !["SCRIPT", "STYLE", "LINK"].includes(e.tagName),
      )
      .map((e) => [e, e.inert]);
    backgrounds.forEach(([e]) => {
      e.inert = true;
    });
    const key = (e) => {
      // The top decision owns keyboard events, including above another modal.
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        finishDialog(false);
      }
      if (e.key === "Tab") {
        const nodes = [
          ...document.querySelectorAll(
            ".app-dialog-actions button:not(:disabled)",
          ),
        ];
        const i = nodes.indexOf(document.activeElement);
        e.preventDefault();
        nodes[
          (i + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length
        ]?.focus();
      }
    };
    const keyup = (e) => e.stopImmediatePropagation();
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", keyup, true);
    const observer = new MutationObserver(() => {
      if (entry.anchor && !entry.anchor.isConnected) finishDialog(false);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = entry.isCurrent
      ? setInterval(() => {
          if (!entry.isCurrent()) finishDialog(false);
        }, 100)
      : null;
    return () => {
      release();
      backgrounds.forEach(([e, value]) => {
        e.inert = value;
      });
      observer.disconnect();
      clearInterval(timer);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", keyup, true);
    };
  }, [entry]);
  return (
    <>
      {toast && (
        <div className="app-toast" role="status">
          <span>{toast}</span>
          <button
            type="button"
            aria-label="Tutup pesan"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
      {entry && (
        <Modal
          title={entry.title}
          className="app-dialog"
          initialFocusSelector=".app-dialog-actions button"
          returnFocusRef={{ current: entry.anchor }}
          onClose={() => finishDialog(false)}
        >
          <p className="modal-description">{entry.message}</p>
          <div className="modal-actions app-dialog-actions">
            {entry.cancelLabel && (
              <button
                className="button button--quiet"
                onClick={() => finishDialog(false)}
              >
                {entry.cancelLabel}
              </button>
            )}
            <button
              className={`button ${entry.danger ? "button--danger" : "button--primary"}`}
              onClick={() => finishDialog(true)}
            >
              {entry.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
