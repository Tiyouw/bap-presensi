/** Read-only viewport sweep of management screens against the synthetic QA backend. */
const { chromium, webkit } = require("playwright"),
  { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
let server, browser, page;
const out = "out/management/responsive",
  results = [];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { ConvexHttpClient } = await import("convex/browser"),
    { api } = await import("../../convex/_generated/api.js");
  const client = new ConvexHttpClient("https://doting-horse-423.convex.cloud"),
    password =
      process.env.BAP_QA_PASSWORD ||
      JSON.parse(fs.readFileSync("out/management/qa-credentials.json"))
        .password;
  const token = (
      await client.action(api.authNode.login, {
        username: "admin.qa",
        password,
      })
    ).token,
    catalog = await client.query(api.kelola.catalog, { token }),
    selected = catalog.kelas
      .filter((c) => c.matkulKode.startsWith("DP") && !c.draft && !c.arsip)
      .at(-1);
  if (!selected)
    throw Error(
      "Run the management UI suite first to create a synthetic example class.",
    );
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5189",
      "--strictPort",
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  server.stderr.on("data", (b) => (output += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5189/")).ok) break;
    } catch {}
    if (server.exitCode !== null) throw Error(output);
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    browser = await type.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((token) => {
      localStorage.setItem("bap.token", token);
      localStorage.setItem("bap.guide.dismissed.v1", "1");
    }, token);
    const root = `/kelas/${selected.id}`,
      paths = [
        "/",
        "/kelas",
        "/kelas/baru",
        root + "?tab=mahasiswa",
        root + "?tab=jadwal",
        root + "?tab=template",
        root + "?tab=pengaturan",
        root + "?tab=riwayat",
        "/dokumen",
        "/akun",
        "/pengaturan",
      ];
    async function sweep(label) {
      for (const width of [320, 390, 768, 1280])
        for (const theme of ["light", "dark"]) {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme: theme });
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          const layout = await page.evaluate(() => ({
            viewport: window.innerWidth,
            width: document.documentElement.scrollWidth,
            overflow: [...document.querySelectorAll("body *")]
              .filter((e) => {
                const r = e.getBoundingClientRect();
                return (
                  r.width &&
                  r.right > window.innerWidth + 1 &&
                  getComputedStyle(e).position !== "fixed"
                );
              })
              .slice(0, 5)
              .map((e) => e.className),
          }));
          assert.ok(
            layout.width <= layout.viewport + 1,
            `${name} ${label} ${width}: ${JSON.stringify(layout)}`,
          );
          results.push({
            browser: name,
            page: label,
            width,
            theme,
            passed: true,
          });
        }
      console.log("OK responsive", name, label);
    }
    for (const route of paths) {
      await page.goto("http://127.0.0.1:5189" + route);
      await page.locator("h1").first().waitFor();
      await page.waitForFunction(
        () =>
          !document.querySelector(".login-splash") &&
          !document.querySelector(".skeleton-region"),
      );
      if (route === "/dokumen") {
        await page
          .getByLabel("Kelas", { exact: true })
          .selectOption(selected.id);
        await page.waitForFunction(
          () => !document.querySelector(".skeleton-region"),
        );
      }
      await sweep(route);
      if (route.endsWith("tab=mahasiswa")) {
        await page
          .getByRole("button", { name: "Impor Excel / CSV", exact: true })
          .click();
        await page
          .getByLabel("File mahasiswa (maksimum 5 MB)")
          .setInputFiles({
            name: "contoh.csv",
            mimeType: "text/csv",
            buffer: Buffer.from("NIM,Nama,Golongan\n00001,Alya Contoh,X"),
          });
        await page
          .getByRole("button", {
            name: "Konfirmasi impor 1 mahasiswa",
            exact: true,
          })
          .waitFor();
        await sweep("import-preview");
        await page.keyboard.press("Escape");
      }
      if (route === "/akun") {
        await page
          .getByRole("button", { name: "Tambah akun", exact: true })
          .click();
        await sweep("account-editor");
        await page.keyboard.press("Escape");
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
    await browser.close();
    browser = null;
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    `${results.length} management viewport/theme combinations passed.`,
  );
})()
  .catch(async (e) => {
    console.error(e);
    try {
      console.error(
        "Overflow diagnostics",
        await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter((e) => e.scrollWidth > e.clientWidth + 3)
            .slice(0, 12)
            .map((e) => ({
              className: e.className,
              clientWidth: e.clientWidth,
              scrollWidth: e.scrollWidth,
              overflow: getComputedStyle(e).overflowX,
            })),
        ),
      );
      await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
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
