import { Component, useEffect, useRef, useState } from "react";
import { reconcileDraft } from "./lib/draft.js";
import { pesanGalat } from "./lib/presensi.js";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api.js";
import Login from "./screens/Login.jsx";
import Presensi from "./screens/Presensi.jsx";
import Accounts, { Profile } from "./screens/Accounts.jsx";
import {
  ClassList,
  ClassWorkspace,
  NewClass,
  Documents,
} from "./screens/Classes.jsx";
import Workspace from "./components/Workspace.jsx";
import {
  StorageScope,
  WorkspaceContext,
  useScopedStore,
} from "./lib/ScopedStorage.jsx";
import {
  bacaToken,
  hapusToken,
  simpanToken,
  bacaCache,
  simpanCache,
  bacaDetail,
  bacaDraf,
  simpanDraf,
} from "./lib/store.js";
import { useNetwork } from "./lib/useNetwork.js";
import { useLocation, navigate, canLeave } from "./lib/navigation.js";
import { LoginSplash, SkeletonRows } from "./components/Loading.jsx";
import { Notice } from "./components/Layout.jsx";
import Modal from "./components/Modal.jsx";
import { HelpWelcome, useHelp, useHelpScope } from "./components/Help.jsx";
import { pageHelpArea } from "./lib/helpContent.js";
import PrintPack from "./components/PrintPack.jsx";
const cachedIdentity = (token) => {
  try {
    return JSON.parse(
      localStorage.getItem(`bap.identity.${token.slice(0, 16)}`),
    );
  } catch {
    return null;
  }
};
class SessionBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const auth = /TOKEN_|TANPA_TOKEN/.test(
      String(this.state.error?.data || this.state.error?.message || ""),
    );
    return (
      <main className="mg-page mg-narrow">
        <h1>{auth ? "Masuk kembali" : "Data belum dapat dimuat"}</h1>
        <p>
          {auth
            ? "Sesi berakhir atau akses akun berubah. Draf tetap tersimpan untuk akun ini."
            : "Periksa koneksi atau akses kelas. Draf lokal tetap tersimpan."}
        </p>
        <button
          className="button button--primary"
          onClick={
            auth
              ? this.props.onLogout
              : () => {
                  navigate("/");
                  this.setState({ error: null });
                }
          }
        >
          {auth ? "Ke halaman masuk" : "Kembali ke beranda"}
        </button>
      </main>
    );
  }
}
function Session({ token, onLogout }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, []);
  const remoteUser = useQuery(api.auth.me, { token }),
    user = remoteUser === undefined ? cachedIdentity(token) : remoteUser,
    path = useLocation(),
    network = useNetwork();
  useEffect(() => {
    if(remoteUser===null)onLogout();
    if (remoteUser)
      try {
        localStorage.setItem(
          `bap.identity.${token.slice(0, 16)}`,
          JSON.stringify(remoteUser),
        );
      } catch {}
  }, [remoteUser, token]);
  if (!user)
    return slow ? (
      <main className="mg-page mg-narrow">
        <h1>Koneksi belum tersedia.</h1>
        <p>
          Periksa koneksi lalu muat ulang. Jika akun baru selesai disiapkan,
          coba masuk kembali.
        </p>
        <button
          className="button button--outline"
          onClick={() => window.location.reload()}
        >
          Coba lagi
        </button>
        <button className="button button--quiet" onClick={onLogout}>
          Ke halaman masuk
        </button>
      </main>
    ) : (
      <LoginSplash />
    );
  if (user.wajibGanti)
    return <Profile token={token} user={user} onLogout={onLogout} forced />;
  return (
    <Authenticated
      token={token}
      user={user}
      path={path}
      network={network}
      onLogout={onLogout}
    />
  );
}
function Authenticated({ token, user, path, network, onLogout }) {
  const help = useHelp();
  useHelpScope({userId:user.id,role:user.peran,path,area:pageHelpArea(path),online:network.online},10);
  const catalog = useQuery(api.kelola.catalog, { token }),
    [cache, setCache] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem(`bap.catalog.${user.id}`));
      } catch {
        return null;
      }
    }),
    [logout, setLogout] = useState(false),
    [print, setPrint] = useState(null),
    [choices, setChoices] = useState({});
  useEffect(() => {
    if (catalog) {
      setCache(catalog);
      try {
        localStorage.setItem(`bap.catalog.${user.id}`, JSON.stringify(catalog));
      } catch {}
    }
  }, [catalog, user.id]);
  const data = catalog || cache;
  if (!data) return <LoginSplash />;
  const pathname = path.split("?")[0],
    parts = pathname.split("/").filter(Boolean),
    kelasId = parts[0] === "kelas" && parts[1] !== "baru" ? parts[1] : null;
  const openPrint = (id, meeting) => {
    setPrint({ kelasId: id, meeting });
    if (meeting?.status === "KUNCI")
      setChoices((prev) => ({
        ...prev,
        [id]: [...new Set([...(prev[id] || []), meeting.id])],
      }));
  };
  let content;
  if (pathname === "/" || pathname === "/kelas")
    content = <ClassList catalog={data} user={user} home={pathname === "/"} />;
  else if (pathname === "/kelas/baru" && user.peran !== "OPERATOR")
    content = <NewClass token={token} user={user} catalog={data} path={path} />;
  else if (kelasId && data.kelas.some((c) => c.id === kelasId))
    content = (
      <StorageScope.Provider value={`${user.id}:${kelasId}`}>
        <ClassRoute
          key={kelasId}
          token={token}
          user={user}
          kelasId={kelasId}
          catalog={data}
          network={network}
          path={path}
          pertemuanId={parts[2] === "pertemuan" ? parts[3] : null}
          onPrint={openPrint}
          onHelp={source => help.openCenter({anchor:source instanceof HTMLElement?source:source?.currentTarget instanceof HTMLElement?source.currentTarget:undefined})}
        />
      </StorageScope.Provider>
    );
  else if (pathname === "/pengaturan")
    content = <Profile token={token} user={user} onLogout={onLogout} />;
  else if (pathname === "/akun" && user.peran === "ADMIN")
    content = <Accounts token={token} user={user} catalog={data} />;
  else if (pathname === "/dokumen")
    content = <Documents token={token} catalog={data} onPrint={openPrint} />;
  else
    content = (
      <main className="mg-page">
        <h1>Halaman tidak tersedia.</h1>
        <p>Periksa alamat atau akses kelas pada akunmu.</p>
        <button
          className="button button--primary"
          onClick={() => navigate("/")}
        >
          Ke beranda
        </button>
      </main>
    );
  return (
    <WorkspaceContext.Provider value={{ user }}>
      <Workspace
        token={token}
        user={user}
        catalog={data}
        path={path}
        kelasId={kelasId}
        onLogout={() => {if(canLeave())setLogout(true);}}
        onHelp={source => help.openCenter({anchor:source instanceof HTMLElement?source:source?.currentTarget instanceof HTMLElement?source.currentTarget:undefined})}
      >
        {!network.online && (
          <div className="mg-offline">
            <Notice kind="warning">
              Offline. Memakai data perangkat; manajemen kelas, simpan server,
              dan pembuatan BAP memerlukan koneksi.
            </Notice>
          </div>
        )}
        <HelpWelcome/>
        {content}
      </Workspace>
      {print && (
        <PrintPack
          key={print.kelasId}
          token={token}
          kelasId={print.kelasId}
          network={network}
          onClose={() => setPrint(null)}
          selected={choices[print.kelasId] || []}
          onSelectionChange={(next) =>
            setChoices((prev) => ({
              ...prev,
              [print.kelasId]:
                typeof next === "function"
                  ? next(prev[print.kelasId] || [])
                  : next,
            }))
          }
          contextMeeting={print.meeting}
        />
      )}
      {logout && (
        <Modal title="Keluar dari aplikasi?" onClose={() => setLogout(false)}>
          <p>
            Presensi di server dan draf akun ini tetap tersimpan. Akun lain
            tidak akan memakai drafmu.
          </p>
          <div className="modal-actions">
            <button
              className="button button--outline"
              onClick={() => setLogout(false)}
            >
              Batal
            </button>
            <button className="button button--primary" onClick={onLogout}>
              Ya, keluar
            </button>
          </div>
        </Modal>
      )}
    </WorkspaceContext.Provider>
  );
}
function ClassRoute({
  token,
  user,
  kelasId,
  catalog,
  network,
  path,
  pertemuanId,
  onPrint,
  onHelp,
}) {
  const fresh = useQuery(api.kelola.detail, { token, kelasId }),
    scope = `${user.id}:${kelasId}`,
    [cache, setCache] = useState(() => bacaCache(scope));
  useEffect(() => {
    if (fresh) {
      simpanCache(fresh, scope);
      setCache(fresh);
    }
  }, [fresh, scope]);
  const data = fresh || cache;
  useHelpScope({classId:kelasId,enabled:Boolean(data?.controls?.enabled),capabilities:data?.controls?.capabilities||[],archived:Boolean(data?.kelas.arsip),area:pageHelpArea(path),meetingId:pertemuanId||new URLSearchParams(path.split("?")[1]).get("correct")||"",meetingStatus:data?.pertemuan.find(p=>p.id===pertemuanId)?.status||""},20);
  if (!data)
    return (
      <main className="mg-page">
        <SkeletonRows title="Memuat kelas" />
      </main>
    );
  if (pertemuanId) {
    const p = data.pertemuan.find((p) => p.id === pertemuanId);
    if (!p || p.cancelled || p.tipe !== "REGULER")
      return (
        <main className="mg-page">
          <h1>Tidak ada presensi praktikum.</h1>
          <button
            className="button button--primary"
            onClick={() => navigate(`/kelas/${kelasId}`)}
          >
            Kembali ke kelas
          </button>
        </main>
      );
    return (
      <AttendanceRoute
        token={token}
        data={data}
        user={user}
        network={network}
        meeting={p}
        kelasId={kelasId}
        onPrint={(meeting) => onPrint(kelasId, meeting)}
        onHelp={onHelp}
      />
    );
  }
  return (
    <>
      <LegacyDrafts user={user} data={data} />
      <ClassWorkspace
        token={token}
        user={user}
        catalog={catalog}
        data={data}
        network={network}
        path={path}
        onPrint={onPrint}
        onHelp={onHelp}
      />
    </>
  );
}
function AttendanceRoute({
  token,
  data,
  user,
  network,
  meeting,
  kelasId,
  onPrint,
  onHelp,
}) {
  const detail = useQuery(api.sesi.detail, { token, pertemuanId: meeting.id }),
    store = useScopedStore(),
    cached = store.bacaDetail(meeting.id),
    [refreshKey, setRefreshKey] = useState(0),
    [override, setOverride] = useState(null),
    refresh = useMutation(api.kelola.refreshSnapshot),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [snapshotBusy, setSnapshotBusy] = useState(false),
    [resumeDraft, setResumeDraft] = useState(null),
    snapshotControls = useRef(null);
  if (!detail && network.online)
    return (
      <main className="mg-page">
        <SkeletonRows title="Memuat presensi" rows={6} />
      </main>
    );
  const snapshot =
      override &&
      (!detail || override.pertemuan.revision > detail.pertemuan.revision)
        ? override
        : detail || cached,
    peserta =
      snapshot?.peserta || data.peserta.filter((p) => p.aktif !== false),
    kelas = snapshot?.kelas || data.kelas;
  return (
    <>
      {(data.kelas.arsip || data.kelas.draft) && (
        <div className="mg-attendance-notice">
          <Notice kind="warning">
            {data.kelas.arsip
              ? "Kelas diarsipkan. Presensi hanya dapat dibaca."
              : "Kelas masih draf. Selesaikan persiapan dan aktifkan untuk menyimpan presensi."}
          </Notice>
        </div>
      )}
      {meeting.revision > 0 &&
        meeting.status === "TERBUKA" &&
        !data.controls?.enabled &&
        user.peran !== "OPERATOR" &&
        !data.kelas.arsip && (
          <div className="mg-attendance-notice">
            <Notice>
              Memakai identitas, template, dan peserta saat sesi dikunci.
              <button
                className="button button--outline"
                onClick={() => setConfirm(true)}
              >
                Terapkan data kelas terbaru
              </button>
            </Notice>
          </div>
        )}
      <Presensi
        key={`${meeting.id}:${refreshKey}`}
        token={token}
        pertemuan={snapshot?.pertemuan || meeting}
        peserta={peserta}
        kelas={kelas}
        readOnly={data.kelas.arsip || data.kelas.draft}
        snapshotControls={snapshotControls}
        resumeDraft={resumeDraft}
        onResumeCleared={() => setResumeDraft(null)}
        network={network}
        onKembali={() => navigate(`/kelas/${kelasId}`)}
        onEditMeeting={data.controls?.enabled && (data.controls.capabilities.includes("schedule") || data.controls.capabilities.includes("history"))
          ? () => navigate(`/kelas/${kelasId}?tab=jadwal&correct=${meeting.id}`) : undefined}
        onHelp={onHelp}
        onPrint={onPrint}
      />
      {confirm && (
        <Modal
          title="Perbarui data sesi dari kelas?"
          onClose={() => setConfirm(false)}
          busy={snapshotBusy}
        >
          <p>
            Peserta akan mengikuti{" "}
            {data.peserta.filter((p) => p.aktif !== false).length} mahasiswa
            aktif. Dosen menjadi {data.kelas.dosen}, template versi{" "}
            {data.kelas.templateVersion}. Status peserta baru dimulai Hadir dan
            wajib diperiksa sebelum dikunci. Arsip revisi lama tetap tersedia.
          </p>
          {error && <Notice kind="error">{error}</Notice>}
          <button
            className="button button--primary"
            disabled={snapshotBusy || !network.online}
            onClick={async () => {
              if (snapshotBusy) return;
              setSnapshotBusy(true);
              setError("");
              try {
                const draft = snapshotControls.current?.prepare();
                if (!draft) throw Error("Editor presensi belum siap. Tunggu data selesai dimuat.");
                const updated = await refresh({
                  token,
                  pertemuanId: meeting.id,
                  baseRevision: draft.baseRevision,
                });
                const reconciled = reconcileDraft(draft, updated.peserta, updated.presensi);
                const nextDraft = { ...reconciled, baseRevision: updated.pertemuan.revision,
                  panggil: null, needsRosterReview: true, ts: Date.now() };
                // Keep the in-memory copy too: a post-mutation storage failure must
                // not discard corrections that were already safely backed up.
                const persisted = store.simpanDraf(meeting.id, nextDraft);
                setResumeDraft(persisted ? null : nextDraft);
                store.simpanDetail(meeting.id, updated);
                setOverride(updated);
                setRefreshKey((k) => k + 1);
                setConfirm(false);
              } catch (e) {
                setError(e.data?.message || (e.data ? pesanGalat(e) : String(e.message || e)));
                snapshotControls.current?.abort();
              } finally {
                setSnapshotBusy(false);
              }
            }}
          >
            Ya, terapkan & periksa ulang
          </button>
        </Modal>
      )}
    </>
  );
}
function LegacyDrafts({ user, data }) {
  const [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    scope = `${user.id}:${data.kelas.id}`;
  let claimed = false;
  try {
    claimed = Boolean(localStorage.getItem("bap.legacyDraftClaimed"));
  } catch {}
  const drafts = data.pertemuan
    .map((p) => ({ id: p.id, draft: bacaDraf(p.id) }))
    .filter((p) => p.draft);
  if (done || claimed || !drafts.length || data.kelas.matkulKode !== "PPB")
    return null;
  return (
    <div className="mg-attendance-notice">
      <Notice kind="warning">
        Draf dari aplikasi lama ditemukan di perangkat ini. Ambil hanya jika
        draf tersebut milikmu.
        <button
          className="button button--outline"
          disabled={busy}
          onClick={async () => {
            if (!navigator.locks?.request) { setError("Gunakan browser terbaru melalui HTTPS untuk mengambil draf dengan aman."); return; }
            setBusy(true);
            setError("");
            try {
              for (const p of drafts) {
                await navigator.locks.request(`bap.draft.editor.${scope}:${p.id}`, { ifAvailable: true }, lock => {
                  if (!lock) throw Error("Tutup tab presensi yang sedang mengedit sebelum mengambil draf lama.");
                  // Never replace a newer account-scoped draft with legacy data.
                  if (!bacaDraf(`${scope}:${p.id}`) && !simpanDraf(`${scope}:${p.id}`, p.draft))
                    throw Error("Draf belum dapat disimpan. Periksa ruang penyimpanan lalu coba lagi.");
                });
              }
              localStorage.setItem("bap.legacyDraftClaimed", user.id);
              setDone(true);
            } catch (e) { setError(e.message); }
            finally { setBusy(false); }
          }}
        >
          Ambil {drafts.length} draf untuk akun ini
        </button>
      </Notice>
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}
export default function App() {
  const [token, setToken] = useState(bacaToken),
    logout = useMutation(api.auth.logout);
  const exit = () => {
    if (token) logout({ token }).catch(() => {});
    hapusToken();
    setToken("");
  };
  if (!token)
    return (
      <Login
        onMasuk={(value) => {
          simpanToken(value);
          setToken(value);
          navigate("/", true);
        }}
      />
    );
  return (
    <SessionBoundary key={token} onLogout={exit}>
      <Session token={token} onLogout={exit} />
    </SessionBoundary>
  );
}
