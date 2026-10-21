import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App.jsx";
import { ThemeProvider } from "./components/Theme.jsx";
import Brand from "./components/Brand.jsx";
import "./styles.css";
import "./management.css";

const url = import.meta.env.VITE_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  }, { once: true });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      {client ? (
        <ConvexProvider client={client}>
          <App />
        </ConvexProvider>
      ) : (
        <main className="page recovery-page">
          <Brand large />
          <h1>Aplikasi belum siap</h1>
          <p className="lede">
            Koneksi server belum disiapkan. Hubungi pengelola aplikasi untuk
            melanjutkan.
          </p>
          <details className="setup-details">
            <summary>Informasi untuk pengelola</summary>
            <p>
              Siapkan <code>VITE_CONVEX_URL</code> dari project Convex sebelum
              menjalankan aplikasi.
            </p>
          </details>
        </main>
      )}
    </ThemeProvider>
  </React.StrictMode>,
);
