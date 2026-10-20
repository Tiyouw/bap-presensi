const KEY = "bap.guide.dismissed.v1";
let dismissedInMemory = false;

export function panduanSudahDilihat() {
  if (dismissedInMemory) return true;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function tutupPanduan() {
  dismissedInMemory = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Still dismiss for this visit when device storage is unavailable.
  }
}
