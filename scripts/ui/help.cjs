const openMeeting=require("./meeting-card-ui.cjs");
const { chromium, webkit } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  axe = require("axe-core"),
  resizeText = require("./text-resize.cjs");
const base = "http://127.0.0.1:5238",
  out = "out/help/ui",
  checks = [];
fs.mkdirSync(out, { recursive: true });
let server,
  browser,
  page,
  engine = "";
const record = () =>
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ passed: false, checks }, null, 2),
  );
const check = async (name, fn) => {
  await fn();
  checks.push({ engine, name, passed: true });
  record();
  console.log("PASS", engine, name);
};
const academic = async () =>
  page.evaluate(() => ({
    server: localStorage.getItem("ui-qa.server"),
    ledger: localStorage.getItem("ui-qa.control-engine"),
    drafts: Object.fromEntries(
      Object.keys(localStorage)
        .filter(
          (k) =>
            k.startsWith("bap.correction.") &&
            !k.startsWith("bap.correction.cache."),
        )
        .map((k) => [k, localStorage.getItem(k)]),
    ),
    calls: window.__qa.calls.length,
  }));
const startTour = async () => {
  await page.getByRole("button", { name: /^Bantuan halaman ini/ }).click();
  await page
    .getByRole("button", {
      name: "Tunjukkan caranya di halaman ini",
      exact: true,
    })
    .click();
  await page.locator(".bap-help-tour").waitFor();
};
const closeTour = async () => {
  await page.keyboard.press("Escape");
  await page.locator(".bap-help-tour").waitFor({ state: "hidden" });
};
const withinViewport = async (selector) => {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const r = await page.locator(selector).evaluate((e) => {
    const r = e.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: innerWidth,
      height: innerHeight,
      scroll: e.scrollWidth,
      client: e.clientWidth,
    };
  });
  assert(
    r.left >= -1 &&
      r.right <= r.width + 1 &&
      r.top >= -1 &&
      r.bottom <= r.height + 1,
    JSON.stringify(r),
  );
  assert(r.scroll <= r.client + 1, JSON.stringify(r));
};
(async () => {
  record();
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "scripts/ui/vite.config.mjs",
      "--port",
      "5238",
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
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    engine = name;
    browser = await type.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      localStorage.setItem("bap.token", "ui-test-token");
      localStorage.setItem("bap.guide.dismissed.v1", "1");
      localStorage.setItem("bap.help.welcome.v1.qa-user", "1");
    });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/kelas/k1?tab=jadwal");
    await page
      .getByRole("heading", { name: "Jadwal pertemuan", exact: true })
      .waitFor();
    await page.evaluate(() => window.__qa.enableControls());
    await check("one compact header help icon and clear session action fit desktop and phone", async () => {
      await page.goto(base + "/kelas/k1/pertemuan/p4");
      await page.locator(".student-row").last().waitFor();
      const help = page.getByRole("button", { name: /^Bantuan halaman ini/ });
      const edit = page.getByRole("button", { name: "Tanggal & data sesi", exact: true });
      assert.equal(await help.count(), 1);
      assert.equal(await help.textContent(), "?");
      assert.equal(await page.locator(".help-page-tools").count(), 0);
      assert.equal(await page.getByRole("button", { name: "Koreksi sesi ini", exact: true }).count(), 0);
      assert(await help.evaluate(e => Boolean(e.closest(".mg-topbar"))));
      assert(await edit.evaluate(e => Boolean(e.closest(".mg-local-toolbar"))));
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await withinViewport(".help-page-button");
        const box = await help.boundingBox();
        assert(box.width >= 44 && box.height >= 44);
        assert(await page.locator(".mg-topbar").evaluate(e => e.scrollWidth <= e.clientWidth));
        assert(await page.locator(".mg-local-toolbar").evaluate(e => e.scrollWidth <= e.clientWidth));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await resizeText(page);
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await withinViewport(".help-page-button");
        assert(await page.locator(".mg-topbar").evaluate(e => e.scrollWidth <= e.clientWidth), "200% header overflow");
        assert(await page.locator(".mg-local-toolbar").evaluate(e => e.scrollWidth <= e.clientWidth), "200% attendance toolbar overflow");
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "200% page overflow");
      }
      await page.reload();
      await page.locator(".student-row").last().waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await edit.click();
      await page.locator('[aria-label="Tanggal pelaksanaan"]:enabled').waitFor();
      assert(page.url().includes("correct=p4"));
      await page.goto(base + "/kelas/k1?tab=jadwal");
    });
    await openMeeting(page,3);
    await page
      .getByRole("link", { name: "Edit rincian 3", exact: true })
      .click();
    await page.locator('[aria-label="Tanggal pelaksanaan"]:enabled').waitFor();
    const date = page.getByLabel("Tanggal pelaksanaan", { exact: true }),
      reason = page.getByLabel("Catatan perubahan", { exact: true });
    await date.fill("2026-10-23");
    await reason.fill("Draf sintetis untuk menguji bantuan");
    await check(
      "hover/focus tooltip, pointer into text, Escape and detail keep academic state intact",
      async () => {
        const before = await academic(),
          trigger = page.getByRole("button", {
            name: "Penjelasan Tanggal pelaksanaan",
            exact: true,
          });
        await trigger.hover();
        await page.getByRole("tooltip").waitFor();
        await page.getByRole("tooltip").hover();
        await page.waitForTimeout(200);
        assert(await page.getByRole("tooltip").isVisible());
        await page.keyboard.press("Escape");
        await page.getByRole("tooltip").waitFor({ state: "hidden" });
        await trigger.click();
        await page
          .getByRole("dialog", { name: "Tanggal pelaksanaan", exact: true })
          .waitFor();
        await withinViewport(".help-panel");
        await page.keyboard.press("Tab");
        assert(
          await page
            .locator(".help-panel")
            .evaluate((e) => e.contains(document.activeElement)),
        );
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () =>
            document.activeElement ===
            document.querySelector(
              '[aria-label="Penjelasan Tanggal pelaksanaan"]',
            ),
        );
        assert.deepEqual(await academic(), before);
        assert.equal(await date.inputValue(), "2026-10-23");
      },
    );
    await check(
      "Enter/Space and touch/outside dismissal operate only the help control",
      async () => {
        const trigger = page.getByRole("button", {
            name: "Penjelasan Tanggal pelaksanaan",
            exact: true,
          }),
          before = await academic();
        await trigger.focus();
        await page.keyboard.press("Enter");
        await page
          .getByRole("dialog", { name: "Tanggal pelaksanaan", exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Tutup penjelasan", exact: true })
          .focus();
        await page.keyboard.press("Space");
        await page.locator(".help-panel").waitFor({ state: "hidden" });
        await trigger.tap();
        await page.locator(".help-panel").waitFor();
        const box = await page.locator(".help-panel").boundingBox();
        await page.touchscreen.tap(2, Math.min(830, Math.max(2, box.y + 10)));
        await page.locator(".help-panel").waitFor({ state: "hidden" });
        assert.deepEqual(await academic(), before);
      },
    );
    await check(
      "mobile sidebar help remains visible outside the closed drawer and restores scrolling/focus",
      async () => {
        const before = await academic(),
          overflow = await page.evaluate(() => document.body.style.overflow);
        await page
          .getByRole("button", { name: "Buka menu utama", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Bantuan & panduan", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Bantuan & panduan", exact: true })
          .waitFor();
        assert.equal(
          await page
            .locator(".help-panel")
            .evaluate((e) => Boolean(e.closest("[inert]"))),
          false,
        );
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          (expected) => document.body.style.overflow === expected,
          overflow,
        );
        await page.waitForFunction(
          () =>
            document.activeElement ===
            document.querySelector('[aria-label="Buka menu utama"]'),
          null,
          { timeout: 3000 },
        );
        assert.deepEqual(await academic(), before);
      },
    );
    await check(
      "linked guide and multiword search use matching content without server requests",
      async () => {
        const before = await academic();
        await page
          .getByRole("button", {
            name: "Penjelasan Tanggal pelaksanaan",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Baca panduan terkait", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Bantuan & panduan", exact: true })
          .waitFor();
        await page
          .getByRole("heading", { name: "Tanggal pelaksanaan", exact: true })
          .waitFor();
        await page
          .getByLabel("Cari penjelasan fitur", { exact: true })
          .fill("pulihkan revisi");
        await page
          .locator(".help-panel")
          .getByRole("button", { name: /Pulihkan revisi sebelumnya/ })
          .click();
        await page
          .getByText(
            "Menyalin nilai versi pilihan menjadi revisi baru; versi sesudahnya tetap tersimpan.",
            { exact: true },
          )
          .waitFor();
        await page.keyboard.press("Escape");
        assert.deepEqual(await academic(), before);
      },
    );
    await check(
      "correction tour is read-only, traps keyboard and completes with separately recorded progress",
      async () => {
        const before = await academic();
        await startTour();
        await withinViewport(".bap-help-tour");
        await page.keyboard.press("1");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Tab");
        assert(
          await page
            .locator(".bap-help-tour")
            .evaluate((e) => e.contains(document.activeElement)),
        );
        for (
          let n = 0;
          n < 8 && (await page.locator(".bap-help-tour").count());
          n++
        )
          await page.locator(".driver-popover-next-btn").click();
        await page.locator(".bap-help-tour").waitFor({ state: "hidden" });
        const progress = await page.evaluate(() =>
          JSON.parse(
            localStorage.getItem(
              Object.keys(localStorage).find(
                (k) =>
                  k.startsWith("bap.help.tour.") && k.endsWith(".correction"),
              ),
            ),
          ),
        );
        assert.equal(progress.status, "completed");
        assert.deepEqual(await academic(), before);
        assert.equal(await date.inputValue(), "2026-10-23");
        assert.equal(
          await reason.inputValue(),
          "Draf sintetis untuk menguji bantuan",
        );
        await startTour();
        await closeTour();
        assert.equal(
          await page.evaluate(
            () =>
              JSON.parse(
                localStorage.getItem(
                  Object.keys(localStorage).find(
                    (k) =>
                      k.startsWith("bap.help.tour.") &&
                      k.endsWith(".correction"),
                  ),
                ),
              ).status,
          ),
          "skipped",
        );
      },
    );
    await check(
      "missing required elements cannot claim completion; pending waits cancel when help is opened",
      async () => {
        const before = await academic();
        await page.evaluate(() =>
          document
            .querySelector('[data-tour="correction-date"]')
            .setAttribute("data-tour", "not-ready"),
        );
        await page
          .getByRole("button", { name: /^Bantuan halaman ini/ })
          .click();
        await page
          .getByRole("button", {
            name: "Tunjukkan caranya di halaman ini",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: /^Bantuan halaman ini/ })
          .click();
        await page
          .getByRole("dialog", { name: "Bantuan & panduan", exact: true })
          .waitFor();
        await page.waitForTimeout(2700);
        assert.equal(await page.locator(".bap-help-tour").count(), 0);
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", { name: /^Bantuan halaman ini/ })
          .click();
        await page
          .getByRole("button", {
            name: "Tunjukkan caranya di halaman ini",
            exact: true,
          })
          .click();
        await page
          .getByText("Elemen tur belum tersedia pada tampilan ini.", {
            exact: false,
          })
          .waitFor();
        assert.equal(await page.locator(".bap-help-tour").count(), 0);
        assert.deepEqual(await academic(), before);
        await page.evaluate(() =>
          document
            .querySelector('[data-tour="not-ready"]')
            .setAttribute("data-tour", "correction-date"),
        );
      },
    );
    await check(
      "tour storage quota leaves content usable and reports unsaved progress",
      async () => {
        const before = await academic();
        await page.evaluate(() => {
          window.__helpWrite = Storage.prototype.setItem;
          Storage.prototype.setItem = function (k, v) {
            if (k.startsWith("bap.help.tour."))
              throw new DOMException("Synthetic quota", "QuotaExceededError");
            return window.__helpWrite.call(this, k, v);
          };
        });
        await page.setViewportSize({ width: 320, height: 600 });
        await startTour();
        await page
          .getByText("Status panduan belum tersimpan di perangkat.", {
            exact: false,
          })
          .waitFor();
        for (
          let i = 0;
          i < 8 && (await page.locator(".bap-help-tour").count());
          i++
        )
          await page.locator(".driver-popover-next-btn").click();
        await page.locator(".bap-help-tour").waitFor({ state: "hidden" });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(
          () => (Storage.prototype.setItem = window.__helpWrite),
        );
        assert.deepEqual(await academic(), before);
      },
    );
    await check(
      "tour reload/replay preserves draft; disappearing targets and role changes clean every overlay",
      async () => {
        await page.reload();
        await page
          .locator('[aria-label="Tanggal pelaksanaan"]:enabled')
          .waitFor();
        assert.equal(await date.inputValue(), "2026-10-23");
        await startTour();
        await page.evaluate(() =>
          document.querySelector('[data-tour="correction-date"]').remove(),
        );
        await page.locator(".bap-help-tour").waitFor({ state: "hidden" });
        await page
          .getByText("Tampilan berubah sehingga langkah tur dihentikan.", {
            exact: false,
          })
          .waitFor();
        await page.reload();
        await page
          .locator('[aria-label="Tanggal pelaksanaan"]:enabled')
          .waitFor();
        await startTour();
        await page.evaluate(() => window.__qa.controlRole("OPERATOR", []));
        await page.locator(".bap-help-tour").waitFor({ state: "hidden" });
        assert.equal(await page.locator(".driver-overlay").count(), 0);
        await page.evaluate(() => window.__qa.controlRole("ADMIN"));
      },
    );
    // A fresh page exits the deliberately removed synthetic DOM and keeps a clean dataset.
    await page.goto(base + "/kelas/k1?tab=mahasiswa");
    await page
      .getByRole("heading", { name: "Mahasiswa", exact: true })
      .waitFor();
    await check(
      "detail inside import dialog keeps parent modal, selected file preview and focus intact",
      async () => {
        await page
          .getByRole("button", { name: "Impor Excel / CSV", exact: true })
          .click();
        const parent = page.getByRole("dialog", {
          name: "Impor mahasiswa",
          exact: true,
        });
        await parent
          .getByLabel("File mahasiswa (maksimum 5 MB)", { exact: true })
          .setInputFiles({
            name: "synthetic.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(
              "NIM,Nama,Golongan\n009999,Synthetic Help Demo,A\n",
            ),
          });
        await parent
          .getByText("Synthetic Help Demo", { exact: true })
          .waitFor();
        const before = await academic(),
          help = parent.getByRole("button", {
            name: "Penjelasan Impor dan pembaruan terpilih",
            exact: true,
          });
        await help.click();
        await page
          .getByRole("dialog", {
            name: "Impor dan pembaruan terpilih",
            exact: true,
          })
          .waitFor();
        await page.keyboard.press("Shift+Tab");
        assert(
          await page
            .locator(".help-panel")
            .evaluate((e) => e.contains(document.activeElement)),
        );
        await page.keyboard.press("Escape");
        assert(await parent.isVisible());
        await page.waitForFunction(
          () =>
            document.activeElement ===
            document.querySelector(
              '[aria-label="Penjelasan Impor dan pembaruan terpilih"]',
            ),
        );
        await parent
          .getByText("Synthetic Help Demo", { exact: true })
          .waitFor();
        assert.deepEqual(await academic(), before);
        await page.keyboard.press("Escape");
        await parent.waitFor({ state: "hidden" });
      },
    );
    await check(
      "class tour only points to existing permitted tabs and never navigates",
      async () => {
        const before = await academic(),
          url = page.url();
        await startTour();
        await page.locator(".driver-popover-next-btn").click();
        await closeTour();
        assert.equal(page.url(), url);
        assert.deepEqual(await academic(), before);
      },
    );
    await page.goto(base + "/kelas/k1/pertemuan/p4");
    await page.locator(".student-row").last().waitFor();
    await check(
      "attendance tour preserves statuses, filters and server state",
      async () => {
        await page
          .getByRole("searchbox", { name: "Cari nama atau NIM", exact: true })
          .fill("Demo");
        const before = await academic(),
          status = await page.locator(".attendance-stats").allTextContents();
        await startTour();
        await page.keyboard.press("ArrowRight");
        await closeTour();
        assert.equal(
          await page
            .getByRole("searchbox", { name: "Cari nama atau NIM", exact: true })
            .inputValue(),
          "Demo",
        );
        assert.deepEqual(await academic(), before);
        assert.deepEqual(
          await page.locator(".attendance-stats").allTextContents(),
          status,
        );
      },
    );
    await check(
      "nested Mode Panggil help blocks status shortcuts and Escape closes only top help",
      async () => {
        await page.getByRole("button", { name: /^Mode Panggil/ }).click();
        const parent = page.getByRole("dialog", {
          name: "Mode Panggil",
          exact: true,
        });
        await parent.locator(".call-start").click();
        await parent.locator(".call-choice").first().waitFor();
        await parent
          .getByLabel("Lanjut otomatis setelah pilih status", { exact: true })
          .check();
        await parent.locator(".call-choice").first().click();
        const before = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("bap.draft.qa-user:k1:p4")),
        );
        await parent
          .getByRole("button", { name: "Penjelasan Mode Panggil", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Mode Panggil", exact: true })
          .last()
          .waitFor();
        await page.keyboard.press("1");
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(850);
        const after = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("bap.draft.qa-user:k1:p4")),
        );
        assert.deepEqual(after.statuses, before.statuses);
        assert.deepEqual(after.panggil, before.panggil);
        await page.keyboard.press("Escape");
        assert(await parent.isVisible());
        await page.keyboard.press("Escape");
        await parent.waitFor({ state: "hidden" });
      },
    );
    await check(
      "help pauses an active group-exit countdown and never restarts it implicitly",
      async () => {
        await page.evaluate(() => {
          const key = "bap.draft.qa-user:k1:p4",
            draft = JSON.parse(localStorage.getItem(key)),
            group = JSON.parse(draft.panggil.roster).filter(
              (p) => p[3] === "A",
            );
          draft.panggil.reviewedIds = group.slice(0, -1).map((p) => p[0]);
          draft.panggil.groupKey = "A";
          draft.panggil.currentId = group.at(-1)[0];
          draft.panggil.positions.A = group.at(-1)[0];
          localStorage.setItem(key, JSON.stringify(draft));
        });
        await page.reload();
        await page.locator(".student-row").last().waitFor();
        await page.getByRole("button", { name: /^Mode Panggil/ }).click();
        const parent = page.getByRole("dialog", {
          name: "Mode Panggil",
          exact: true,
        });
        await parent
          .getByLabel("Keluar otomatis 3 detik setelah golongan selesai", {
            exact: true,
          })
          .check();
        await parent.locator(".call-start").click();
        await parent
          .getByLabel("Lanjut otomatis setelah pilih status", { exact: true })
          .uncheck();
        await parent.locator(".call-choice").first().click();
        await parent.locator(".call-next").click();
        await parent.locator(".call-exit-countdown").waitFor();
        await parent
          .getByRole("button", { name: "Penjelasan Mode Panggil", exact: true })
          .click();
        await page.locator(".help-panel").waitFor();
        const before = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("bap.draft.qa-user:k1:p4")),
        );
        await page.waitForTimeout(3500);
        assert.equal(await page.locator(".call-modal").count(), 1);
        assert.equal(await page.locator(".call-exit-countdown").count(), 0);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1100);
        assert(await parent.isVisible());
        const after = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("bap.draft.qa-user:k1:p4")),
        );
        assert.deepEqual(after.panggil, before.panggil);
        assert.deepEqual(after.statuses, before.statuses);
        // Pointer can remain over the restored (?) trigger and display its hover
        // hint. Leave it before testing the underlying dialog's Escape action.
        await page.mouse.move(0, 0);
        await page.getByRole("tooltip").waitFor({ state: "hidden" });
        await page.keyboard.press("Escape");
        await parent.waitFor({ state: "hidden" });
      },
    );
    await page.goto(base + "/kelas/k1?tab=pengaturan");
    await page
      .getByRole("heading", { name: "Identitas kelas", exact: true })
      .waitFor();
    await check(
      "all management/help areas, permissions and backup explanations are reachable",
      async () => {
        const before = await academic();
        for (const title of [
          "Identitas kelas dan dosen",
          "Kelas arsip",
          "Izin Operator per kelas",
          "Ekspor CSV dan JSON",
        ]) {
          await page
            .getByRole("button", { name: "Penjelasan " + title, exact: true })
            .first()
            .click();
          await page
            .getByRole("dialog", { name: title, exact: true })
            .waitFor();
          await page.keyboard.press("Escape");
        }
        await page
          .getByText("Pulihkan dari backup JSON", { exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Penjelasan Pulihkan backup JSON",
            exact: true,
          })
          .click();
        await page
          .getByText(/maksimal 500 peserta yang ditulis per cohort/)
          .waitFor();
        await page.keyboard.press("Escape");
        assert.deepEqual(await academic(), before);
      },
    );
    await check(
      "online/offline help and access-sensitive search explain actual availability",
      async () => {
        await page.evaluate(() => window.__qa.setConnected(false));
        await page
          .getByRole("button", { name: /^Bantuan halaman ini/ })
          .click();
        await page
          .getByText(
            "Offline: keadaan data dan izin dapat tertinggal dari server.",
            { exact: false },
          )
          .waitFor();
        await page.keyboard.press("Escape");
        await page.evaluate(() => window.__qa.setConnected(true));
        await page.evaluate(() => window.__qa.controlRole("OPERATOR", []));
        await page.goto(base + "/kelas/k1?tab=mahasiswa");
        await page
          .getByRole("button", { name: /^Bantuan halaman ini/ })
          .click();
        await page
          .getByLabel("Cari penjelasan fitur", { exact: true })
          .fill("pulihkan backup");
        await page
          .getByText("Tidak ada penjelasan yang cocok.", { exact: false })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: /Pulihkan backup JSON/ })
            .count(),
          0,
        );
        await page.keyboard.press("Escape");
        await page.evaluate(() => window.__qa.controlRole("ADMIN"));
      },
    );
    await page.goto(base + "/kelas/k1?tab=jadwal&correct=p3");
    await page.locator('[aria-label="Tanggal pelaksanaan"]:enabled').waitFor();
    await check(
      "disabled reasons reflect selection/permissions and never expose a forbidden correction link",
      async () => {
        await page.goto(base + "/kelas/k1?tab=jadwal");
        await page
          .getByText(
            "Tambahkan pertemuan, lalu isi tanggalnya. Setelah jadwal siap, lanjutkan ke Template BAP.",
            { exact: true },
          )
          .waitFor();
        await page.evaluate(() => window.__qa.controlRole("OPERATOR", []));
        await page
          .getByText(
            "Akunmu belum memiliki izin jadwal pada kelas ini. Hubungi Pengelola.",
            { exact: true },
          )
          .waitFor();
        assert.equal(
          await page.getByRole("link", { name: /^Edit rincian / }).count(),
          0,
        );
        await page.goto(base + "/kelas/k1/pertemuan/p4");
        await page.locator(".student-row").last().waitFor();
        assert.equal(await page.getByRole("button", { name: "Tanggal & data sesi", exact: true }).count(), 0);
        await page.evaluate(() => window.__qa.controlRole("ADMIN"));
        await page.goto(base + "/kelas/k1?tab=jadwal&correct=p3");
        await page
          .locator('[aria-label="Tanggal pelaksanaan"]:enabled')
          .waitFor();
        await page
          .getByText(
            "Periksa perubahan terlebih dahulu untuk menampilkan tombol Simpan revisi.",
            { exact: true },
          )
          .waitFor();
      },
    );
    await check(
      "help panels and tours fit mobile/desktop, dark/light, true 200% text and accessible semantics",
      async () => {
        for (const width of [320, 390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await page
            .getByRole("button", {
              name: "Penjelasan Tanggal pelaksanaan",
              exact: true,
            })
            .click();
          await withinViewport(".help-panel");
          await page.keyboard.press("Escape");
          await startTour();
          await withinViewport(".bap-help-tour");
          await closeTour();
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({ colorScheme: "dark" });
        await page
          .getByRole("button", {
            name: "Penjelasan Tanggal pelaksanaan",
            exact: true,
          })
          .click();
        await page.addScriptTag({ content: axe.source });
        let result = await page.evaluate(() =>
          axe.run(document.querySelector(".help-panel"), {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          }),
        );
        assert.deepEqual(
          result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
        );
        await resizeText(page);
        await withinViewport(".help-panel");
        await page.screenshot({
          path: `${out}/${engine}-help-dark-200pct.png`,
          fullPage: false,
        });
        await page.keyboard.press("Escape");
        await page.reload();
        await page
          .locator('[aria-label="Tanggal pelaksanaan"]:enabled')
          .waitFor();
        await startTour();
        await page.addScriptTag({ content: axe.source });
        result = await page.evaluate(() =>
          axe.run(document.querySelector(".bap-help-tour"), {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          }),
        );
        assert.deepEqual(
          result.violations.map((v) => v.id),
          [],
        );
        await resizeText(page);
        await withinViewport(".bap-help-tour");
        await page.screenshot({
          path: `${out}/${engine}-tour-dark-200pct.png`,
          fullPage: false,
        });
        await closeTour();
      },
    );
    await check(
      "login/profile/accounts/documents and template guides are reachable with accurate legacy guidance",
      async () => {
        for (const [route, area] of [
          ["/pengaturan", "Akun saya"],
          ["/akun", "Akses akun"],
          ["/dokumen", "Dokumen & cetak"],
          ["/kelas/k1?tab=template", "Template BAP"],
        ]) {
          await page.goto(base + route);
          await page
            .getByRole("button", {
              name: "Bantuan halaman ini: " + area,
              exact: true,
            })
            .click();
          await page
            .getByRole("dialog", { name: "Bantuan & panduan", exact: true })
            .waitFor();
          assert((await page.locator(".help-topic-item").count()) > 0);
          await page.keyboard.press("Escape");
        }
        const freshContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
          }),
          other = await freshContext.newPage();
        other.on("pageerror", (e) => errors.push(e.message));
        await other.goto(base + "/");
        await other.evaluate(() => localStorage.removeItem("bap.token"));
        await other.reload();
        await other
          .getByRole("button", {
            name: "Bantuan halaman ini: Masuk & pemulihan",
            exact: true,
          })
          .click();
        await other
          .getByLabel("Topik halaman", { exact: true })
          .selectOption("");
        assert.equal(await other.locator(".help-topic-item").count(), 2);
        await other.keyboard.press("Escape");
        await other.evaluate(() => {
          localStorage.setItem("bap.token", "ui-test-token");
          localStorage.setItem("ui-qa.require-password-change", "1");
        });
        await other.reload();
        await other.getByRole("heading", { name: "Amankan akunmu.", exact: true }).waitFor();
        const forcedHelp = other.getByRole("button", { name: "Bantuan halaman ini: Akun saya", exact: true });
        assert(await forcedHelp.evaluate(e => Boolean(e.closest(".mg-section-heading"))));
        await forcedHelp.click();
        await other.getByRole("dialog", { name: "Bantuan & panduan", exact: true }).waitFor();
        await other.keyboard.press("Escape");
        await other.evaluate(() => {
          localStorage.removeItem("ui-qa.require-password-change");
          localStorage.setItem("bap.token", "ui-test-token");
          localStorage.removeItem("bap.help.welcome.v1.qa-user");
          localStorage.removeItem("ui-qa.control-engine");
        });
        await other.goto(base + "/kelas/k1");
        await other
          .getByText("Kenali ruang kerja BAP", { exact: true })
          .waitFor();
        assert.equal(await other.getByRole("dialog").count(), 0);
        await other
          .getByRole("button", { name: "Lewati", exact: true })
          .click();
        await other.reload();
        await other.locator(".meeting-row").last().waitFor();
        assert.equal(
          await other
            .getByText("Kenali ruang kerja BAP", { exact: true })
            .count(),
          0,
        );
        await other
          .getByRole("button", { name: /^Bantuan halaman ini/ })
          .click();
        await other
          .getByLabel("Cari penjelasan fitur", { exact: true })
          .fill("Periksa simpan kunci");
        await other
          .locator(".help-panel")
          .getByRole("button", { name: /^Periksa, simpan dan kunci/ })
          .click();
        await other
          .getByText(
            "Pada alur lama, koreksi presensi dilakukan melalui Buka kunci lalu",
            { exact: false },
          )
          .waitFor();
        await freshContext.close();
      },
    );
    await check(
      "no runtime errors in help, tours and all exercised parent flows",
      async () => assert.deepEqual(errors, []),
    );
    await context.close();
    await browser.close();
    browser = null;
  }
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ passed: true, checks }, null, 2),
  );
  console.log(checks.length + " contextual help browser checks passed.");
})()
  .catch(async (error) => {
    try {
      await page?.screenshot({
        path: `${out}/${engine}-failure.png`,
        fullPage: true,
      });
    } catch {}
    console.error(error);
    fs.writeFileSync(`${out}/failure.log`, String(error.stack || error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
  });
