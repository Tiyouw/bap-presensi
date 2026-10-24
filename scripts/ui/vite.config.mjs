import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { renderPdf } from "../../bap-shared/pdfRender.js";
import { documentInput } from "../../convex/bapNode.js";
import { validateTemplate } from "../../bap-shared/management.js";

// Test-only transport: render synthetic preview data with the production PDF renderer.
const previewFixture = () => ({
  name: "synthetic-preview",
  configureServer(server) {
    const cache = new Map();
    server.middlewares.use("/__qa/template-preview", (req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 2500000) req.destroy();
      });
      req.on("end", async () => {
        try {
          const { config, course, meeting } = JSON.parse(body),
            key = JSON.stringify({ config, course, meeting });
          let result = cache.get(key);
          if (!result) {
            const m = {
                nomor: meeting?.nomor || 1,
                tanggal: meeting?.tanggal || "2026-10-26",
                tempat: meeting?.tempat || course.tempat || "F6",
              },
              snapshot = {
                kelas: course,
                template: validateTemplate(config),
                peserta: [{ golongan: "A" }],
                tanggal: m.tanggal,
                tempat: m.tempat,
              };
            const pdf = await renderPdf(
              [
                documentInput({
                  snapshot,
                  pertemuan: m,
                  absen: [{ nama: "Mahasiswa Contoh", gol: "A", ket: "I" }],
                }),
              ],
              { twoPerPage: false },
            );
            result = {
              base64: Buffer.from(pdf.bytes).toString("base64"),
              pageCount: pdf.pageCount,
            };
            cache.set(key, result);
            if (cache.size > 12) cache.delete(cache.keys().next().value);
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(error.message) }));
        }
      });
    });
  },
});

export default defineConfig({
  root: process.cwd(),
  plugins: [react(), previewFixture()],
  define: {
    "process.env": JSON.stringify({
      CONVEX_SITE_URL: "https://ui-fixture.convex.site",
    }),
    "import.meta.env.VITE_CONVEX_URL": JSON.stringify(
      "https://ui-fixture.convex.cloud",
    ),
  },
  resolve: {
    alias: [
      {
        find: /^convex\/react$/,
        replacement: path.resolve("scripts/ui/convex-fixture.jsx"),
      },
      {
        find: /^.*convex\/_generated\/api\.js$/,
        replacement: path.resolve("scripts/ui/api-fixture.js"),
      },
    ],
  },
  server: { host: "127.0.0.1", port: 5184, strictPort: true },
});
