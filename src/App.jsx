import { Component, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api.js";
import Login from "./screens/Login.jsx";
import Pertemuan from "./screens/Pertemuan.jsx";
import Presensi from "./screens/Presensi.jsx";
import { Header, Notice } from "./components/Layout.jsx";
import {
  bacaCache,
  bacaToken,
  hapusToken,
  simpanCache,
  simpanToken,
} from "./lib/store.js";
import { useNetwork } from "./lib/useNetwork.js";
import Guide from "./components/Guide.jsx";
import { panduanSudahDilihat, tutupPanduan } from "./lib/guide.js";
import Modal from "./components/Modal.jsx";
import PrintPack from "./components/PrintPack.jsx";
import { LoginSplash } from "./components/Loading.jsx";
import { usePageReady } from "./lib/usePageReady.js";
import { adaPraktikum, tipePertemuan } from "../bap-shared/jadwal.js";

class SessionBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const text = String(
      this.state.error?.data || this.state.error?.message || "",
    );
    const auth = /TOKEN_|TANPA_TOKEN/.test(text);
    return (
      <>
        <Header />
        <main className="page recovery-page">
          <p className="eyebrow">BAP Praktikum</p>
          <h1>{auth ? "Masuk kembali" : "Data belum dapat dimuat"}</h1>
          <p className="lede">
            {auth
              ? "Sesi masuk sudah berakhir. Draf presensi tetap ada di perangkat ini."
              : "Periksa koneksi, lalu muat ulang halaman. Draf presensi tetap ada di perangkat ini."}
          </p>
          <button
            className="button button--primary"
            onClick={
              auth ? this.props.onMasukUlang : () => window.location.reload()
            }
          >
            {auth ? "Ke halaman masuk" : "Muat ulang halaman"}
          </button>
        </main>
      </>
    );
  }
}

function SessionApp({ token, onKeluar, entering, onReady }) {
  const [dipilih, setDipilih] = useState(null);
  const [cache, setCache] = useState(bacaCache);
  const [seedError, setSeedError] = useState(false);
  const [guide, setGuide] = useState(null);
  const [autoGuideChecked, setAutoGuideChecked] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printIds, setPrintIds] = useState([]);
  const [printContext, setPrintContext] = useState(null);
  const [startupTimedOut, setStartupTimedOut] = useState(false);
  const network = useNetwork();
  const bootstrap = useQuery(api.bootstrap.get, { token });
  const seed = useMutation(api.seed.jalan);

  useEffect(() => {
    if (bootstrap) {
      simpanCache(bootstrap);
      setCache(bootstrap);
    }
  }, [bootstrap]);

  useEffect(() => {
    if (bootstrap?.peserta.length === 0 && network.online)
      seed().catch(() => setSeedError(true));
  }, [bootstrap?.peserta.length, network.online, seed]);

  const source = bootstrap || cache;
  // Normalize old offline caches too; week 1 must never open as a practical.
  const data = useMemo(
    () => source && ({
      ...source,
      pertemuan: source.pertemuan.map((p) => ({ ...p, tipe: tipePertemuan(p) })),
    }),
    [source],
  );
  const sessionReady = usePageReady(Boolean(data?.peserta.length), "session");
  useEffect(() => {
    if (!entering || sessionReady) return;
    const timer = setTimeout(() => setStartupTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [entering, sessionReady]);
  useEffect(() => {
    if (entering && sessionReady) onReady();
  }, [entering, sessionReady, onReady]);
  useEffect(() => {
    if (!sessionReady || autoGuideChecked || printOpen || logoutOpen || dipilih)
      return;
    const timer = setTimeout(() => {
      setAutoGuideChecked(true);
      if (!panduanSudahDilihat()) setGuide("first");
    }, 240);
    return () => clearTimeout(timer);
  }, [sessionReady, autoGuideChecked, printOpen, logoutOpen, dipilih]);
  const closeGuide = () => {
    tutupPanduan();
    setGuide(null);
  };
  const selectedMeeting =
    dipilih && (data?.pertemuan.find((p) => p.id === dipilih.id) || dipilih);
  const pertemuan =
    selectedMeeting && adaPraktikum(selectedMeeting) ? selectedMeeting : null;
  const openPrint = (meeting = null) => {
    setPrintContext(meeting);
    if (meeting?.status === "KUNCI")
      setPrintIds((ids) =>
        ids.includes(meeting.id) ? ids : [...ids, meeting.id],
      );
    setPrintOpen(true);
  };
  const openHelp = () => {
    setAutoGuideChecked(true);
    setGuide("help");
  };
  if (entering && !sessionReady && !startupTimedOut && !seedError)
    return <LoginSplash />;
  return (
    <>
      {pertemuan ? (
        <Presensi
          key={pertemuan.id}
          token={token}
          pertemuan={pertemuan}
          peserta={data?.peserta || []}
          network={network}
          onKembali={() => setDipilih(null)}
          onHelp={openHelp}
          onPrint={openPrint}
        />
      ) : (
        <>
          {startupTimedOut && !sessionReady && (
            <Notice kind="warning">
              Data kelas belum selesai dimuat. Periksa koneksi; kamu dapat
              menunggu atau keluar lewat menu Keluar.
            </Notice>
          )}
          {seedError && (
            <Notice kind="error">
              Data kelas belum berhasil disiapkan. Periksa koneksi lalu muat
              ulang halaman.
            </Notice>
          )}
          <Pertemuan
            data={data}
            network={network}
            onPilih={setDipilih}
            onKeluar={() => setLogoutOpen(true)}
            onHelp={openHelp}
            onPrint={() => openPrint()}
            freshData={bootstrap}
          />
        </>
      )}
      {guide && (
        <Guide key={guide} firstTime={guide === "first"} onClose={closeGuide} />
      )}
      {printOpen && (
        <PrintPack
          token={token}
          network={network}
          onClose={() => setPrintOpen(false)}
          selected={printIds}
          onSelectionChange={setPrintIds}
          contextMeeting={printContext}
        />
      )}
      {logoutOpen && (
        <Modal
          title="Keluar dari aplikasi?"
          onClose={() => setLogoutOpen(false)}
        >
          <p className="modal-description">
            Kamu perlu memasukkan password lagi untuk kembali. Presensi di
            server dan draf yang tersimpan di perangkat ini tetap ada.
          </p>
          <div className="modal-actions">
            <button
              className="button button--outline button--full"
              onClick={() => setLogoutOpen(false)}
            >
              Batal
            </button>
            <button
              className="button button--primary button--full"
              onClick={onKeluar}
            >
              Ya, keluar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(bacaToken);
  const [entering, setEntering] = useState(false);
  const keluar = () => {
    hapusToken();
    setToken("");
    setEntering(false);
  };
  if (!token)
    return (
      <Login
        onMasuk={(value) => {
          simpanToken(value);
          setEntering(true);
          setToken(value);
        }}
      />
    );
  return (
    <SessionBoundary key={token} onMasukUlang={keluar}>
      <SessionApp
        token={token}
        onKeluar={keluar}
        entering={entering}
        onReady={() => setEntering(false)}
      />
    </SessionBoundary>
  );
}
