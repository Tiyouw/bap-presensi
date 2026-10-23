import { useEffect, useRef } from "react";
import { registerNavigationGuard } from "./navigation.js";
import { confirmAction, noticeDialog } from "./appDialog.js";

// A synchronous baseline also covers navigation in the same tick as a save.
export function useEditorGuard(value, enabled = true, busy = false, discardMessage = "Perubahan editor belum disimpan. Tinggalkan halaman dan buang perubahan?") {
  const serialized = JSON.stringify(value);
  const baseline = useRef(serialized);
  const latest = useRef(serialized);
  const state = useRef(null);
  latest.current = serialized;
  state.current = { enabled, busy, discardMessage };
  const warning = () => {
    if (!state.current.enabled) return null;
    if (state.current.busy)
      return { block: true, message: "Tunggu proses penyimpanan selesai sebelum berpindah halaman." };
    return baseline.current !== latest.current
      ? { message: state.current.discardMessage }
      : null;
  };
  useEffect(() => {
    const remove = registerNavigationGuard(warning);
    const unload = event => {
      if (!warning()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      remove();
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  return {
    markSaved: (saved = undefined) => {
      baseline.current = saved === undefined ? latest.current : JSON.stringify(saved);
    },
    canDiscard: async () => {
      const w = warning();
      if (!w) return true;
      if (w.block) { await noticeDialog(w.message); return false; }
      const accepted = await confirmAction(w.message, { title: "Buang perubahan?", confirmLabel: "Buang perubahan", danger: true });
      return accepted && !warning()?.block;
    },
  };
}
