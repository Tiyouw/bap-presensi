import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import Brand from "../components/Brand.jsx";
import { Header, Notice } from "../components/Layout.jsx";
import { KELAS } from "../lib/presensi.js";
import { LoginSplash } from "../components/Loading.jsx";

export default function Login({ onMasuk }) {
  const login = useAction(api.authNode.login);
  const [password, setPassword] = useState("");
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
        login({ password }),
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
            <span className="small-label">Mata kuliah</span>
            <strong>{KELAS.nama}</strong>
            <span>
              {KELAS.prodi} · {KELAS.semester}
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
          <p className="muted">Gunakan password yang sudah disiapkan.</p>
          <label className="field-label" htmlFor="password">
            Password
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
            disabled={sibuk || !password}
            type="submit"
          >
            {sibuk ? "Memeriksa password…" : "Masuk ke aplikasi"}
            <span aria-hidden="true">→</span>
          </button>
          <p className="login-footnote">
            Satu akun untuk mengelola presensi dan BAP kelas.
          </p>
        </form>
      </main>
      <footer className="login-footer">
        BAP Praktikum <span>Politeknik Negeri Jember</span>
      </footer>
    </div>
  );
}
