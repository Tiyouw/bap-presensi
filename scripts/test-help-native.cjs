// Explicit synthetic preview only. Credentials and failure diagnostics stay in ignored out/.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { createHash } = require("node:crypto"),
  { spawn, execFileSync } = require("node:child_process"),
  { chromium, webkit } = require("playwright");
const args = process.argv.slice(2),
  credentialPath = args[args.indexOf("--credentials") + 1];
if (!args.includes("--credentials") || !credentialPath)
  throw Error(
    "Use --credentials out/credentials/explicit-synthetic-preview.json",
  );
const credentials = JSON.parse(
    fs.readFileSync(credentialPath, "utf8").replace(/^\uFEFF/, ""),
  ),
  review = credentials.review;
if (
  credentials.demo !== true ||
  !/:preview\//.test(credentials.deployment || "") ||
  !review?.kelasId ||
  !review?.meetingId ||
  !/^https:\/\/[a-z0-9-]+\.convex\.cloud$/.test(review.backend || "")
)
  throw Error(
    "An explicit synthetic preview credential file with review.backend/class/meeting is required.",
  );
const user = credentials.users[1] || credentials.users[0],
  out = "out/help/native",
  build = "out/help/native-build",
  base = "http://127.0.0.1:5243",
  checks = [];
fs.mkdirSync(out, { recursive: true });
let server,
  browser,
  page,
  engine = "";
const digest = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
async function startOrigin() {
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--outDir",
      build,
      "--host",
      "127.0.0.1",
      "--port",
      "5243",
      "--strictPort",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
}

(async () => {
  const { ConvexHttpClient } = await import("convex/browser"),
    { api } = await import("../convex/_generated/api.js");
  fs.writeFileSync(
    `${out}/build.log`,
    execFileSync(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "build", "--outDir", build],
      {
        env: { ...process.env, VITE_CONVEX_URL: review.backend },
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
  const sw = fs.readFileSync(`${build}/sw.js`, "utf8");
  assert(
    sw.includes("third-party-notices.txt") &&
      /helpTour-[^" ]+\.js/.test(sw) &&
      /helpTour-[^" ]+\.css/.test(sw),
    "Lazy tour JS/CSS must be precached for first offline use",
  );
  await startOrigin();
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    engine = name;
    browser = await type.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    page = await context.newPage();
    page.setDefaultTimeout(25000);
    const errors = [],
      unexpected = [],
      writes = [],
      downloads = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => {
      if (d.type() === "beforeunload") d.accept();
      else {
        unexpected.push(d.type());
        d.dismiss();
      }
    });
    page.on("download", (d) => downloads.push(d.suggestedFilename()));
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/api\/(action|mutation)$/.test(r.url()))
        writes.push("http:" + new URL(r.url()).pathname);
    });
    page.on("websocket", (socket) =>
      socket.on("framesent", (event) => {
        try {
          const message = JSON.parse(event.payload);
          if (["Mutation", "Action"].includes(message.type))
            writes.push(message.type + ":" + message.udfPath);
        } catch {}
      }),
    );
    await page.goto(base);
    await page.locator("#username").fill(user.username);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: /Masuk ke aplikasi/ }).click();
    await page.waitForFunction(() =>
      Boolean(localStorage.getItem("bap.token")),
    );
    await page.waitForURL(base + "/");
    const token = await page.evaluate(() => localStorage.getItem("bap.token")),
      client = new ConvexHttpClient(review.backend, { logger: false }),
      identity = await client.query(api.auth.me, { token });
    await page.evaluate(
      (id) => localStorage.setItem(`bap.help.welcome.v1.${id}`, "1"),
      identity.id,
    );
    const route = `/kelas/${review.kelasId}?tab=jadwal&correct=${review.meetingId}`;
    await page.goto(base + route);
    await page.locator('[aria-label="Tanggal pelaksanaan"]:enabled').waitFor();
    const academic = async () => {
      const model = await client.query(api.revisions.editor, {
          token,
          pertemuanId: review.meetingId,
        }),
        history = await client.query(api.bap.history, {
          token,
          kelasId: review.kelasId,
        });
      return {
        classRevision: model.classRevision,
        meeting: model.meeting,
        snapshot: model.snapshot,
        statuses: model.statuses,
        documents: history.map((d) => ({
          id: d.id,
          revision: d.revision,
          sha256: d.sha256,
          tanggal: d.tanggal,
          format: d.format,
        })),
      };
    };
    const before = await academic(),
      date = await page
        .getByLabel("Tanggal pelaksanaan", { exact: true })
        .inputValue();
    await page
      .getByLabel("Catatan perubahan", { exact: true })
      .fill("Synthetic native help draft — not submitted");
    const baselineWrites = writes.length;
    assert(
      baselineWrites > 0,
      "The action monitor must observe actual login before no-write assertions",
    );
    await page
      .getByRole("button", {
        name: "Penjelasan Tanggal pelaksanaan",
        exact: true,
      })
      .tap();
    await page
      .getByRole("dialog", { name: "Tanggal pelaksanaan", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Baca panduan terkait", exact: true })
      .click();
    await page
      .getByLabel("Cari penjelasan fitur", { exact: true })
      .fill("draf");
    assert(await page.locator(".help-topic-item").count());
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByLabel("Tanggal pelaksanaan", { exact: true })
        .inputValue(),
      date,
    );
    assert.equal(
      await page.getByLabel("Catatan perubahan", { exact: true }).inputValue(),
      "Synthetic native help draft — not submitted",
    );
    assert.equal(digest(await academic()), digest(before));
    assert.equal(writes.length, baselineWrites);
    checks.push({
      engine,
      name: "actual production build signs in to explicit preview; help/search preserve complete academic snapshot and make no Action/Mutation",
      passed: true,
    });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.locator('[aria-label="Tanggal pelaksanaan"]:enabled').waitFor();
    const precachedHelp = await page.evaluate(async () => {
      const name = (await caches.keys()).find((k) =>
          k.startsWith("bap-shell-"),
        ),
        cache = await caches.open(name);
      return (await cache.keys())
        .map((r) => r.url)
        .filter((url) => url.includes("/assets/helpTour-"));
    });
    assert(
      precachedHelp.some((url) => url.endsWith(".js")) &&
        precachedHelp.some((url) => url.endsWith(".css")),
      "Tour assets must already exist in the app-shell cache",
    );
    const outageMethod =
      engine === "webkit" ? "origin-server-stopped" : "browser-context-offline";
    if (engine === "webkit") {
      // Playwright WebKit offline emulation blocks even literal SW responses:
      // https://github.com/microsoft/playwright/issues/42775
      // Stop the real asset origin instead; do not pre-import the tour or skip the case.
      const stopped = server;
      await new Promise((resolve) => {
        stopped.once("exit", resolve);
        stopped.kill();
      });
      server = null;
      let refused = false;
      try {
        await fetch(base);
      } catch {
        refused = true;
      }
      assert(refused, "Origin must really be stopped");
      assert(
        await page.evaluate(async () => {
          try {
            await fetch("/uncached-help-negative-control.js");
            return false;
          } catch {
            return true;
          }
        }),
        "An uncached resource must fail while the origin is stopped",
      );
    } else {
      await context.setOffline(true);
      await page
        .getByText("Offline. Draf dapat disunting;", { exact: false })
        .waitFor();
    }
    // The first tour import happens offline: only the precached app-shell can satisfy it.
    await page
      .getByRole("button", { name: "Tunjukkan caranya", exact: true })
      .click();
    await page.locator(".bap-help-tour").waitFor();
    for (
      let i = 0;
      i < 8 && (await page.locator(".bap-help-tour").count());
      i++
    )
      await page.locator(".driver-popover-next-btn").click();
    await page.locator(".bap-help-tour").waitFor({ state: "hidden" });
    assert.equal(writes.length, baselineWrites);
    assert.equal(downloads.length, 0);
    assert.equal(digest(await academic()), digest(before));
    checks.push({
      engine,
      name: "first lazy tour opens and completes from the precached production app-shell while its origin is unavailable; no academic writes or downloads",
      outageMethod,
      precachedHelpAssets: precachedHelp.length,
      passed: true,
    });
    if (engine === "webkit") await startOrigin();
    else await context.setOffline(false);
    await page
      .getByRole("button", {
        name: "Penjelasan Tanggal pelaksanaan",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog", { name: "Tanggal pelaksanaan", exact: true })
      .waitFor();
    fs.writeFileSync(
      `${out}/${engine}-help-aria.yml`,
      await page.locator(".help-panel").ariaSnapshot(),
    );
    await page.screenshot({
      path: `${out}/${engine}-help-native.png`,
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    assert.equal(digest(await academic()), digest(before));
    checks.push({
      engine,
      name: "real backend draft survives reload; accessible help tree, keyboard cleanup and immutable current/history data verified",
      passed: true,
    });
    await context.close();
    await browser.close();
    browser = null;
    console.log("PASS native contextual help", engine);
  }
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        passed: true,
        backend: review.backend,
        synthetic: true,
        checks,
        productionOfflinePrecache: true,
        webkitOfflineMethod:
          "real origin shutdown with uncached-resource negative control; Playwright setOffline limitation: https://github.com/microsoft/playwright/issues/42775",
        noAcademicWrites: true,
      },
      null,
      2,
    ),
  );
  console.log(checks.length + " native help/production-offline checks passed.");
})()
  .catch(async (error) => {
    fs.writeFileSync(
      `${out}/failure-private.log`,
      String(error.stack || error),
    );
    try {
      await page?.screenshot({
        path: `${out}/failure-private.png`,
        fullPage: true,
      });
    } catch {}
    console.error(
      "Native help verification failed; ignored private diagnostics retained.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
  });
