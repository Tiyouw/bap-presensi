import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api.js";

export default function Login({ onMasuk }) {
  const login = useAction(api.authNode.login);
  const [password, setPassword] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    try {
      const { token } = await login({ password });
      onMasuk(token);
    } catch (err) {
      const pesan = String(err?.data || err?.message || err);
      setGalat(
        pesan.includes("PASSWORD_SALAH")
          ? "Password salah."
          : pesan.includes("belum diset")
            ? "Server belum dikonfigurasi (BAP_PASS_HASH)."
            : "Gagal masuk. Periksa koneksi."
      );
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form className="login card" onSubmit={kirim}>
      <h1 style={{ fontSize: 18, marginTop: 0 }}>Presensi &amp; BAP</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Pengantar Pariwisata Budaya — Prodi Destinasi Pariwisata
      </p>
      <input
        type="password"
        placeholder="Password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {galat && <div className="alert" style={{ marginTop: 10 }}>{galat}</div>}
      <div style={{ marginTop: 12 }}>
        <button className="primary" disabled={sibuk || !password}>
          {sibuk ? "Memeriksa…" : "Masuk"}
        </button>
      </div>
    </form>
  );
}
