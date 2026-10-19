import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api.js";

import Login from "./screens/Login.jsx";
import Pertemuan from "./screens/Pertemuan.jsx";
import Presensi from "./screens/Presensi.jsx";

import { bacaCache, bacaToken, hapusToken, simpanCache } from "./lib/store.js";

export default function App() {
  const [token, setToken] = useState(bacaToken());
  const [dipilih, setDipilih] = useState(null);
  const [cache, setCache] = useState(bacaCache());

  // Query bootstrap: satu panggilan berisi 16 pertemuan + 93 peserta.
  // Saat offline query mengembalikan undefined -> pakai cache localStorage.
  const bootstrap = useQuery(api.bootstrap.get, token ? { token } : "skip");
  const seed = useMutation(api.seed.jalan);

  useEffect(() => {
    if (bootstrap) {
      simpanCache(bootstrap);
      setCache(bootstrap);
    }
  }, [bootstrap]);

  // Data kosong = deployment baru yang belum di-seed. Panggil seed otomatis;
  // query bootstrap reaktif, jadi daftar muncul sendiri setelah seed selesai.
  useEffect(() => {
    if (token && bootstrap && bootstrap.peserta.length === 0) {
      seed().catch(() => {});
    }
  }, [token, bootstrap, seed]);

  if (!token) {
    return (
      <Login
        onMasuk={(t) => {
          localStorage.setItem("bap.token", t);
          setToken(t);
        }}
      />
    );
  }

  const data = bootstrap || cache;

  if (dipilih) {
    return (
      <Presensi
        token={token}
        pertemuan={dipilih}
        peserta={data?.peserta || []}
        onKembali={() => setDipilih(null)}
      />
    );
  }

  return (
    <Pertemuan
      data={data}
      online={Boolean(bootstrap)}
      onPilih={setDipilih}
      onKeluar={() => {
        hapusToken();
        setToken("");
      }}
    />
  );
}
