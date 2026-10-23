import { useHelpScope } from "../components/Help.jsx";
import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import Brand from "../components/Brand.jsx";
import { Header, Notice } from "../components/Layout.jsx";
import { LoginSplash } from "../components/Loading.jsx";

export default function Login({ onMasuk }) {
  useHelpScope({area:"login",userId:"",role:"",classId:"",enabled:false,capabilities:[]},5);
  const login = useAction(api.authNode.login);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [visible, setVisible] = useState(false);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => {
    if (galat) inputRef.current?.focus();
  }, [galat]);

  async function kirim(event) {
    event.preventDefault();
    if (sibuk || !password) return;
    setSibuk(true);
    setGalat("");
    try {
      const [hasil] = await Promise.all([
        login({
          username,
          password,
          recovery,
          label: /Mac|iPhone|iPad/.test(navigator.platform)
            ? "Apple / browser"
            : "Browser",
        }),
        new Promise((resolve) =>
          setTimeout(
            resolve,
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : 350,
          ),
        ),
      ]);
      onMasuk(hasil.token);
    } catch (error) {
      const pesan = String(error?.data || error?.message || error);
      setGalat(
        pesan.includes("PASSWORD_SALAH")
          ? "Password belum cocok. Periksa dan coba lagi."
          : pesan.includes("belum diset")
            ? "Aplikasi belum siap digunakan. Hubungi pengelola aplikasi."
            : pesan.includes("TERLALU_BANYAK")
              ? "Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi."
              : "Belum berhasil masuk. Periksa koneksi dan coba lagi.",
      );
    } finally {
      setSibuk(false);
    }
  }

  if (sibuk) return <LoginSplash title="Memeriksa akses" />;
  return (
    <div className="login-layout">
      <Header />
      <main className="login-main">
        <section className="login-intro">
          <Brand large />
          <p className="eyebrow">Presensi & dokumen praktikum</p>
          <h1>
            Catat kehadiran.
            <br />
            BAP langsung siap.
          </h1>
          <p className="lede">
            Tandai mahasiswa yang tidak hadir, periksa kembali, lalu buat
            dokumen BAP dari presensi yang sama.
          </p>
          <div className="login-course">
            <span className="small-label">
              Satu ruang kerja untuk semua kelas
            </span>
            <strong>Atur kelas. Periksa presensi. Cetak BAP.</strong>
            <span>
              Mahasiswa, jadwal, dosen, dan template mengikuti kelasnya.
            </span>
          </div>
        </section>
        <form
          className="login-form"
          onSubmit={kirim}
          aria-labelledby="login-title"
        >
          <p className="eyebrow">Ruang kerja asisten dosen</p>
          <h2 id="login-title">Masuk</h2>
          <p className="muted">Gunakan akun yang disiapkan admin.</p>
          <label className="field-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <label className="field-label" htmlFor="password">
            {recovery ? "Kode pemulihan" : "Password"}
          </label>
          <div className="password-field">
            <input
              ref={inputRef}
              id="password"
              type={visible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={Boolean(galat)}
              aria-describedby={galat ? "login-error" : undefined}
            />
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setVisible(!visible)}
              aria-pressed={visible}
            >
              {visible ? "Sembunyikan" : "Lihat"}
            </button>
          </div>
          {galat && (
            <div id="login-error">
              <Notice kind="error">{galat}</Notice>
            </div>
          )}
          <button
            className="button button--primary button--full"
            disabled={sibuk || !password || !username}
            type="submit"
          >
            {sibuk ? "Memeriksa password…" : "Masuk ke aplikasi"}
            <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => {
              setRecovery(!recovery);
              setPassword("");
              setGalat("");
            }}
          >
            {recovery ? "Kembali ke password" : "Gunakan kode pemulihan admin"}
          </button>
          <p className="login-footnote">
            Lupa password? Minta admin mereset akun. Tidak ada pendaftaran
            publik.
          </p>
        </form>
      </main>
      <footer className="login-footer">
        BAP Praktikum <span>Politeknik Negeri Jember</span>
      </footer>
    </div>
  );
}
