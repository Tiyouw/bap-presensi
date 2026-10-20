/** Record actual pointer interactions on the synthetic app, then export a GIF for PR review. */
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path");
let server, browser;
(async () => {
  fs.mkdirSync("out/sidebar/video", { recursive: true });
  fs.mkdirSync("docs/sidebar", { recursive: true });
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "scripts/ui/sidebar.vite.config.mjs", "--port", "5197", "--strictPort"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; server.stderr.on("data", b => log += b);
  for (let i = 0; i < 100; i++) { try { if ((await fetch("http://127.0.0.1:5197/")).ok) break; } catch {} if (server.exitCode !== null) throw Error(log); await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark", reducedMotion: "no-preference", recordVideo: { dir: "out/sidebar/video", size: { width: 1280, height: 800 } } });
  const page = await context.newPage();
  await page.addInitScript(() => { localStorage.setItem("bap.token", "ui-test-token"); localStorage.setItem("bap.guide.dismissed.v1", "1"); });
  await page.goto("http://127.0.0.1:5197/kelas/k1?tab=pertemuan"); await page.locator(".meeting-row").last().waitFor();
  await page.waitForTimeout(500); await page.locator("[data-sidebar-pin]").click(); await page.mouse.move(800, 100); await page.waitForTimeout(750);
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(35, 145); await page.waitForTimeout(500);
    await page.mouse.move(170, 195, { steps: 8 }); await page.waitForTimeout(300);
    await page.mouse.move(180, 295, { steps: 8 }); await page.waitForTimeout(300);
    await page.mouse.move(700, 250, { steps: 12 }); await page.waitForTimeout(700);
  }
  await page.mouse.move(35, 145); await page.waitForTimeout(600); await page.locator("[data-sidebar-pin]").click(); await page.waitForTimeout(600);
  const video = page.video(); await context.close();
  const file = await video.path();
  execFileSync("ffmpeg", ["-y", "-i", path.resolve(file), "-vf", "fps=10,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4", "-loop", "0", "docs/sidebar/hover-demo.gif"], { stdio: "pipe", windowsHide: true });
  console.log("Real hover interaction recording:", fs.statSync("docs/sidebar/hover-demo.gif").size, "bytes");
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(async () => { await browser?.close(); server?.kill(); });
