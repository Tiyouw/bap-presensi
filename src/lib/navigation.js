import { useSyncExternalStore, useEffect } from "react";
import { confirmAction, noticeDialog } from "./appDialog.js";
const subscribe = (fn) => {
  window.addEventListener("bap:navigate", fn);
  return () => window.removeEventListener("bap:navigate", fn);
};
let currentPath = window.location.pathname + window.location.search;
let currentIndex = window.history.state?.bapIndex ?? 0,
  restoring = false,
  navigationPending = false,
  restored = null,
  replay = null,
  restoration = Promise.resolve();
window.history.replaceState(
  { ...window.history.state, bapIndex: currentIndex },
  "",
  currentPath,
);
const location = () => currentPath;
const guards = new Set();
const idle = new Set();
const releaseNavigation = () => {
  navigationPending = false;
  const waiting = [...idle];
  idle.clear();
  waiting.forEach((resolve) => resolve());
};
export const waitForNavigationIdle = () =>
  navigationPending
    ? new Promise((resolve) => idle.add(resolve))
    : Promise.resolve();
export function registerNavigationGuard(guard) {
  guards.add(guard);
  return () => guards.delete(guard);
}
export async function canLeave() {
  for (const guard of guards) {
    const warning = guard();
    if (!warning) continue;
    if (warning.block) {
      await noticeDialog(warning.message, {
        isCurrent: () => guards.has(guard) && Boolean(guard()?.block),
      });
      return false;
    }
    if (
      !(await confirmAction(warning.message, {
        title: "Tinggalkan perubahan?",
        cancelLabel: "Tetap di sini",
        confirmLabel: "Tinggalkan halaman",
        danger: true,
      }))
    )
      return false;
    if (!guards.has(guard)) return false;
    const latest = guard();
    if (latest?.block) {
      await noticeDialog(latest.message);
      return false;
    }
    if (latest && latest.message !== warning.message) return false;
  }
  return true;
}
export async function navigate(path, replace = false) {
  if (navigationPending) return false;
  navigationPending = true;
  try {
    if (!(await canLeave())) return false;
    if (!replace) currentIndex++;
    window.history[replace ? "replaceState" : "pushState"](
      { bapIndex: currentIndex },
      "",
      path,
    );
    currentPath = path;
    window.dispatchEvent(new Event("bap:navigate"));
    return true;
  } finally {
    releaseNavigation();
  }
}
window.addEventListener("popstate", async (event) => {
  const nextIndex = event.state?.bapIndex ?? currentIndex - 1;
  if (restoring) {
    if (nextIndex !== currentIndex) {
      window.history.go(currentIndex - nextIndex);
      return;
    }
    restoring = false;
    const done = restored;
    restored = null;
    done?.();
    return;
  }
  if (replay && nextIndex === replay.index) {
    replay = null;
    releaseNavigation();
    currentIndex = nextIndex;
    currentPath = window.location.pathname + window.location.search;
    window.dispatchEvent(new Event("bap:navigate"));
    return;
  }
  if (navigationPending || [...guards].some((guard) => guard())) {
    const target = {
      index: nextIndex,
      path: window.location.pathname + window.location.search,
    };
    restoring = true;
    const waiting = (restoration = new Promise((resolve) => {
      restored = resolve;
    }));
    window.history.go(currentIndex - nextIndex || 1);
    if (navigationPending) return;
    navigationPending = true;
    await waiting;
    const accepted = await canLeave();
    await restoration;
    if (accepted) {
      replay = target;
      window.history.go(target.index - currentIndex);
    } else releaseNavigation();
    return;
  }
  currentIndex = nextIndex;
  currentPath = window.location.pathname + window.location.search;
  window.dispatchEvent(new Event("bap:navigate"));
});
export function useLocation() {
  const path = useSyncExternalStore(subscribe, location);
  useEffect(() => {
    window.scrollTo(0, 0);
    const h = document.querySelector("main h1");
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
  }, [path]);
  return path;
}
export function linkClick(event, path) {
  if (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  ) {
    event.preventDefault();
    navigate(path);
  }
}
export const FEATURES = [
  {
    title: "Beranda",
    aliases: "dashboard home kelas aktif",
    path: "/",
    kind: "Fitur",
  },
  {
    title: "Matkul & kelas",
    aliases: "mata kuliah kelas daftar semester",
    path: "/kelas",
    kind: "Fitur",
  },
  {
    title: "Tambah kelas",
    aliases: "buat baru matkul mata kuliah",
    path: "/kelas/baru",
    kind: "Fitur",
    manage: true,
  },
  {
    title: "Dokumen BAP",
    aliases: "arsip pdf word cetak unduh",
    path: "/dokumen",
    kind: "Fitur",
  },
  {
    title: "Profil & password",
    aliases: "akun sandi pengaturan sesi perangkat",
    path: "/pengaturan",
    kind: "Fitur",
  },
  {
    title: "Akun & akses",
    aliases: "pengguna operator peran admin reset",
    path: "/akun",
    kind: "Fitur",
    admin: true,
  },
];
export function classFeatures(kelasId, capabilities) {
  return kelasId
    ? [
        {
          capability: "roster",
          title: "Impor mahasiswa",
          aliases: "excel csv upload peserta roster",
          path: `/kelas/${kelasId}?tab=mahasiswa&import=1`,
          kind: "Fitur kelas",
          manage: true,
        },
        {
          capability: "schedule",
          title: "Atur jadwal",
          aliases: "tanggal minggu praktikum libur uts uas",
          path: `/kelas/${kelasId}?tab=jadwal`,
          kind: "Fitur kelas",
          manage: true,
        },
        {
          capability: "template",
          title: "Template BAP",
          aliases: "kop logo dosen asdos preview pdf",
          path: `/kelas/${kelasId}?tab=template`,
          kind: "Fitur kelas",
          manage: true,
        },
      ]
        .map((f) => ({
          ...f,
          ...(capabilities
            ? {
                manage: false,
                allowed:
                  capabilities.includes(f.capability) ||
                  (f.capability === "schedule" &&
                    capabilities.some((c) =>
                      ["history", "lifecycle"].includes(c),
                    )),
              }
            : {}),
        }))
        .filter((f) => f.allowed !== false)
    : [];
}
