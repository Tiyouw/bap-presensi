const { chromium, webkit } = require("playwright"),
  { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  axe = require("axe-core"),
  resize = require("./text-resize.cjs");
const base = "http://127.0.0.1:5241",
  out = "out/class-flow/ui",
  checks = [];
fs.mkdirSync(out, { recursive: true });
let server, browser;
const check = (engine, test) => {
  checks.push({ engine, test, passed: true });
  console.log("PASS", engine, test);
};
(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "scripts/ui/vite.config.mjs",
      "--port",
      "5241",
      "--strictPort",
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  server.stdout.on("data", (b) => (log += b));
  server.stderr.on("data", (b) => (log += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (server.exitCode !== null) throw Error(log);
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    browser = await type.launch();
    const c = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    await c.addInitScript(() => {
      localStorage.setItem("bap.token", "ui-test-token");
      localStorage.setItem("bap.guide.dismissed.v1", "1");
    });
    const p = await c.newPage(),
      errors = [],
      native = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("dialog", async (d) => {
      native.push(d.type());
      await d.dismiss();
    });
    await p.goto(base + "/kelas/k1?tab=mahasiswa");
    await p.getByRole("heading", { name: "Mahasiswa", exact: true }).waitFor();
    await p.evaluate(() => window.__qa.enableControls());
    // Internal navigation, unlike reload, exercises the real route guard/history.
    const go = (path) =>
      p.evaluate(async (path) => {
        const { navigate } = await import("/src/lib/navigation.js");
        return navigate(path);
      }, path);
    await go("/kelas/baru");
    await p.getByLabel("Mata kuliah", { exact: true }).selectOption("m1");
    await p.getByLabel("Nama kelas", { exact: true }).fill("Kelas Alur Demo");
    await p
      .getByLabel("Dosen pengampu", { exact: true })
      .fill("Dosen Alur Demo");
    await p.evaluate(() => {
      window.__qa.setRequestDelay(1800);
      window.__qa.holdQuery("kelola:catalog", true);
      const form = document.querySelector(".mg-class-form");
      form.requestSubmit();
      form.requestSubmit();
    });
    await p
      .getByRole("link", { name: "BAP Praktikum — Beranda", exact: true })
      .click();
    await p
      .getByRole("dialog", { name: "Proses belum selesai", exact: true })
      .waitFor();
    await p.waitForURL(/\/kelas\/[^/?]+\?tab=mahasiswa$/);
    await p.getByRole("heading", { name: "Mahasiswa", exact: true }).waitFor();
    assert.equal(await p.locator(".app-dialog").count(), 0);
    assert.equal(
      await p.getByText("Halaman tidak tersedia", { exact: true }).count(),
      0,
    );
    await p.getByText("Belum ada mahasiswa", { exact: true }).waitFor();
    await p
      .getByRole("status")
      .filter({ hasText: "Kelas draf berhasil dibuat." })
      .waitFor();
    assert.equal(
      await p.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "kelola:saveClass").length,
      ),
      1,
    );
    assert.equal(
      await p.getByRole('navigation',{name:'Bagian kelas',exact:true}).locator('a[aria-current="page"]').textContent(),
      "2 · Mahasiswa",
    );
    const newURL = p.url();
    await p.evaluate(() => {
      window.__qa.holdQuery("kelola:catalog", false);
      window.__qa.setRequestDelay(100);
    });
    check(
      engine,
      "single draft creation redirects automatically despite catalog lag and a busy navigation attempt",
    );
    await p
      .getByRole("button", { name: "Tambah mahasiswa", exact: true })
      .click();
    const parent = p.getByRole("dialog", {
      name: "Tambah mahasiswa",
      exact: true,
    });
    await parent
      .getByLabel("Nama mahasiswa", { exact: true })
      .fill("Mahasiswa Draf Demo");
    await parent.getByRole("button", { name: "Tutup", exact: true }).click();
    const decision = p.locator(".app-dialog");
    await decision.waitFor();
    await p.keyboard.press("Shift+Tab");
    assert.equal(
      await p.evaluate(() => document.activeElement.textContent),
      "Buang perubahan",
    );
    await p.keyboard.press("Tab");
    assert.equal(
      await p.evaluate(() => document.activeElement.textContent),
      "Batal",
    );
    await p.keyboard.press("Escape");
    await decision.waitFor({ state: "detached" });
    assert.equal(
      await parent.getByLabel("Nama mahasiswa", { exact: true }).inputValue(),
      "Mahasiswa Draf Demo",
    );
    assert.equal(
      await p.evaluate(() =>
        document.activeElement
          .closest('[role="dialog"]')
          ?.classList.contains("app-dialog"),
      ),
      false,
    );
    await parent.getByRole("button", { name: "Tutup", exact: true }).click();
    await decision
      .getByRole("button", { name: "Buang perubahan", exact: true })
      .click();
    await parent.waitFor({ state: "detached" });
    assert.equal(
      await p.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "kelola:saveParticipant")
            .length,
      ),
      0,
    );
    check(
      engine,
      "nested discard decision traps focus, Escape preserves student input and confirm closes only the editor",
    );
    await go("/kelas/k1?tab=pengaturan");
    await p
      .getByLabel("Dosen pengampu", { exact: true })
      .fill("Dosen Draf Lokal");
    await p
      .getByRole("link", { name: "BAP Praktikum — Beranda", exact: true })
      .click();
    await decision
      .getByRole("button", { name: "Tetap di sini", exact: true })
      .click();
    assert.equal(
      await p.getByLabel("Dosen pengampu", { exact: true }).inputValue(),
      "Dosen Draf Lokal",
    );
    assert(p.url().endsWith("tab=pengaturan"));
    await p.evaluate(() => history.back());
    await decision.waitFor();
    assert(p.url().endsWith("tab=pengaturan"));
    await p.evaluate(() => history.back());
    await p.waitForFunction(() => location.search === "?tab=pengaturan");
    assert.equal(await decision.count(), 1);
    await p.keyboard.press("Escape");
    await decision.waitFor({ state: "detached" });
    assert.equal(
      await p.getByLabel("Dosen pengampu", { exact: true }).inputValue(),
      "Dosen Draf Lokal",
    );
    await p.evaluate(() => history.back());
    await decision
      .getByRole("button", { name: "Tinggalkan halaman", exact: true })
      .click();
    await p.waitForURL(newURL);
    await p.getByRole("heading", { name: "Mahasiswa", exact: true }).waitFor();
    await p.evaluate(() => history.forward());
    await p.waitForURL(/tab=pengaturan$/);
    await p.getByLabel("Dosen pengampu", { exact: true }).waitFor();
    assert.equal(
      await p.getByLabel("Dosen pengampu", { exact: true }).inputValue(),
      "Dosen Demo",
    );
    check(
      engine,
      "cancelled navigation and browser Back preserve changes; confirmed Back and Forward synchronize route and URL",
    );
    await p
      .getByLabel("Dosen pengampu", { exact: true })
      .fill("Dosen Draf Lokal");
    await p
      .getByRole("link", { name: "BAP Praktikum — Beranda", exact: true })
      .click();
    await decision.waitFor();
    for (const scheme of ["light", "dark"]) {
      await p.emulateMedia({ colorScheme: scheme });
      for (const width of [320, 390, 1280]) {
        await p.setViewportSize({ width, height: 900 });
        const box = await decision.boundingBox();
        assert(Math.abs(box.y + box.height / 2 - 450) <= 2, engine + " dialog is vertically centered");
        assert(
          box.x >= 0 && box.x + box.width <= width,
          engine + " dialog bounds",
        );
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await p.screenshot({ path: `${out}/${engine}-${scheme}-${width}.png` });
      }
    }
    await p.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const a11y = await p.evaluate(() =>
      axe.run(document.querySelector(".app-dialog"), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    assert.deepEqual(
      a11y.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
    await resize(p);
    await p.setViewportSize({ width: 320, height: 900 });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.screenshot({ path: `${out}/${engine}-200pct.png` });
    await p.keyboard.press("Escape");
    check(
      engine,
      "compact dialog fits phone/desktop, light/dark and 200% text, with automated accessibility checks",
    );
    await p
      .getByRole("link", { name: "BAP Praktikum — Beranda", exact: true })
      .click();
    await decision
      .getByRole("button", { name: "Tinggalkan halaman", exact: true })
      .click();
    await p.waitForURL(base + "/");
    await go("/kelas/baru");
    await p.getByLabel("Mata kuliah", { exact: true }).selectOption("m1");
    await p.getByLabel("Nama kelas", { exact: true }).fill("Kelas Gagal Demo");
    await p
      .getByLabel("Dosen pengampu", { exact: true })
      .fill("Dosen Gagal Demo");
    await p.evaluate(() => window.__qa.setConnected(false));
    await p
      .getByRole("button", {
        name: "Simpan & lanjut ke Mahasiswa →",
        exact: true,
      })
      .click();
    await p.getByRole("alert").filter({ hasText: "offline" }).waitFor();
    assert(p.url().endsWith("/kelas/baru"));
    assert.equal(
      await p.getByLabel("Nama kelas", { exact: true }).inputValue(),
      "Kelas Gagal Demo",
    );
    assert.equal(
      await p
        .getByRole("button", {
          name: "Simpan & lanjut ke Mahasiswa →",
          exact: true,
        })
        .isEnabled(),
      true,
    );
    await p.evaluate(() => window.__qa.setConnected(true));
    check(
      engine,
      "failed save keeps the class form and allows retry without redirect",
    );
    assert.deepEqual(native, []);
    assert.deepEqual(errors, []);
    check(engine, "no native alert/confirm and no runtime errors");
    await c.close();
    await browser.close();
    browser = null;
  }
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ passed: true, checks }, null, 2),
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
  });
