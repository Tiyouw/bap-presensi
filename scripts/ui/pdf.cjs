const { chromium, webkit } = require("playwright"),
  { spawn, execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
if (!fs.existsSync("out/management/documents/single-13.pdf"))
  execFileSync(process.execPath, ["scripts/test-documents-v2.mjs"], {
    stdio: "inherit",
  });
let server, browser, page;
const results = [],
  out = "out/management/pdf-viewer";
fs.mkdirSync(out, { recursive: true });
(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5188",
      "--strictPort",
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  server.stderr.on("data", (b) => (output += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5188/")).ok) break;
    } catch {}
    if (server.exitCode !== null) throw Error(output);
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    browser = await type.launch();
    page = await browser.newPage({ viewport: { width: 800, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5188/scripts/ui/pdf.html");
    const canvas = page.locator('canvas[data-rendered="true"]');
    await canvas.waitFor({ timeout: 45000 });
    const painted = () =>
      canvas.evaluate((c) => {
        const data = c
          .getContext("2d")
          .getImageData(0, 0, c.width, c.height).data;
        let dark = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i] < 160 && data[i + 1] < 160 && data[i + 2] < 160) dark++;
        return dark;
      });
    assert.ok((await painted()) > 500);
    await page.screenshot({ path: `${out}/${name}-page1.png`, fullPage: true });
    await page
      .getByRole("button", { name: "Berikutnya →", exact: true })
      .click();
    await canvas.waitFor();
    assert.equal(
      await page.getByLabel("Halaman PDF", { exact: true }).inputValue(),
      "2",
    );
    await page
      .getByText("Teks halaman untuk pembaca layar", { exact: true })
      .click();
    await page.getByText("Nama Demo 13", { exact: false }).waitFor();
    assert.ok((await painted()) > 500);
    await page.getByLabel("Halaman PDF", { exact: true }).fill("1");
    await page.getByLabel("Halaman PDF", { exact: true }).press("Enter");
    await canvas.waitFor();
    await page.setViewportSize({ width: 320, height: 844 });
    await canvas.waitFor();
    await page.getByLabel("Pembesaran PDF", { exact: true }).selectOption("2");
    await canvas.waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
    assert.ok((await painted()) > 500);
    assert.deepEqual(errors, []);
    results.push({
      browser: name,
      painted: true,
      pages: 2,
      pagination: true,
      textFallback: true,
      mobileZoom: true,
    });
    console.log(
      "OK",
      name,
      "actual PDF pixels, second page, accessible text, 320px zoom without overflow",
    );
    await browser.close();
    browser = null;
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
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
