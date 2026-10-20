const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const root = process.cwd();
const shots = path.join(
  root,
  process.env.BAP_UPDATE_UI_PREVIEWS
    ? "docs/ui-preview"
    : "out/ui-qa/screenshots",
);
fs.mkdirSync(shots, { recursive: true });
fs.mkdirSync(path.join(root, "out/ui-qa"), { recursive: true });
let browser, currentPage, server;
const results = [];

async function startServer() {
  server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--config", "scripts/ui/vite.config.mjs"],
    { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  server.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  server.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("UI harness failed to start: " + output);
    try {
      const response = await fetch("http://127.0.0.1:5184", {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("UI harness startup timed out: " + output);
}

async function session(
  width = 390,
  theme = "light",
  loggedIn = true,
  firstTime = false,
) {
  const context = await browser.newContext({
    viewport: { width, height: width >= 1024 ? 900 : 844 },
    colorScheme: theme,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  currentPage = page;
  await page.addInitScript(
    ({ loggedIn, firstTime }) => {
      if (!localStorage.getItem("ui-qa.initialized")) {
        localStorage.setItem("ui-qa.initialized", "1");
        if (loggedIn) localStorage.setItem("bap.token", "ui-test-token");
        if (!firstTime) localStorage.setItem("bap.guide.dismissed.v1", "1");
      }
    },
    { loggedIn, firstTime },
  );
  await page.route("https://example.test/bap.docx", (route) =>
    route.fulfill({
      status: 200,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: Buffer.from("DOCX download transport fixture"),
    }),
  );
  await page.goto("http://127.0.0.1:5184/");
  await page
    .locator(loggedIn ? ".meeting-row" : ".login-form")
    .first()
    .waitFor();
  return { page, context };
}
async function openP3(page) {
  await page.locator(".meeting-row").filter({ hasText: "Pertemuan 3" }).click();
  await page.locator(".student-row").last().waitFor();
}
async function noOverflow(page) {
  const size = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(size.scroll <= size.width, `Overflow ${JSON.stringify(size)}`);
}
function done(name) {
  results.push(name);
  console.log("OK", name);
}

(async () => {
  await startServer();
  browser = await chromium.launch({ headless: true });
  // A genuine first visit is tested separately; regression sessions below have
  // already dismissed guidance, just like a returning operator.
  let first = await session(390, "light", true, true);
  await first.page
    .getByRole("heading", { name: "Panduan singkat", exact: true })
    .waitFor();
  await first.page.screenshot({ path: path.join(shots, "guide-mobile.png") });
  await first.page.getByRole("button", { name: "Lewati", exact: true }).click();
  await first.page.reload();
  await first.page.locator(".meeting-row").last().waitFor();
  assert.equal(await first.page.getByRole("dialog").count(), 0);
  await first.page.screenshot({
    path: path.join(shots, "meetings-mobile.png"),
    fullPage: true,
  });
  await first.page
    .getByRole("button", { name: "Bantuan", exact: true })
    .click();
  await first.page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await first.page
    .getByRole("heading", { name: "Cukup tandai yang tidak hadir" })
    .waitFor();
  await first.page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await first.page
    .getByRole("button", { name: "Selesai", exact: true })
    .click();
  await openP3(first.page);
  await first.page
    .getByRole("button", { name: "Bantuan", exact: true })
    .click();
  await first.page.keyboard.press("Escape");
  assert.equal(await first.page.getByRole("dialog").count(), 0);
  assert.equal(await first.page.evaluate(() => window.__qa.calls.length), 0);
  await first.context.close();
  done(
    "first-use guide can be skipped, stays dismissed after reload, reopens from help without data mutations",
  );
  let { page, context } = await session(1280, "light", false);
  await page.screenshot({
    path: path.join(shots, "login-desktop.png"),
    fullPage: true,
  });
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Masuk ke aplikasi" }).click();
  await page.getByText("Password belum cocok.", { exact: false }).waitFor();
  await page.getByLabel("Password", { exact: true }).fill("demo");
  await page.getByRole("button", { name: "Lihat", exact: true }).click();
  assert.equal(
    await page.getByLabel("Password", { exact: true }).getAttribute("type"),
    "text",
  );
  await page.getByRole("button", { name: "Masuk ke aplikasi" }).click();
  await page.locator(".meeting-row").last().waitFor();
  assert.equal(await page.locator(".meeting-row").count(), 16);
  assert.equal(await page.locator(".meeting-row:disabled").count(), 2);
  await page.screenshot({
    path: path.join(shots, "pertemuan-desktop.png"),
    fullPage: true,
  });
  done("login error, password visibility, 16 meetings and disabled UTS/UAS");
  await context.close();

  for (const width of [320, 360, 390, 414, 768, 1280])
    for (const theme of ["light", "dark"]) {
      ({ page, context } = await session(width, theme));
      await noOverflow(page);
      await openP3(page);
      await noOverflow(page);
      const small = await page
        .locator("button:visible:not(:disabled),input:visible,select:visible")
        .evaluateAll((elements) =>
          elements
            .map((el) => ({
              name: el.getAttribute("aria-label") || el.textContent,
              rect: el.getBoundingClientRect(),
            }))
            .filter(({ rect }) => rect.width < 47.5 || rect.height < 47.5)
            .map(({ name, rect }) => ({
              name,
              width: rect.width,
              height: rect.height,
            })),
        );
      assert.deepEqual(small, [], `Touch targets ${width}/${theme}`);
      if (width === 390) {
        const visible = await page
          .locator(".student-row")
          .evaluateAll((rows) => {
            const viewport = document
              .querySelector(".attendance-page")
              .getBoundingClientRect();
            return rows.filter((el) => {
              const r = el.getBoundingClientRect();
              return r.top >= viewport.top && r.bottom <= viewport.bottom;
            }).length;
          });
        assert.ok(visible >= 4, `Expected four visible rows: ${visible}`);
        await page.screenshot({
          path: path.join(shots, `presensi-mobile-${theme}.png`),
        });
      }
      if (width === 1280 && theme === "light")
        await page.screenshot({
          path: path.join(shots, "presensi-desktop.png"),
        });
      await context.close();
    }
  done(
    "responsive 320/360/390/414/768/1280, both themes, 48px targets, four visible rows",
  );

  ({ page, context } = await session());
  await openP3(page);
  await page.locator(".student-main").first().click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("bap.draft.p3")).statuses.DEMO00001 ===
      "ALPHA",
  );
  assert.equal(
    await page.locator(".attendance-stat.ALPHA strong").textContent(),
    "1",
  );
  await page
    .locator(".header-actions")
    .getByRole("button", { name: "Urungkan" })
    .click();
  assert.equal(
    await page.locator(".attendance-stat.ALPHA strong").textContent(),
    "0",
  );
  await page.getByRole("searchbox").fill("demo00002");
  assert.equal(await page.locator(".student-row").count(), 1);
  await page.getByRole("searchbox").fill("");
  await page
    .locator(".group-filters")
    .getByRole("button", { name: "D", exact: true })
    .click();
  assert.equal(await page.locator(".student-row").count(), 23);
  assert.equal(
    await page.locator(".attendance-stat.HADIR strong").textContent(),
    "93",
  );
  await page
    .locator(".group-filters")
    .getByRole("button", { name: "Semua", exact: true })
    .click();
  await page.locator(".student-main").first().click();
  await page
    .getByRole("button", {
      name: "Ubah status Bima Demo",
      exact: true,
    })
    .click();
  await page
    .locator(".person-modes")
    .getByRole("button", { name: "Sakit", exact: true })
    .click();
  await page.getByRole("button", { name: "Berikutnya", exact: false }).click();
  await page
    .locator(".modal-header h2")
    .filter({ hasText: "Citra Demo" })
    .waitFor();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Tutup",
  );
  await page.keyboard.press("Shift+Tab");
  assert.match(
    await page.evaluate(() => document.activeElement.textContent),
    /Berikutnya/,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator('[role="dialog"]').count(), 0);
  await page
    .locator(".attendance-footer")
    .getByRole("button", { name: "Simpan & Kunci", exact: false })
    .click();
  assert.equal(await page.locator(".review-list li").count(), 2);
  await page.getByRole("button", { name: "Kembali periksa" }).click();
  done(
    "brush, undo, NIM search, global counters under filter, person sheet and review",
  );

  await page.evaluate(() => window.__qa.failGeneration(true));
  await page
    .locator(".attendance-footer")
    .getByRole("button", { name: "Simpan & Kunci", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Kunci sekarang", exact: false })
    .click();
  await page
    .getByText("BAP gagal dibuat. Presensi tetap tersimpan;", { exact: false })
    .waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("bap.draft.p3")),
    null,
  );
  assert.equal(await page.locator(".locked-summary").count(), 1);
  assert.equal(
    await page.evaluate(
      () =>
        window.__qa.calls.filter((c) => c.name === "sesi:simpanDanKunci")
          .length,
    ),
    1,
  );
  await page.evaluate(() => window.__qa.failGeneration(false));
  await page
    .locator(".attendance-footer")
    .getByRole("button", { name: "Buat BAP", exact: false })
    .click();
  await page
    .locator(".attendance-footer")
    .getByRole("button", { name: "Unduh BAP", exact: false })
    .waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator(".attendance-footer")
    .getByRole("button", { name: "Unduh BAP", exact: false })
    .click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "BAP_PPB_P03_2026-09-14_r1.docx");
  assert.equal(context.pages().length, 1);
  await page.getByRole("button", { name: "Buka kunci", exact: true }).click();
  await page.getByRole("button", { name: "Buka kunci & koreksi" }).click();
  await page
    .locator(".attendance-footer")
    .getByRole("button", { name: "Simpan & Kunci", exact: false })
    .waitFor();
  done(
    "atomic save remains locked on generate failure, retry, Blob download without popup, unlock",
  );

  await page
    .locator(".brush-modes")
    .getByRole("button", { name: "I Izin", exact: true })
    .click();
  await page.locator(".student-main").nth(2).click();
  await page.evaluate(() => window.__qa.setConnected(false));
  assert.equal(
    await page.locator(".attendance-footer button").isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "← Pertemuan" }).click();
  await openP3(page);
  assert.equal(
    await page
      .locator(".student-row")
      .nth(2)
      .locator(".status-badge")
      .textContent(),
    "Izin",
  );
  await page.reload();
  await page.locator(".meeting-row").last().waitFor();
  await openP3(page);
  assert.equal(
    await page
      .locator(".student-row")
      .nth(2)
      .locator(".status-badge")
      .textContent(),
    "Izin",
  );
  await page.evaluate(() => window.__qa.setConnected(true));
  await page.locator(".connection--online").waitFor();
  await page.evaluate(() => window.__qa.advance("p3"));
  await page
    .getByText("Data di server lebih baru.", { exact: false })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("bap.draft.p3")).baseRevision,
    ),
    1,
  );
  assert.equal(
    await page
      .locator(".student-row")
      .nth(2)
      .locator(".status-badge")
      .textContent(),
    "Izin",
  );
  await page
    .getByRole("button", { name: "Periksa perubahan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Muat data server", exact: true })
    .click();
  assert.equal(
    await page
      .locator(".student-row")
      .nth(2)
      .locator(".status-badge")
      .textContent(),
    "Sakit",
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("bap.draft.backup.p3")).statuses
          .DEMO00003,
    ),
    "IZIN",
  );
  done(
    "offline editing, cached navigation/reload, reconnect and conflict preserve/backup local draft",
  );
  await context.close();

  ({ page, context } = await session(320));
  await openP3(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("bap.draft."))
        throw new DOMException("QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.locator(".student-main").first().click();
  await page
    .getByText("Draf belum tersimpan di perangkat.", { exact: false })
    .waitFor();
  await page.getByRole("button", { name: "← Pertemuan" }).click();
  await page
    .getByRole("heading", { name: "Draf belum tersimpan", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Tetap di presensi" }).click();
  assert.equal(await page.locator(".student-row").count(), 93);
  await page.addStyleTag({ content: "html{font-size:200%}" });
  await noOverflow(page);
  await page.screenshot({ path: path.join(root, "out/ui-qa/zoom-200.png") });
  done("storage-full warning and 200% text without horizontal page overflow");
  await context.close();

  ({ page, context } = await session());
  await openP3(page);
  await page.locator(".student-main").first().click();
  await page.evaluate(() => window.__qa.expireSession());
  await page
    .getByRole("heading", { name: "Masuk kembali", exact: true })
    .waitFor();
  assert.notEqual(
    await page.evaluate(() => localStorage.getItem("bap.draft.p3")),
    null,
  );
  await page.getByRole("button", { name: "Ke halaman masuk" }).click();
  await page.locator(".login-form").waitFor();
  done("expired-session recovery preserves draft");
  await context.close();

  ({ page, context } = await session());
  await page.evaluate(() => window.__qa.advance("p2"));
  await page
    .getByRole("button", { name: "Siapkan cetak", exact: false })
    .click();
  assert.equal(await page.getByRole("checkbox").count(), 2);
  assert.equal(
    await page
      .getByRole("button", { name: "Unduh paket cetak (.docx)", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Pilih semua", exact: true }).click();
  assert.equal(await page.locator(".print-sheets li").count(), 1);
  await page.screenshot({ path: path.join(shots, "print-mobile.png") });
  await page.evaluate(() => window.__qa.failGeneration(true));
  await page
    .getByRole("button", { name: "Unduh paket cetak (.docx)", exact: true })
    .click();
  await page
    .getByText("Paket cetak belum berhasil dibuat.", { exact: false })
    .waitFor();
  assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 2);
  await page.evaluate(() => window.__qa.failGeneration(false));
  const printDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Unduh paket cetak (.docx)", exact: true })
    .click();
  assert.equal(
    (await printDownload).suggestedFilename(),
    "BAP_PPB_P01-02_2-form-folio.docx",
  );
  assert.equal(context.pages().length, 1);
  await page.getByText("Paket diunduh dari revisi", { exact: false }).waitFor();
  await page.evaluate(() => window.__qa.setConnected(false));
  assert.equal(
    await page
      .getByRole("button", { name: "Unduh paket cetak (.docx)", exact: true })
      .isDisabled(),
    true,
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.__qa.setConnected(true));
  await page
    .getByRole("button", { name: "Siapkan cetak", exact: false })
    .click();
  await page.getByRole("button", { name: "Pilih semua", exact: true }).click();
  await page.screenshot({ path: path.join(shots, "print-desktop.png") });
  done(
    "print package selects only locked meetings, plans two forms, retries failures, downloads without popup, blocks offline",
  );
  await context.close();

  fs.writeFileSync(
    path.join(root, "out/ui-qa/results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log("ALL UI CHECKS PASSED");
})()
  .catch(async (error) => {
    console.error(error);
    if (currentPage && !currentPage.isClosed())
      await currentPage
        .screenshot({ path: path.join(root, "out/ui-qa/failure.png") })
        .catch(() => {});
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
  });
