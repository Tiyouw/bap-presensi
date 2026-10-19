import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App.jsx";
import "./styles.css";

const url = import.meta.env.VITE_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {client ? (
      <ConvexProvider client={client}>
        <App />
      </ConvexProvider>
    ) : (
      <div className="wrap">
        <div className="card">
          <h2>VITE_CONVEX_URL belum diset</h2>
          <p className="muted">
            Jalankan <code>npx convex dev</code> sekali untuk membuat project, lalu isi{" "}
            <code>.env.local</code> dengan <code>VITE_CONVEX_URL=…</code> dari output CLI.
          </p>
        </div>
      </div>
    )}
  </React.StrictMode>
);
