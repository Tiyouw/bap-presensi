import { defineConfig } from "vite";
import path from "node:path";
import base from "./vite.config.mjs";

export default defineConfig({
  ...base,
  resolve: { alias: base.resolve.alias.map(item => item.find.source === "^convex\\/react$" ? { ...item, replacement: path.resolve("scripts/ui/sidebar-fixture.jsx") } : item) },
  server: { host: "127.0.0.1", port: 5195, strictPort: true },
});
