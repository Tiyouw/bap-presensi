/** Deterministic failure injection complements the real-Convex browser suite. */
const { chromium } = require("playwright"),
  { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
let server, browser, page;
const results = [],
  draftKey = "bap.draft.qa-user:k1:p3",
  out = "out/management/faults";
fs.mkdirSync(out, { recursive: true });
const ok = (name) => {
  results.push(name);
  console.log("OK fault", name);
};
async function session() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.addInitScript(() => {
    localStorage.setItem("bap.token", "ui-test-token");
    localStorage.setItem("bap.guide.dismissed.v1", "1");
  });
  await page.route("https://example.test/bap.docx", (r) =>
    r.fulfill({ body: "document transport fixture" }),
  );
  await page.goto("http://127.0.0.1:5184/kelas/k1");
  await page.locator(".meeting-row").last().waitFor();
  return context;
}
async function open() {
  await page.locator(".meeting-row").filter({ hasText: "Pertemuan 3" }).click();
  await page.locator(".student-row").last().waitFor();
}
(async () => {
  server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--config", "scripts/ui/vite.config.mjs"],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  server.stderr.on("data", (b) => (output += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5184/")).ok) break;
    } catch {}
    if (server.exitCode !== null) throw Error(output);
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch();
  let ctx = await session();
  await open();
  await page.locator(".student-row").first().click();
  await page.evaluate(() => window.__qa.advance("p3"));
  await page
    .getByText("Data di server lebih baru.", { exact: false })
    .waitFor();
  assert.equal(
    await page.locator(".student-row .status-badge").first().innerText(),
    "Alpha",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Simpan & Kunci", exact: true })
      .isDisabled(),
    true,
  );
  assert.ok(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)).statuses.DEMO00001 === "ALPHA",
      draftKey,
    ),
  );
  ok("reactive conflict keeps local draft and blocks overwrite");
  await ctx.close();
  ctx = await session();
  await open();
  await page.evaluate(() => window.__qa.failGeneration(true));
  await page.locator(".student-row").first().click();
  await page
    .getByRole("button", { name: "Simpan & Kunci", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kunci sekarang", exact: false })
    .click();
  await page.getByText("BAP gagal dibuat.", { exact: false }).waitFor();
  assert.equal(
    await page.locator(".attendance-meta .session-badge").innerText(),
    "Terkunci",
  );
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
    null,
  );
  await page.evaluate(() => window.__qa.failGeneration(false));
  await page
    .getByRole("button", { name: "Buat BAP (.docx)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Unduh BAP (.docx)", exact: true })
    .waitFor();
  ok(
    "generator failure leaves successful lock intact; retry recovers document",
  );
  await ctx.close();
  ctx = await session();
  await open();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("bap.draft."))
        throw new DOMException("full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.locator(".student-row").first().click();
  await page
    .getByText("Draf belum tersimpan di perangkat.", { exact: false })
    .waitFor();
  await page
    .getByRole("link", { name: "BAP Praktikum — Beranda", exact: true })
    .click();
  await page.locator(".app-dialog").getByRole("button", { name: "Tetap di sini", exact: true }).click();
  assert.ok(page.url().endsWith("/pertemuan/p3"));
  ok("storage quota warning and global navigation cancellation preserve edits");
  await ctx.close();
  ctx = await session();
  await page.evaluate(() => window.__qa.advance("p3"));
  await page.waitForFunction(
    () => document.querySelector(".page-counter strong")?.textContent === "01",
  );
  await page.evaluate(() => window.__qa.setConnected(false));
  await open();
  await page
    .getByText("Rincian presensi terkunci belum tersedia", { exact: false })
    .waitFor();
  assert.equal(
    await page.locator(".student-row .status-badge").first().innerText(),
    "—",
  );
  assert.equal(
    await page.locator(".attendance-footer .button--primary").isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "← Pertemuan", exact: true }).click();
  await page.locator(".meeting-row").last().waitFor();
  ok(
    "uncached locked attendance offline shows unknown status and working Back",
  );
  await ctx.close();
  ctx = await session();
  await open();
  await page.locator(".student-row").first().click();
  await page.evaluate(() => window.__qa.expireSession());
  await page.getByLabel("Username", { exact: true }).waitFor();
  assert.ok(await page.evaluate((key) => localStorage.getItem(key), draftKey));
  ok("expired session returns to login without deleting scoped draft");
  await ctx.close();
  ctx = await session();
  await page.evaluate(() => window.__qa.holdQuery("sesi:detail"));
  await page.locator(".meeting-row").filter({ hasText: "Pertemuan 3" }).click();
  await page.getByLabel("Memuat presensi", { exact: true }).waitFor();
  assert.equal(
    await page
      .locator(".skeleton")
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").animationName),
    "none",
  );
  await page.evaluate(() => window.__qa.holdQuery("sesi:detail", false));
  await page.locator(".student-row").last().waitFor();
  ok("real pending detail shows skeleton, reduced motion disables shimmer");
  await ctx.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(`${results.length} fault-injection groups passed.`);
})()
  .catch(async (e) => {
    console.error(e);
    try {
      await page?.screenshot({ path: `${out}/failure.png`, fullPage: true });
      fs.writeFileSync(
        `${out}/failure.txt`,
        await page.locator("body").innerText(),
      );
    } catch {}
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
  });
