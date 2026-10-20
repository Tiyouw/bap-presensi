import { useEffect, useState } from "react";

// Entry skeletons last briefly on fast connections, and wait for real data on
// slow ones. Once revealed, reactive updates never hide an active editor.
export function usePageReady(ready, key, minimumMs = 220) {
  const [phase, setPhase] = useState({ key, elapsed: false, loaded: ready });
  useEffect(() => {
    setPhase({ key, elapsed: false, loaded: false });
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(
      () => {
        setPhase((current) =>
          current.key === key ? { ...current, elapsed: true } : current,
        );
      },
      reduced ? 0 : minimumMs,
    );
    return () => clearTimeout(timer);
  }, [key, minimumMs]);
  useEffect(() => {
    if (ready)
      setPhase((current) =>
        current.key === key && !current.loaded
          ? { ...current, loaded: true }
          : current,
      );
  }, [ready, key]);
  return phase.key === key && phase.elapsed && (phase.loaded || ready);
}
