import { useSyncExternalStore } from "react";
const layers = new Set(),
  listeners = new Set();
export const helpIsActive = () => layers.size > 0;
const publish = () => {
  listeners.forEach((fn) => fn());
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("bap:help-activity"));
};
export function beginHelpLayer() {
  const token = {};
  layers.add(token);
  publish();
  return () => {
    if (layers.delete(token)) publish();
  };
}
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export function useHelpActivity() {
  return useSyncExternalStore(subscribe, helpIsActive, () => false);
}
export function restoreHelpFocus(anchor) {
  const usable = (e) =>
    e?.isConnected &&
    !["BODY", "HTML"].includes(e.tagName) &&
    e.getClientRects().length &&
    !e.closest('[inert],[aria-hidden="true"]') &&
    getComputedStyle(e).visibility !== "hidden" &&
    !e.disabled;
  const menu = document.querySelector('[aria-label="Buka menu utama"]');
  const next = usable(anchor)
    ? anchor
    : usable(menu)
      ? menu
      : document.querySelector("#workspace-main, main h1");
  if (next) {
    if (!next.matches("button,a,input,select,textarea,[tabindex]"))
      next.setAttribute("tabindex", "-1");
    next.focus({ preventScroll: true });
  }
}
