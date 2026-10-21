import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { appShellPlugin } from "./scripts/app-shell-plugin.mjs";

export default defineConfig({
  plugins: [react(), appShellPlugin()],
  server: { host: true, port: 5173 },
  build: { outDir: "dist" },
});
