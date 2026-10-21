import { useEffect, useRef, useState } from "react";

// Web Locks are held by the browser, including while a tab is suspended. A
// timestamp lease in localStorage cannot provide the same mutual exclusion.
export function useDraftLock(scope, onAcquired) {
  const callback = useRef(onAcquired);
  callback.current = onAcquired;
  const owned = useRef(false);
  const [state, setState] = useState({ owned: false, ready: false, supported: true });
  useEffect(() => {
    let disposed = false, pending = false, release, retry, activation;
    let unavailable = 0;
    setState({ owned: false, ready: false, supported: true });
    if (!navigator.locks?.request) {
      setState({ owned: false, ready: true, supported: false });
      return;
    }
    const acquire = async () => {
      if (disposed || pending || owned.current) return;
      pending = true;
      try {
        await navigator.locks.request(`bap.draft.editor.${scope}`, { ifAvailable: true }, async lock => {
          if (disposed) return;
          if (!lock) {
            // React StrictMode can release a previous effect's lock one task
            // later. Do not briefly expose a disabled editor as ready.
            if (++unavailable < 2) {
              retry = setTimeout(acquire, 25);
              return;
            }
            setState({ owned: false, ready: true, supported: true });
            return;
          }
          owned.current = true;
          unavailable = 0;
          try {
            callback.current(); // Load the latest shared draft before enabling input.
            activation = setTimeout(() => {
              if (!disposed && owned.current) setState({ owned: true, ready: true, supported: true });
            }, 0);
            await new Promise(resolve => { release = resolve; if (disposed) resolve(); });
          } finally { owned.current = false; }
        });
      } catch {
        if (!disposed) setState({ owned: false, ready: true, supported: false });
      } finally { pending = false; }
    };
    acquire();
    const timer = setInterval(acquire, 750);
    return () => { disposed = true; owned.current = false; clearInterval(timer); clearTimeout(retry); clearTimeout(activation); release?.(); };
  }, [scope]);
  return { ...state, owns: () => owned.current };
}
