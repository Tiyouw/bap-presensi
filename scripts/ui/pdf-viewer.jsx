// Development-only visual regression harness; not a production build entry.
import React from "react";
import { createRoot } from "react-dom/client";
import PdfPreview from "../../src/components/PdfPreview.jsx";
import "../../src/tokens.css";
import "../../src/styles.css";
import "../../src/management.css";
createRoot(document.getElementById("root")).render(
  <main className="mg-page" style={{ maxWidth: 800, margin: "auto" }}>
    <h1>Uji halaman PDF</h1>
    <PdfPreview
      title="PDF uji dua halaman"
      url="/out/management/documents/single-13.pdf"
    />
  </main>,
);
