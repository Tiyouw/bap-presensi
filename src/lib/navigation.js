import { useSyncExternalStore, useEffect } from "react";
const subscribe = (fn) => {
  window.addEventListener("bap:navigate", fn);
  return () => window.removeEventListener("bap:navigate", fn);
};
let currentPath = window.location.pathname + window.location.search;
let currentIndex = window.history.state?.bapIndex ?? 0,
  restoring = false;
window.history.replaceState(
  { ...window.history.state, bapIndex: currentIndex },
  "",
  currentPath,
);
const location = () => currentPath;
const guards = new Set();
export function registerNavigationGuard(guard) {
  guards.add(guard);
  return () => guards.delete(guard);
}
export function canLeave() {
  for (const guard of guards) {
    const warning = guard();
    if (!warning) continue;
    if (warning.block) {
      window.alert(warning.message);
      return false;
    }
    if (!window.confirm(warning.message)) return false;
  }
  return true;
}
export function navigate(path, replace = false) {
  if (!canLeave()) return false;
  if (!replace) currentIndex++;
  window.history[replace ? "replaceState" : "pushState"](
    { bapIndex: currentIndex },
    "",
    path,
  );
  currentPath = path;
  window.dispatchEvent(new Event("bap:navigate"));
  return true;
}
window.addEventListener("popstate", (event) => {
  if (restoring) {
    restoring = false;
    return;
  }
  const nextIndex = event.state?.bapIndex ?? currentIndex - 1;
  if (!canLeave()) {
    restoring = true;
    window.history.go(currentIndex - nextIndex || 1);
    return;
  }
  currentIndex = nextIndex;
  currentPath = window.location.pathname + window.location.search;
  window.dispatchEvent(new Event("bap:navigate"));
});
export function useLocation() {
  const path = useSyncExternalStore(subscribe, location);
  useEffect(() => {
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
          capability:"roster",
          title: "Impor mahasiswa",
          aliases: "excel csv upload peserta roster",
          path: `/kelas/${kelasId}?tab=mahasiswa&import=1`,
          kind: "Fitur kelas",
          manage: true,
        },
        {
          capability:"schedule",
          title: "Atur jadwal",
          aliases: "tanggal minggu praktikum libur uts uas",
          path: `/kelas/${kelasId}?tab=jadwal`,
          kind: "Fitur kelas",
          manage: true,
        },
        {
          capability:"template",
          title: "Template BAP",
          aliases: "kop logo dosen asdos preview pdf",
          path: `/kelas/${kelasId}?tab=template`,
          kind: "Fitur kelas",
          manage: true,
        },
      ].map(f=>({...f,...(capabilities?{manage:false,allowed:capabilities.includes(f.capability)||f.capability==="schedule"&&capabilities.some(c=>["history","lifecycle"].includes(c))}:{})})).filter(f=>f.allowed!==false)
    : [];
}
