import { useEffect, useState, useRef, useDeferredValue } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import Brand from "./Brand.jsx";
import Modal from "./Modal.jsx";
import { ThemeSelect } from "./Theme.jsx";
import Sidebar from "./Sidebar.jsx";
import WorkspaceIcon from "./WorkspaceIcon.jsx";
import useSidebar from "../lib/useSidebar.js";
import "./Sidebar.css";
import {
  FEATURES,
  classFeatures,
  linkClick,
  navigate,
} from "../lib/navigation.js";
import { matches } from "../../bap-shared/management.js";
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
export const SearchIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m16 16 5 5" />
  </svg>
);
export function Search({ token, user, catalog, kelasId, onClose }) {
  const [q, setQ] = useState(""),
    [archived, setArchived] = useState(false),
    [index, setIndex] = useState(0),
    input = useRef(),
    slow = useDeferredValue(q);
  const remote = useQuery(
    api.kelola.search,
    q.trim()
      ? {
          token,
          q: slow,
          includeArsip: archived,
          ...(kelasId ? { kelasId } : {}),
        }
      : "skip",
  );
  const eligible = (x) =>
    (!x.admin || user.peran === "ADMIN") &&
    (!x.manage || user.peran !== "OPERATOR");
  const key = `bap.recent.${user.id}`,
    featureClasses = catalog.kelas
      .filter((c) => !c.arsip)
      .sort((a, b) => Number(b.id === kelasId) - Number(a.id === kelasId)),
    features = [
      ...FEATURES,
      ...featureClasses.flatMap((c) =>
        classFeatures(c.id).map((feature) => ({
          ...feature,
          context: `${c.matkulKode} · ${c.nama} · ${c.semester} ${c.tahunAkademik}`,
          aliases: `${feature.aliases} ${c.matkulNama} ${c.matkulKode} ${c.nama}`,
        })),
      ),
    ].filter(eligible);
  const recent = read(key, [])
    .filter(eligible)
    .filter((x) =>
      x.path.startsWith("/kelas/")
        ? catalog.kelas.some((c) => x.path.split("/")[2] === c.id)
        : features.some((f) => f.path === x.path),
    );
  const items = q.trim()
    ? [
        ...features.filter((x) => matches(`${x.title} ${x.aliases}`, q)),
        ...(slow === q ? remote || [] : []),
      ]
    : [
        ...recent,
        ...features.filter((f) => !recent.some((r) => r.path === f.path)),
      ].slice(0, 12);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    setIndex(0);
  }, [q, archived]);
  useEffect(() => {
    document
      .getElementById(`search-result-${index}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  const open = (item) => {
    if (!item) return;
    write(
      key,
      [
        { ...item, aliases: undefined },
        ...recent.filter((r) => r.path !== item.path),
      ].slice(0, 8),
    );
    onClose();
    navigate(item.path);
  };
  return (
    <Modal
      title="Cari & akses cepat"
      onClose={onClose}
      wide
      initialFocusSelector="#global-search"
    >
      <div className="mg-command">
        <label className="sr-only" htmlFor="global-search">
          Cari matkul, mahasiswa, atau fitur
        </label>
        <div className="mg-command-input">
          <SearchIcon />
          <input
            ref={input}
            id="global-search"
            type="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari matkul, mahasiswa, atau fitur…"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={
              items[index] ? `search-result-${index}` : undefined
            }
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.max(0, Math.min(i + 1, items.length - 1)));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                open(items[index]);
              }
            }}
          />
        </div>
        <label className="mg-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Sertakan kelas arsip
        </label>
        <p className="muted" role="status">
          {q.trim()
            ? remote === undefined
              ? "Mencari…"
              : `${items.length} hasil · sesuai akses akun`
            : recent.length
              ? "Akses terakhir & pintasan"
              : "Mulai dari fitur yang sering dipakai"}
        </p>
        <div
          id="search-results"
          role="listbox"
          aria-label="Hasil pencarian"
          className="mg-search-results"
        >
          {items.map((item, i) => (
            <button
              type="button"
              key={`${item.kind}:${item.id || item.path}`}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === index}
              className={`mg-search-result ${i === index ? "is-active" : ""}`}
              onMouseMove={() => setIndex(i)}
              onClick={() => open(item)}
            >
              <span className="mg-result-type">{item.kind}</span>
              <span>
                <strong>{item.title}</strong>
                {item.context && <small>{item.context}</small>}
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
          {!items.length && remote !== undefined && (
            <div className="empty-state">
              <h3>Belum ada hasil</h3>
              <p>Coba nama, NIM, kode matkul, tanggal, atau nama fitur.</p>
            </div>
          )}
        </div>
        <div className="mg-command-footer">
          <span>↑ ↓ Pilih</span>
          <span>↵ Buka</span>
          <span>Esc Tutup</span>
        </div>
      </div>
    </Modal>
  );
}
export default function Workspace({
  token,
  user,
  catalog,
  path,
  children,
  onLogout,
  onHelp,
  kelasId,
}) {
  const [search, setSearch] = useState(false),
    [profile, setProfile] = useState(false);
  const navigation = useSidebar({ userId: user.id, path, suspended: search || profile });
  useEffect(() => {
    if (!profile) return;
    const close = (e) => {
      if (e.key === "Escape") {
        setProfile(false);
        document.querySelector(".mg-profile-button")?.focus();
      }
    };
    const outside = (e) => {
      if (!e.target.closest(".mg-profile-wrap")) setProfile(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, [profile]);
  const apple = /Mac|iPhone|iPad/.test(navigator.platform),
    current = catalog.kelas.find((c) => c.id === kelasId);
  useEffect(() => {
    const key = (e) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.isComposing &&
        (search || !navigation.hasDialog())
      ) {
        e.preventDefault();
        if (!e.repeat) {
          navigation.closeMobile(false);
          setSearch((s) => !s);
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [search]);
  useEffect(() => {
    setProfile(false);
  }, [path]);
  const nav = [
    ...FEATURES.filter(
      (f) =>
        !["/kelas/baru", "/pengaturan"].includes(f.path) &&
        (!f.admin || user.peran === "ADMIN"),
    ),
    { title: "Pengaturan", path: "/pengaturan" },
  ];
  return (
    <div
      className={`mg-shell mg-shell--nav${path.includes("/pertemuan/") ? " mg-shell--attendance" : ""}`}
      data-sidebar-pinned={navigation.pinned}
    >
      <a className="mg-skip" href="#workspace-main">
        Lewati navigasi
      </a>
      <header className="mg-topbar" ref={navigation.topbarRef}>
        <button type="button" className="ws-icon-button mg-mobile-menu" ref={navigation.triggerRef} onClick={navigation.toggleMobile} aria-label="Buka menu utama" aria-controls="workspace-sidebar" aria-expanded={navigation.mobileOpen}>
          <WorkspaceIcon name="menu" />
        </button>
        <a
          href="/"
          onClick={(e) => linkClick(e, "/")}
          className="mg-brand-link"
          aria-label="BAP Praktikum — Beranda"
        >
          <Brand />
        </a>
        <div className="mg-context">
          {current ? (
            <>
              <span>{current.matkulKode}</span>
              <span className="muted">/</span>
              <strong>{current.nama}</strong>
            </>
          ) : (
            <span>Ruang kerja praktikum</span>
          )}
        </div>
        <button
          className="mg-search-trigger"
          ref={navigation.searchRef}
          onClick={() => setSearch(true)}
          aria-label="Cari matkul, mahasiswa, atau fitur"
        >
          <SearchIcon />
          <span>Cari di ruang kerja…</span>
          <kbd>{apple ? "⌘" : "Ctrl"} K</kbd>
        </button>
        <div className="mg-profile-wrap">
          <button
            className="button button--quiet mg-profile-button"
            onClick={() => setProfile(!profile)}
            aria-expanded={profile}
            aria-label="Menu akun"
          >
            {user.nama.split(" ")[0]} <span aria-hidden="true">⌄</span>
          </button>
          {profile && (
            <div className="mg-profile-menu">
              <strong>{user.nama}</strong>
              <small>{user.peran}</small>
              <a
                href="/pengaturan"
                onClick={(e) => linkClick(e, "/pengaturan")}
              >
                Profil & password
              </a>
              <ThemeSelect />
              <button
                onClick={() => {
                  setProfile(false);
                  onHelp();
                }}
              >
                Bantuan
              </button>
              <button
                onClick={() => {
                  setProfile(false);
                  onLogout();
                }}
              >
                Keluar
              </button>
            </div>
          )}
        </div>
      </header>
      <Sidebar navigation={navigation} nav={nav} path={path} onHelp={onHelp} apple={apple} />
      <div id="workspace-main" className="mg-workspace" tabIndex="-1" ref={navigation.workspaceRef}>
        {children}
      </div>
      {search && (
        <Search
          token={token}
          user={user}
          catalog={catalog}
          kelasId={kelasId}
          onClose={() => setSearch(false)}
        />
      )}
    </div>
  );
}
