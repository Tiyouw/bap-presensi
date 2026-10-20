/** Class tab geometry against synthetic fixtures; no production access. */
const { chromium, webkit } = require("playwright");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = process.cwd();
const capture = process.argv.includes("--capture");
const base = "d321bcdf3bd5f550d7fc2194a1e76f1d93e1f813";
const out = "out/class-layout";
const shots = "docs/class-layout";
const tabs = ["pertemuan", "mahasiswa", "jadwal", "template", "pengaturan", "riwayat"];
const servers = [];
const results = [];
let browser;
fs.mkdirSync(out, { recursive: true });
async function serve(config, port) {
  const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", config, "--port", String(port), "--strictPort"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  servers.push(child);
  let log = "";
  child.stderr.on("data", b => log += b);
  child.stdout.on("data", b => log += b);
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return; } catch {}
    if (child.exitCode !== null) throw Error(log);
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error("Vite startup timed out: " + log);
}
function prepareBase() {
  const dir = path.resolve(out, "base");
  fs.mkdirSync(dir, { recursive: true });
  const tar = path.resolve(out, "base.tar");
  execFileSync("git", ["archive", "--format=tar", "-o", tar, base, "src", "bap-shared", "convex/_generated", "scripts/ui", "index.html", "package.json"]);
  execFileSync("tar", ["-xf", tar, "-C", dir]);
  const slash = p => p.replaceAll("\\", "/");
  const config = path.join(dir, "vite.config.mjs");
  fs.writeFileSync(config, `import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';export default defineConfig({root:${JSON.stringify(slash(dir))},plugins:[react()],define:{'import.meta.env.VITE_CONVEX_URL':JSON.stringify('https://ui-fixture.convex.cloud')},resolve:{alias:[{find:/^convex\\/react$/,replacement:${JSON.stringify(slash(path.join(dir, "scripts/ui/convex-fixture.jsx")))}},{find:/^.*convex\\/_generated\\/api\\.js$/,replacement:${JSON.stringify(slash(path.join(dir, "scripts/ui/api-fixture.js")))}}]},server:{host:'127.0.0.1'}});`);
  return config;
}
async function openTab(page, port, tab) {
  await page.goto(`http://127.0.0.1:${port}/kelas/k1?tab=${tab}`);
  await page.locator(".mg-class-body h2").first().waitFor();
  await page.waitForFunction(() => !document.querySelector(".skeleton-region,.login-splash"));
  await page.evaluate(() => window.scrollTo(0, 0));
}
async function screenshotSet(page, port, mode) {
  fs.mkdirSync(shots, { recursive: true });
  for (const [device, width, height] of [["desktop", 1650, 1050], ["mobile", 390, 844], ["wide", 3300, 1408]]) {
    for (const tab of tabs) {
      if (device === "wide" && tab !== "pertemuan") continue;
      if (device === "mobile" && !["pertemuan", "mahasiswa", "jadwal"].includes(tab)) continue;
      await page.setViewportSize({ width, height });
      await openTab(page, port, tab);
      await page.screenshot({ path: `${shots}/${mode}-${tab}-${device}.png` });
    }
  }
}
(async () => {
  if (capture) await serve(prepareBase(), 5191);
  await serve("scripts/ui/vite.config.mjs", 5192);
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    browser = await type.launch();
    const context = await browser.newContext({ viewport: { width: 1650, height: 1050 }, colorScheme: "dark", reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem("bap.token", "ui-test-token");
      localStorage.setItem("bap.guide.dismissed.v1", "1");
    });
    if (capture && name === "chromium") {
      await screenshotSet(page, 5191, "before");
      await screenshotSet(page, 5192, "after");
    }
    const baseline = new Map();
    for (const tab of tabs) {
      await openTab(page, 5192, tab);
      for (const width of [320, 390, 768, 1024, 1650, 3300]) for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 1050 });
        await page.emulateMedia({ colorScheme: theme });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const m = await page.evaluate(() => {
          const body = document.querySelector(".mg-class-body");
          const heading = body.querySelector("h2");
          const nav = document.querySelector(".mg-class-tabs");
          const b = body.getBoundingClientRect(), h = heading.getBoundingClientRect(), n = nav.getBoundingClientRect();
          const css = getComputedStyle(body);
          const main = body.querySelector(".meetings-page")?.getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            x: h.x, navX: n.x, gap: h.top - n.bottom,
            font: getComputedStyle(heading).fontSize,
            contentWidth: b.width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight),
            meetingsWidth: main?.width,
            mainX: main?.x,
          };
        });
        assert.equal(m.overflow, false, `${name}/${tab}/${width}/${theme}: overflow`);
        assert.ok(Math.abs(m.x - m.navX) <= 1, `${tab}: heading must align with class tabs`);
        const key = `${width}/${theme}`;
        if (!baseline.has(key)) baseline.set(key, m);
        else {
          assert.ok(Math.abs(m.gap - baseline.get(key).gap) <= 1, `${tab}/${key}: inconsistent title gap ${m.gap} vs ${baseline.get(key).gap}`);
          assert.equal(m.font, baseline.get(key).font, `${tab}: inconsistent title size`);
        }
        if (tab === "pertemuan") {
          assert.ok(Math.abs(m.meetingsWidth - m.contentWidth) <= 1, "Meeting content should use the available workspace width");
          assert.ok(Math.abs(m.mainX - m.x) <= 1, "Meeting content should align with its title");
        }
        results.push({ browser: name, tab, width, theme, passed: true });
      }
    }
    // Switching tabs through real navigation must preserve the class header and alignment.
    await page.setViewportSize({ width: 1280, height: 900 });
    const title = await page.locator(".mg-class-head h1").innerText();
    for (const tab of tabs) {
      await page.locator(`.mg-class-tabs a[href$="tab=${tab}"]`).click();
      await page.locator(".mg-tab-heading h2").waitFor();
      assert.equal(await page.locator(".mg-class-head h1").innerText(), title);
      assert.equal(await page.locator(`.mg-class-tabs a[href$="tab=${tab}"]`).getAttribute("aria-current"), "page");
    }
    await page.locator('.mg-class-tabs a[href$="tab=pertemuan"]').click();
    await page.getByRole("button", { name: "Terkunci", exact: true }).click();
    await page.getByRole("heading", { name: "Belum ada pertemuan terkunci" }).waitFor();
    await page.getByRole("button", { name: "Semua", exact: true }).click();
    assert.equal(await page.locator(".meeting-row").count(), 16);
    assert.deepEqual(errors, []);
    await context.close();
    await browser.close();browser = null;
    console.log("PASS", name, "class tab alignment, fluid width, responsive themes, tab navigation and meeting filters");
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ passed: true, states: results.length, results }, null, 2));
  console.log(`${results.length} class tab viewport/theme checks passed.`);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  for (const server of servers) server.kill();
});
