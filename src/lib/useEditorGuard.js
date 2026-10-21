import { useEffect, useRef } from "react";
import { registerNavigationGuard } from "./navigation.js";

// A synchronous baseline also covers navigation in the same tick as a save.
export function useEditorGuard(value, enabled = true, busy = false) {
  const serialized = JSON.stringify(value);
  const baseline = useRef(serialized);
  const latest = useRef(serialized);
  const state = useRef(null);
  latest.current = serialized;
  state.current = { enabled, busy };
  const warning = () => {
    if (!state.current.enabled) return null;
    if (state.current.busy)
      return { block: true, message: "Tunggu proses penyimpanan selesai sebelum berpindah halaman." };
    return baseline.current !== latest.current
      ? { message: "Perubahan editor belum disimpan. Tinggalkan halaman dan buang perubahan?" }
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
    canDiscard: () => {
      const w = warning();
      return !w || (!w.block && window.confirm(w.message));
    },
  };
}
