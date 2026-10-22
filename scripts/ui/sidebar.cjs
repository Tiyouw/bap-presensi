/** Sidebar pointer, keyboard, storage, role, drawer and overlay regression checks. */
const { chromium, webkit } = require("playwright");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const capture = process.argv.includes("--capture"), base = "b1c7ee1c86f0fe90134c42a95c169f3585ab0a9e";
const out = "out/sidebar", shots = "docs/sidebar", servers = [], results = [];
let browser;
fs.mkdirSync(out, { recursive: true });
async function serve(config, port) {
  const p = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", config, "--port", String(port), "--strictPort"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  servers.push(p); let log = ""; p.stderr.on("data", b => log += b); p.stdout.on("data", b => log += b);
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) return; } catch {} if (p.exitCode !== null) throw Error(log); await new Promise(r => setTimeout(r, 100)); }
  throw Error(log || "Server startup timed out");
}
function prepareBase() {
  const dir = path.resolve(out, "base"), tar = path.resolve(out, "base.tar"); fs.mkdirSync(dir, { recursive: true });
  execFileSync("git", ["archive", "--format=tar", "-o", tar, base, "src", "bap-shared", "convex/_generated", "scripts/ui", "index.html", "package.json"]);
  execFileSync("tar", ["-xf", tar, "-C", dir]);
  const slash = p => p.replaceAll("\\", "/"), config = path.join(dir, "vite.config.mjs");
  fs.writeFileSync(config, `import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';export default defineConfig({root:${JSON.stringify(slash(dir))},plugins:[react()],define:{'import.meta.env.VITE_CONVEX_URL':JSON.stringify('https://ui-fixture.convex.cloud')},resolve:{alias:[{find:/^convex\\/react$/,replacement:${JSON.stringify(slash(path.join(dir, "scripts/ui/convex-fixture.jsx")))}},{find:/^.*convex\\/_generated\\/api\\.js$/,replacement:${JSON.stringify(slash(path.join(dir, "scripts/ui/api-fixture.js")))}}]},server:{host:'127.0.0.1'}});`);
  return config;
}
async function until(fn, message) {
  for (let i = 0; i < 120; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 25)); }
  throw Error(message);
}
async function startContext(type, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", colorScheme: "dark", ...options });
  await context.addInitScript(({ identity, storageFail, apple }) => {
    localStorage.setItem("bap.token", "ui-test-token"); localStorage.setItem("bap.guide.dismissed.v1", "1");
    if (identity) localStorage.setItem("ui.sidebar.identity", JSON.stringify(identity));
    if (storageFail) { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k.startsWith("bap.sidebar.")) throw Error("Storage unavailable"); return set.call(this, k, v); }; }
    if (apple) Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  }, { identity: options.identity, storageFail: options.storageFail, apple: type === "webkit" });
  return context;
}
async function open(page, port = 5195, route = "/kelas/k1?tab=pertemuan") {
  await page.goto(`http://127.0.0.1:${port}${route}`); await page.locator(".meeting-row").last().waitFor();
}
async function leave(page) {
  await page.mouse.move(800, 100);
  await until(async () => await page.locator(".ws-sidebar").getAttribute("data-expanded") === "false" && (await page.locator(".ws-sidebar").boundingBox()).width === 72, "Sidebar did not settle to rail");
}
const metrics = page => page.evaluate(() => {
  const s = document.querySelector(".ws-sidebar").getBoundingClientRect(), m = document.querySelector(".mg-workspace").getBoundingClientRect();
  const i = document.querySelector(".ws-sidebar nav .ws-nav-symbol").getBoundingClientRect();
  return { side: s.width, x: m.x, width: m.width, iconX: i.x, iconY: i.y, scroll: scrollY, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
});
async function captureBeforeAfter(page) {
  fs.mkdirSync(shots, { recursive: true });
  for (const theme of ["dark", "light"]) for (const [name, width, height] of [["desktop",1280,900],["mobile",390,844]]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height });
    for (const [mode, port] of [["before",5196],["after",5195]]) {
      await open(page, port);
      assert.equal(await page.locator(".mg-shell--nav").count(), mode === "after" ? 1 : 0);
      await page.screenshot({ path: `${shots}/${mode}-${name}-${theme}.png` });
      if (width < 640) { await page.locator(".mg-mobile-menu").click(); await page.screenshot({ path: `${shots}/${mode}-drawer-${theme}.png` }); }
    }
  }
}
(async () => {
  if (capture) await serve(prepareBase(), 5196);
  await serve("scripts/ui/sidebar.vite.config.mjs", 5195);
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    browser = await type.launch(); let context = await startContext(engine), page = await context.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    if (capture && engine === "chromium") await captureBeforeAfter(page);
    await page.setViewportSize({ width: 1280, height: 900 }); await page.emulateMedia({ colorScheme: "dark" }); await open(page);
    const side = page.locator(".ws-sidebar"), pin = page.locator("[data-sidebar-pin]");
    assert.equal(await page.locator(".mg-mobile-menu").isVisible(), false); assert.equal((await metrics(page)).side, 240);
    assert.equal(await side.locator("nav a svg").count(), 5);
    await pin.click(); await leave(page); const rail = await metrics(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const node = await side.locator("nav a").first().evaluate(el => { el.dataset.stableNode = "yes"; return el.dataset.stableNode; }); assert.equal(node, "yes");
    for (let cycle = 0; cycle < 20; cycle++) {
      await side.hover({ position: { x: 35, y: 85 } });
      await until(async () => await side.getAttribute("data-expanded") === "true", "Hover did not reveal labels");
      await page.mouse.move(180, 150); await page.mouse.move(210, 220);
      const opened = await metrics(page); assert.equal(opened.x, rail.x); assert.equal(opened.width, rail.width); assert.equal(opened.iconX, rail.iconX); assert.equal(opened.iconY, rail.iconY); assert.equal(opened.scroll, rail.scroll);
      assert.equal(await side.locator("nav a").first().getAttribute("data-stable-node"), "yes");
      await leave(page);
    }
    results.push({ engine, check: "20 hover cycles, diagonal pointer movement, fixed content/icons, stable DOM", passed: true });
    for (let cycle = 0; cycle < 5; cycle++) {
      await side.hover({ position: { x: 35, y: 85 } });
      await until(async () => await side.getAttribute("data-expanded") === "true", "Open before close reversal");
      await page.mouse.move(800, 100); await page.waitForTimeout(210);
      await page.mouse.move(180, 145); await page.waitForTimeout(210);
      assert.equal(await side.getAttribute("data-expanded"), "true", "Returning during close must reverse it without a hit-area gap");
      assert.equal((await metrics(page)).x, rail.x); await leave(page);
    }
    // Rapid toggles settle to the last action, and key repeat never toggles twice.
    for (let i = 0; i < 10; i++) await pin.click({ position: { x: 24, y: 24 } });
    assert.equal(await pin.getAttribute("aria-pressed"), "false"); await leave(page);
    const repeatMod = engine === "webkit" ? "Meta" : "Control";
    await page.keyboard.down(repeatMod); await page.keyboard.down("b");
    const afterFirstKey = await pin.getAttribute("aria-pressed");
    await page.keyboard.down("b"); assert.equal(await pin.getAttribute("aria-pressed"), afterFirstKey);
    await page.keyboard.up("b"); await page.keyboard.up(repeatMod);
    await page.keyboard.press(`${repeatMod}+b`); await leave(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await side.locator(".ws-sidebar-panel").evaluate(el => getComputedStyle(el).transitionDuration), "0s");
    if (capture && engine === "chromium") {
      await page.screenshot({ path: `${shots}/after-rail-dark.png` });
      await side.hover({ position: { x: 35, y: 85 } }); await until(async () => await side.getAttribute("data-expanded") === "true", "Reveal capture");
      await page.screenshot({ path: `${shots}/after-hover-dark.png` }); await leave(page);
    }
    // Keyboard focus opens labels; Escape releases focus without changing the saved preference.
    await page.locator(".mg-search-trigger").focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
    await until(async () => await side.getAttribute("data-expanded") === "true", "Keyboard focus did not reveal labels");
    await page.keyboard.press("Escape"); await leave(page);
    const mod = engine === "webkit" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+b`); assert.equal(await pin.getAttribute("aria-pressed"), "true");
    await page.keyboard.press(`${mod}+b`); assert.equal(await pin.getAttribute("aria-pressed"), "false");
    await page.reload(); await page.locator(".meeting-row").last().waitFor(); assert.equal(await pin.getAttribute("aria-pressed"), "false");
    // A modal has priority over sidebar hover and shortcuts, including future Mode Panggil dialogs.
    await page.keyboard.press(`${mod}+k`); await page.getByRole("combobox").waitFor();
    await page.keyboard.press(`${mod}+b`); assert.equal(await pin.getAttribute("aria-pressed"), "false");
    await page.getByRole("combobox").fill("kelas"); await page.keyboard.press(`${mod}+b`); assert.equal(await pin.getAttribute("aria-pressed"), "false");
    await page.keyboard.press("Escape"); await side.hover({ position: { x: 35, y: 85 } });
    await until(async () => await side.getAttribute("data-expanded") === "true", "Reveal after dialog");
    await side.getByRole("button", { name: "Bantuan & panduan", exact: true }).click();
    await page.getByRole("dialog", { name: "Bantuan & panduan" }).waitFor(); assert.equal(await side.getAttribute("data-expanded"), "false");
    await page.keyboard.press("Escape"); await leave(page);
    results.push({ engine, check: "keyboard, Mac modifier, modal priority, input shortcut guard and persistence", passed: true });
    // All desktop/tablet widths retain the sidebar; only mobile widths use a drawer.
    for (const width of [320,390,640,641,768,1024,1280]) for (const theme of ["light","dark"]) {
      await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 900 });
      await until(async () => await page.locator(".mg-mobile-menu").isVisible() === (width <= 640), "Breakpoint did not settle");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${engine} ${width} ${theme}: page overflow`);
      if (width <= 640) {
        const trigger = page.locator(".mg-mobile-menu"); await trigger.click(); await until(() => side.isVisible(), "Drawer did not open");
        assert.equal(await side.getAttribute("aria-modal"), "true");
        const drawerBounds = await side.locator(".ws-sidebar-panel").boundingBox();
        assert.ok(Math.abs(drawerBounds.y - 64) <= 1 && Math.abs(drawerBounds.y + drawerBounds.height - 900) <= 1, "Drawer panel must fill the height below the header");
        assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-sidebar-close")), true);
        assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
        const close = side.locator("[data-sidebar-close]"); await close.press("Shift+Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest(".ws-sidebar-footer")), true);
        await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-sidebar-close")), true);
        await page.keyboard.press("Escape"); assert.equal(await side.isVisible(), false);
        assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
        assert.equal(await page.evaluate(() => document.body.style.overflow), "");
      }
      results.push({ engine, width, theme, passed: true });
    }
    // Successful navigation closes a mobile drawer; the account preference survives breakpoint changes.
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator(".mg-mobile-menu").click();
    await side.getByRole("link", { name: "Matkul & kelas", exact: true }).click(); await page.waitForURL("**/kelas");
    assert.equal(await side.isVisible(), false); await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await pin.getAttribute("aria-pressed"), "false");
    await page.getByLabel("Cari matkul atau kelas", { exact: true }).fill("demo"); const pinned = await pin.getAttribute("aria-pressed"); await page.keyboard.press(`${mod}+b`); assert.equal(await pin.getAttribute("aria-pressed"), pinned);
    await page.evaluate(() => localStorage.setItem("ui.sidebar.identity", JSON.stringify({ id:"same-browser-other-account", peran:"PENGELOLA" })));
    await page.reload(); await page.locator(".mg-shell--nav").waitFor();
    assert.equal(await pin.getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("bap.sidebar.v1.qa-user")).pinned), false);
    assert.deepEqual(errors, []); await context.close();
    for (const identity of [{ id:"other-account", peran:"PENGELOLA" }, { id:"third-account", peran:"OPERATOR" }]) {
      context = await startContext(engine, { identity }); page = await context.newPage(); await open(page);
      assert.equal(await page.locator('.ws-sidebar a[href="/akun"]').count(), 0);
      assert.equal(await page.locator("[data-sidebar-pin]").getAttribute("aria-pressed"), "true"); await context.close();
    }
    context = await startContext(engine, { storageFail:true }); page = await context.newPage(); await open(page);
    await page.locator("[data-sidebar-pin]").click(); await leave(page); await page.reload(); await page.locator(".meeting-row").last().waitFor(); assert.equal(await page.locator("[data-sidebar-pin]").getAttribute("aria-pressed"), "true"); await context.close();
    results.push({ engine, check:"role filtering, independent account preferences and unavailable storage", passed:true });
    await browser.close(); browser = null; console.log("PASS", engine, "sidebar pointer, keyboard, mobile, role and persistence checks");
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ passed:true, results }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); servers.forEach(s => s.kill()); });
