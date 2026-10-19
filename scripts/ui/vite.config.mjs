import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: process.cwd(),
  plugins: [react()],
  define: {
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
