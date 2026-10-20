import { Component, useEffect, useState } from "react";
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

function SessionApp({ token, onKeluar }) {
  const [dipilih, setDipilih] = useState(null);
  const [cache, setCache] = useState(bacaCache);
  const [seedError, setSeedError] = useState(false);
  const [guide, setGuide] = useState(null);
  const [autoGuideChecked, setAutoGuideChecked] = useState(false);
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

  const data = bootstrap || cache;
  useEffect(() => {
    if (!data?.peserta.length || autoGuideChecked) return;
    setAutoGuideChecked(true);
    if (!panduanSudahDilihat()) setGuide("first");
  }, [data, autoGuideChecked]);
  const closeGuide = () => {
    tutupPanduan();
    setGuide(null);
  };
  const pertemuan =
    dipilih && (data?.pertemuan.find((p) => p.id === dipilih.id) || dipilih);
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
          onHelp={() => setGuide("help")}
        />
      ) : (
        <>
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
            onKeluar={onKeluar}
            onHelp={() => setGuide("help")}
            token={token}
          />
        </>
      )}
      {guide && (
        <Guide key={guide} firstTime={guide === "first"} onClose={closeGuide} />
      )}
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(bacaToken);
  const keluar = () => {
    hapusToken();
    setToken("");
  };
  if (!token)
    return (
      <Login
        onMasuk={(value) => {
          simpanToken(value);
          setToken(value);
        }}
      />
    );
  return (
    <SessionBoundary key={token} onMasukUlang={keluar}>
      <SessionApp token={token} onKeluar={keluar} />
    </SessionBoundary>
  );
}
