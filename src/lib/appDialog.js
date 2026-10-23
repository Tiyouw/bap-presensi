const listeners = new Set();
let current = null;
let pointerAnchor = null;
export const subscribeDialog = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getDialog = () => current;
export const showAppToast = (message) =>
  window.dispatchEvent(new CustomEvent("bap:toast", { detail: message }));
const publish = () => listeners.forEach((fn) => fn());
export function finishDialog(accepted = false) {
  const old = current;
  if (!old) return;
  current = null;
  publish();
  old.resolve(Boolean(accepted));
}
function request(options) {
  // A second click must not stack decisions or run the same action twice.
  if (current) return Promise.resolve(false);
  return new Promise((resolve) => {
    const active = document.activeElement;
    const anchor =
      active === document.body && pointerAnchor?.isConnected
        ? pointerAnchor
        : active;
    current = { ...options, resolve, anchor };
    publish();
  });
}
export const confirmAction = (message, options = {}) =>
  request({
    title: "Lanjutkan tindakan ini?",
    message,
    cancelLabel: "Batal",
    confirmLabel: "Lanjutkan",
    ...options,
  });
export const noticeDialog = (message, options = {}) =>
  request({
    title: "Proses belum selesai",
    message,
    confirmLabel: "Mengerti",
    ...options,
  });
if (typeof window !== "undefined") {
  window.addEventListener("bap:navigate", () => finishDialog(false));
  // Safari does not focus buttons on pointer clicks; still return to the opener.
  window.addEventListener(
    "pointerdown",
    (event) => {
      pointerAnchor =
        event.target.closest?.(
          "button, a[href], input, select, textarea, [tabindex]",
        ) || null;
    },
    true,
  );
}
