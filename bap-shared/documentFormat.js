import { DEFAULT_TEMPLATE } from "./management.js";

// Missing fields from older versions receive the official defaults. Explicit
// blanks/customisations are preserved; stored versions and snapshots are not edited.
export function documentMeta(meta = {}) {
  return { ...DEFAULT_TEMPLATE, ...meta };
}

export function staffName(label, name, identifier) {
  return `${label?.trim() ? label.trim() + ": " : ""}${name}${identifier ? ` (${identifier})` : ""}`;
}
