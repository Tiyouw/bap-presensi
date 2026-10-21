/** Real React editor with deterministic synthetic transport; never production data. */
const { chromium, webkit } = require("playwright");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { stripVTControlCharacters } = require("node:util");
const base = "b1c7ee1";
const out = "out/panggil",
  shots = "docs/mode-panggil";
const captureOnly = process.argv.includes("--capture-only");
const capture = captureOnly || process.argv.includes("--capture");
const servers = [],
  results = [];
let browser, currentPage;
fs.mkdirSync(out, { recursive: true });
const ok = (engine, name) => {
  results.push({ engine, name, passed: true });
  console.log("OK", engine, name);
};
async function serve(config, port) {
  const proc = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      config,
      "--port",
      String(port),
      "--strictPort",
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  servers.push(proc);
  let log = "";
  proc.stdout.on("data", (b) => (log += b));
  proc.stderr.on("data", (b) => (log += b));
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) throw Error(log);
    // Do not accidentally capture another chat's Vite server on this port.
    if (stripVTControlCharacters(log).includes(`:${port}/`)) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Vite startup timed out: " + log);
}
function prepareBase() {
  const dir = path.resolve(out, "base");
  fs.mkdirSync(dir, { recursive: true });
  const tar = path.resolve(out, "base.tar");
  execFileSync("git", [
    "archive",
    "--format=tar",
    "-o",
    tar,
    base,
    "src",
    "bap-shared",
    "convex/_generated",
    "scripts/ui",
    "index.html",
    "package.json",
  ]);
  execFileSync("tar", ["-xf", tar, "-C", dir]);
  const slash = (p) => p.replaceAll("\\", "/");
  const config = path.join(dir, "vite.config.mjs");
  fs.writeFileSync(
    config,
    `import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';export default defineConfig({root:${JSON.stringify(slash(dir))},plugins:[react()],define:{'import.meta.env.VITE_CONVEX_URL':JSON.stringify('https://ui-fixture.convex.cloud')},resolve:{alias:[{find:/^convex\\/react$/,replacement:${JSON.stringify(slash(path.join(dir, "scripts/ui/convex-fixture.jsx")))}},{find:/^.*convex\\/_generated\\/api\\.js$/,replacement:${JSON.stringify(slash(path.join(dir, "scripts/ui/api-fixture.js")))}}]},server:{host:'127.0.0.1'}});`,
  );
  return config;
}
async function session(type, port = 5194, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    ...options,
  });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("bap.token", "ui-test-token");
    localStorage.setItem("bap.guide.dismissed.v1", "1");
  });
  await page.goto(`http://127.0.0.1:${port}/kelas/k1`);
  await page.locator(".meeting-row").filter({ hasText: "Pertemuan 3" }).click();
  await page.locator(".student-row").last().waitFor();
  return { context, page, errors };
}
async function open(page, start = true) {
  await page.getByRole("button", { name: /Mode Panggil/ }).click();
  await page.getByRole("dialog", { name: "Mode Panggil" }).waitFor();
  if (start) await page.locator(".call-start").click();
}
async function close(page) {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
async function reviewed(page, n, total = 23) {
  await page
    .getByText(`${n} dari ${total} diperiksa`, { exact: true })
    .waitFor();
}
async function nearGroupEnd(page, skipFirst = false) {
  // Restore a deterministic partial draft using the editor's actual schema.
  await open(page);
  await page.getByLabel("Lanjut otomatis").uncheck();
  await close(page);
  await page.evaluate((skip) => {
    const key = "bap.draft.qa-user:k1:p3";
    const draft = JSON.parse(localStorage.getItem(key));
    const group = JSON.parse(draft.panggil.roster).filter((p) => p[3] === "A");
    draft.panggil.reviewedIds = group.slice(skip ? 1 : 0, -1).map((p) => p[0]);
    draft.panggil.currentId = group.at(-1)[0];
    draft.panggil.positions.A = draft.panggil.currentId;
    localStorage.setItem(key, JSON.stringify(draft));
  }, skipFirst);
  await page.reload();
  await page.locator(".student-row").last().waitFor();
  await open(page);
}
async function noOverflow(page) {
  const layout = await page.evaluate(() => {
    const modal = document.querySelector(".call-modal");
    return {
      viewport: innerWidth,
      page: document.documentElement.scrollWidth,
      dialog: modal?.clientWidth,
      content: modal?.scrollWidth,
      overflow: [...(modal?.querySelectorAll("*") || [])]
        .filter(
          (e) =>
            e.getBoundingClientRect().right >
            modal.getBoundingClientRect().right + 1,
        )
        .map((e) => e.className)
        .slice(0, 10),
    };
  });
  assert.ok(
    layout.page <= layout.viewport + 1 &&
      (!layout.dialog || layout.content <= layout.dialog + 1),
    `viewport/dialog horizontal overflow: ${JSON.stringify(layout)}`,
  );
}
(async () => {
  if (capture) await serve(prepareBase(), 5195);
  await serve("scripts/ui/vite.config.mjs", 5194);
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    browser = await type.launch();
    let { context, page, errors } = await session(type);
    if (capture && engine === "chromium") {
      fs.mkdirSync(shots, { recursive: true });
      const before = await session(type, 5195);
      for (const [device, width, height] of [
        ["desktop", 1280, 1000],
        ["mobile", 390, 844],
      ]) {
        await before.page.setViewportSize({ width, height });
        await page.setViewportSize({ width, height });
        await before.page.screenshot({
          path: `${shots}/before-presensi-${device}.png`,
        });
        await page.screenshot({
          path: `${shots}/after-presensi-${device}.png`,
        });
      }
      for (const [device, width, height] of [
        ["desktop", 1280, 1000],
        ["mobile", 390, 844],
      ]) {
        await page.setViewportSize({ width, height });
        await open(page, false);
        await page.screenshot({ path: `${shots}/golongan-${device}.png` });
        await page.locator(".call-help-toggle").click();
        await page.screenshot({ path: `${shots}/bantuan-${device}.png` });
        await page
          .getByRole("button", { name: "Mengerti, kembali", exact: true })
          .click();
        await page.locator(".call-start").click();
        await page.getByLabel("Lanjut otomatis").uncheck();
        await page.getByRole("button", { name: /Izin 4/ }).click();
        await page.screenshot({ path: `${shots}/kartu-${device}.png` });
        await close(page);
      }
      const ending = await session(type);
      await nearGroupEnd(ending.page);
      await ending.page.getByRole("button", { name: /Hadir 1/ }).click();
      await ending.page
        .getByRole("button", { name: /Selesaikan golongan/ })
        .click();
      await ending.page
        .getByRole("button", { name: "Batalkan hitung mundur", exact: true })
        .click();
      for (const [device, width, height] of [
        ["desktop", 1280, 1000],
        ["mobile", 390, 844],
      ]) {
        await ending.page.setViewportSize({ width, height });
        await ending.page.screenshot({
          path: `${shots}/selesai-${device}.png`,
        });
      }
      await ending.context.close();
      await before.context.close();
      await context.close();
      if (captureOnly) {
        await browser.close();
        browser = null;
        return;
      }
      ({ context, page, errors } = await session(type));
    }
    await page.getByRole("searchbox").fill("Bima");
    await open(page, false);
    assert.equal(await page.locator(".call-group-option svg").count(), 4);
    assert.equal(
      await page
        .getByLabel("Keluar otomatis 3 detik setelah golongan selesai")
        .isChecked(),
      true,
    );
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("bap.draft.qa-user:k1:p3"),
      ),
      null,
    );
    await page.locator(".call-start").click();
    await reviewed(page, 0);
    assert.match(await page.locator(".call-person h3").innerText(), /Alya/);
    await page.getByLabel("Lanjut otomatis").uncheck();
    await page
      .getByRole("button", { name: "Lewati dulu", exact: true })
      .click();
    await reviewed(page, 0);
    await page.getByRole("button", { name: /Sebelumnya/ }).click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("bap.draft.qa-user:k1:p3")).statuses
            .DEMO00001,
      ),
      "HADIR",
    );
    await page.getByRole("button", { name: /Hadir 1/ }).click();
    await reviewed(page, 1);
    assert.equal(
      await page.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "sesi:simpanDanKunci")
            .length,
      ),
      0,
    );
    await page.keyboard.press("Enter");
    await page.locator(".call-person h3").filter({ hasText: "Bima" }).waitFor();
    await page.keyboard.press("2");
    await reviewed(page, 2);
    await page.keyboard.press("ArrowRight");
    await page
      .locator(".call-person h3")
      .filter({ hasText: "Citra" })
      .waitFor();
    await page.keyboard.press("3");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("4");
    await reviewed(page, 4);
    await page.keyboard.press("Control+k");
    await page
      .getByRole("combobox", { name: "Cari matkul, mahasiswa, atau fitur" })
      .waitFor();
    assert.equal(await page.locator(".call-modal").count(), 0);
    await page.keyboard.press("Escape");
    await open(page);
    await reviewed(page, 4);
    await page.keyboard.press("ArrowLeft");
    assert.equal(
      await page.locator(".call-choice.SAKIT").getAttribute("aria-pressed"),
      "true",
    );
    await page.keyboard.press("1");
    await reviewed(page, 4);
    await page
      .getByRole("button", { name: "Lewati dulu", exact: true })
      .click();
    assert.match(await page.locator(".call-person h3").innerText(), /Damar/);
    await close(page);
    assert.equal(
      await page
        .getByRole("button", { name: /Mode Panggil/ })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    assert.match(
      await page.locator(".student-row").first().innerText(),
      /Bima.*Alpha/s,
    );
    ok(
      engine,
      "same draft, full roster despite filter, same-default choice, 1–4/Enter/arrows, correction, unique progress and focus return",
    );
    const savedDraft = await page.evaluate(() =>
      localStorage.getItem("bap.draft.qa-user:k1:p3"),
    );
    await page.reload();
    await page.locator(".student-row").last().waitFor();
    await open(page, false);
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("bap.draft.qa-user:k1:p3"),
      ),
      savedDraft,
      "opening/restoring must not rewrite the draft",
    );
    await page.locator(".call-start").click();
    assert.match(await page.locator(".call-person h3").innerText(), /Damar/);
    assert.equal(await page.getByLabel("Lanjut otomatis").isChecked(), false);
    await reviewed(page, 4);
    // Both ends of the dialog trap keyboard focus.
    await page.locator(".call-help-toggle").focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page
        .getByRole("button", { name: "Lewati dulu", exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator(".call-help-toggle")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await close(page);
    await page
      .getByRole("button", { name: "Simpan & Kunci", exact: true })
      .click();
    await page.getByRole("region", { name: "Nama belum diperiksa" }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: /Kunci sekarang/ }).isDisabled(),
      true,
    );
    await page
      .getByRole("button", { name: "Lanjutkan nama yang belum diperiksa" })
      .click();
    assert.match(await page.locator(".call-person h3").innerText(), /Eka/);
    await close(page);
    ok(
      engine,
      "reload/resume, remembered preference, focus trap and explicit review of skipped names",
    );
    for (const width of [320, 390, 768, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ colorScheme: theme });
        await open(page, false);
        await noOverflow(page);
        await page.locator(".call-help-toggle").click();
        await noOverflow(page);
        await page.evaluate(
          () => (document.documentElement.style.fontSize = "200%"),
        );
        await noOverflow(page);
        await page.evaluate(
          () => (document.documentElement.style.fontSize = ""),
        );
        await page.keyboard.press("Escape");
        await page.locator(".call-start").click();
        await noOverflow(page);
        assert.equal(
          await page
            .locator(".call-choices")
            .evaluate(
              (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
            ),
          2,
          "normal text must keep the chosen 2 × 2 status layout",
        );
        for (const s of ["HADIR", "ALPHA", "SAKIT", "IZIN"]) {
          const target = page.locator(`.call-choice.${s}`);
          await target.click();
          assert.equal(await target.getAttribute("aria-pressed"), "true");
          const box = await target.boundingBox();
          assert.ok(box.width >= 48 && box.height >= 48);
        }
        await page.evaluate(
          () => (document.documentElement.style.fontSize = "200%"),
        );
        await noOverflow(page);
        await page
          .getByRole("button", { name: "Lewati dulu", exact: true })
          .scrollIntoViewIfNeeded();
        await page.evaluate(
          () => (document.documentElement.style.fontSize = ""),
        );
        await close(page);
      }
    assert.deepEqual(errors, []);
    ok(
      engine,
      "320/390/768/1280, both themes, all status colors, 48px targets, 200% text and reduced motion",
    );
    await page.evaluate(() =>
      window.__qa.renameParticipant(
        "DEMO00001",
        "Mahasiswa Contoh dengan Nama Sangat Panjang untuk Pemeriksaan Keterbacaan Kartu dan Pemulihan Snapshot",
      ),
    );
    await open(page);
    await reviewed(page, 0);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    await noOverflow(page);
    await page.evaluate(() => (document.documentElement.style.fontSize = ""));
    await close(page);
    ok(
      engine,
      "changed roster snapshot resets reviewed progress; long names remain readable at 320px/200% text",
    );
    await context.close();
    ({ context, page, errors } = await session(type, 5194, {
      reducedMotion: "no-preference",
    }));
    await open(page);
    await page.getByRole("button", { name: /Alpha 2/ }).dblclick();
    assert.match(
      await page.locator(".call-card").getAttribute("class"),
      /ALPHA/,
    );
    await page
      .getByRole("button", { name: /Alpha 2/ })
      .dispatchEvent("keydown", { key: "2", repeat: true });
    await page.locator(".call-person h3").filter({ hasText: "Bima" }).waitFor();
    await reviewed(page, 1);
    await page.waitForTimeout(850);
    assert.match(await page.locator(".call-person h3").innerText(), /Bima/);
    await page.getByRole("button", { name: /Izin 4/ }).click();
    await page.keyboard.press("ArrowRight");
    await page
      .locator(".call-person h3")
      .filter({ hasText: "Citra" })
      .waitFor();
    await page.waitForTimeout(850);
    assert.match(await page.locator(".call-person h3").innerText(), /Citra/);
    await page.getByRole("button", { name: /Sakit 3/ }).click();
    await page.locator(".call-help-toggle").click();
    await page.waitForTimeout(850);
    await page.keyboard.press("4");
    await page.keyboard.press("Escape");
    assert.match(await page.locator(".call-person h3").innerText(), /Citra/);
    assert.equal(
      await page.locator(".call-choice.SAKIT").getAttribute("aria-pressed"),
      "true",
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(850);
    await open(page);
    assert.match(await page.locator(".call-person h3").innerText(), /Citra/);
    ok(
      engine,
      "700ms feedback, animated auto advance, key-repeat suppression, manual advance and close cancel timers",
    );
    await page.evaluate(() => window.__qa.setConnected(false));
    await page.getByLabel("Lanjut otomatis").uncheck();
    await page.getByRole("button", { name: /Izin 4/ }).click();
    await reviewed(page, 3);
    await page.evaluate(() => window.__qa.setConnected(true));
    await page.evaluate(() => window.__qa.advance("p3"));
    await page
      .locator(".call-warning")
      .filter({ hasText: "Pengeditan dihentikan" })
      .waitFor();
    assert.equal(await page.locator(".call-choice").first().isDisabled(), true);
    await close(page);
    await page
      .getByText("Data di server lebih baru.", { exact: false })
      .waitFor();
    ok(
      engine,
      "offline edits persist and reactive revision conflict stops card input",
    );
    await context.close();
    ({ context, page } = await session(type));
    await open(page);
    await page.getByLabel("Lanjut otomatis").uncheck();
    await page.evaluate(() => {
      const old = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k.startsWith("bap.draft.")) throw Error("quota");
        return old.call(this, k, v);
      };
    });
    await page.getByRole("button", { name: /Hadir 1/ }).click();
    await page
      .locator(".call-warning")
      .filter({ hasText: "belum tersimpan" })
      .waitFor();
    await context.close();
    ({ context, page } = await session(type));
    await nearGroupEnd(page);
    await page.getByRole("button", { name: /Hadir 1/ }).click();
    await page.getByRole("button", { name: /Selesaikan golongan/ }).click();
    await page.getByText("Golongan A selesai.", { exact: true }).waitFor();
    const exitStarted = Date.now();
    await page.locator(".call-modal").waitFor({ state: "hidden" });
    assert.ok(Date.now() - exitStarted >= 2700, "exit waits three seconds");
    assert.equal(
      await page.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "sesi:simpanDanKunci")
            .length,
      ),
      0,
    );
    await open(page, false);
    assert.equal(
      await page.locator('[data-call-group="B"]').getAttribute("aria-pressed"),
      "true",
    );
    await page.locator(".call-start").click();
    await reviewed(page, 0, 24);
    await page
      .getByRole("button", { name: "Lewati dulu", exact: true })
      .click();
    const savedB = await page.locator(".call-person h3").innerText();
    await close(page);
    await page.reload();
    await page.locator(".student-row").last().waitFor();
    await open(page);
    assert.equal(await page.locator(".call-person h3").innerText(), savedB);
    ok(
      engine,
      "group A exits after three seconds without locking; next scheduled group selected; B position survives reload",
    );
    await context.close();
    ({ context, page } = await session(type));
    await nearGroupEnd(page, true);
    await page.getByRole("button", { name: /Hadir 1/ }).click();
    await page.getByRole("button", { name: /Selesaikan golongan/ }).click();
    await page
      .getByText("Golongan A belum selesai.", { exact: true })
      .waitFor();
    assert.equal(await page.locator(".call-exit-countdown").count(), 0);
    await page
      .getByRole("button", { name: "Periksa nama yang dilewati", exact: true })
      .click();
    assert.match(await page.locator(".call-person h3").innerText(), /Alya/);
    await reviewed(page, 22);
    await page.getByRole("button", { name: /Hadir 1/ }).click();
    await reviewed(page, 23);
    ok(
      engine,
      "skipped names keep their statuses, prevent automatic exit and can be reviewed within the same group",
    );
    await context.close();
    ({ context, page } = await session(type));
    await open(page);
    await page.getByLabel("Lanjut otomatis").uncheck();
    // Progress and completion belong to each group, never auto-locking the class.
    for (const [g, count, next] of [
      ["A", 23, "B"],
      ["B", 24, "C"],
      ["C", 23, "D"],
      ["D", 23, null],
    ]) {
      await reviewed(page, 0, count);
      for (let i = 0; i < count; i++) {
        await page.getByRole("button", { name: /Hadir 1/ }).click();
        await page
          .getByRole("button", {
            name: i === count - 1 ? /Selesaikan golongan/ : /Selanjutnya/,
          })
          .click();
      }
      await page.getByText(`Golongan ${g} selesai.`, { exact: true }).waitFor();
      if (g === "A") {
        await page.locator(".call-help-toggle").click();
        await page.waitForTimeout(3200);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".call-exit-countdown").count(), 0);
      } else
        await page
          .getByRole("button", { name: "Batalkan hitung mundur", exact: true })
          .click();
      if (capture && engine === "chromium" && g === "A") {
        for (const [device, width, height] of [
          ["desktop", 1280, 1000],
          ["mobile", 390, 844],
        ]) {
          await page.setViewportSize({ width, height });
          await page.screenshot({ path: `${shots}/selesai-${device}.png` });
        }
      }
      if (next)
        await page
          .getByRole("button", {
            name: `Lanjut ke golongan ${next}`,
            exact: true,
          })
          .click();
    }
    await page
      .getByRole("button", {
        name: "Periksa presensi seluruh kelas",
        exact: true,
      })
      .click();
    await page.getByRole("dialog", { name: "Periksa presensi" }).waitFor();
    assert.equal(
      await page.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "sesi:simpanDanKunci")
            .length,
      ),
      0,
    );
    await close(page);
    await page.getByRole("button", { name: /Mode Panggil/ }).click();
    await page.getByRole("dialog", { name: "Periksa presensi" }).waitFor();
    await page.getByRole("button", { name: /Kunci sekarang/ }).click();
    await page
      .locator(".attendance-meta .session-badge")
      .filter({ hasText: "Terkunci" })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "sesi:simpanDanKunci")
            .length,
      ),
      1,
    );
    assert.equal(
      await page.getByRole("button", { name: /Mode Panggil/ }).count(),
      0,
    );
    ok(
      engine,
      "93 cards across four independent groups; help pauses completion countdown; explicit next group and class review; one explicit lock",
    );
    await context.close();
    ({ context, page } = await session(type));
    await open(page);
    await page.evaluate(() => window.__qa.expireSession());
    await page.getByLabel("Username", { exact: true }).waitFor();
    assert.equal(await page.locator(".call-modal").count(), 0);
    ok(
      engine,
      "storage failure is visible; expired session removes editable card",
    );
    await context.close();
    await browser.close();
    browser = null;
  }
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ base, passed: true, results }, null, 2),
  );
})()
  .catch(async (error) => {
    console.error(error);
    await currentPage
      ?.screenshot({ path: `${out}/failure.png` })
      .catch(() => {});
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    for (const s of servers) s.kill();
  });
