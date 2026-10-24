const openMeeting=require("./meeting-card-ui.cjs");
const { chromium, webkit } = require("playwright"),
  { spawn } = require("child_process"),
  fs = require("fs"),
  assert = require("assert/strict"),
  XLSX = require("xlsx"),
  axe = require("axe-core"),
  resize = require("./text-resize.cjs");
const base = "http://127.0.0.1:5244",
  out = "out/setup-flow/ui",
  checks = [];
fs.mkdirSync(out, { recursive: true });
let server, browser, page;
const ok = (engine, test) => {
  checks.push({ engine, test, passed: true });
  console.log("PASS", engine, test);
};
async function drop(p, label, name, type, bytes) {
  const target = p
      .locator(".file-drop-field")
      .filter({ has: p.getByLabel(label, { exact: true }) })
      .locator(".file-drop"),
    dt = await p.evaluateHandle(
      ({ name, type, bytes }) => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(bytes)], name, { type }));
        return dt;
      },
      { name, type, bytes: [...Buffer.from(bytes)] },
    );
  await target.dispatchEvent("drop", { dataTransfer: dt });
  await dt.dispose();
}
(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "scripts/ui/vite.config.mjs",
      "--port",
      "5244",
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
      localStorage.setItem("bap.help.welcome.v1.qa-user", "1");
    });
    const p = (page = await c.newPage()),
      errors = [],
      native = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("dialog", async (d) => {
      native.push(d.type());
      await d.dismiss();
    });
    await p.goto(base + "/kelas/k1?tab=mahasiswa");
    await p.getByRole("heading", { name: "Mahasiswa", exact: true }).waitFor();
    assert.equal(await p.locator(".mg-roster-list .mg-list-row").count(), 10);
    await p
      .getByRole("button", {
        name: "Halaman mahasiswa berikutnya",
        exact: true,
      })
      .click();
    await p
      .getByRole("navigation", { name: "Halaman mahasiswa", exact: true })
      .getByText("11–20 dari 93", { exact: true })
      .waitFor();
    await p.getByLabel("Cari nama atau NIM", { exact: true }).fill("DEMO00093");
    assert.equal(await p.locator(".mg-roster-list .mg-list-row").count(), 1);
    await p.getByLabel("Cari nama atau NIM", { exact: true }).fill("");
    await p
      .getByLabel("Jumlah mahasiswa per halaman", { exact: true })
      .selectOption("25");
    assert.equal(await p.locator(".mg-roster-list .mg-list-row").count(), 25);
    ok(
      engine,
      "roster pagination bounds rows, resets with search, and supports page size",
    );
    await p.evaluate(() => window.__qa.enableControls());
    await p.evaluate(async () => {
      const { navigate } = await import("/src/lib/navigation.js");
      await navigate("/kelas/baru");
    });
    await p.getByLabel("Mata kuliah", { exact: true }).selectOption("m1");
    await p
      .getByLabel("Nama kelas", { exact: true })
      .fill("Kelas Persiapan Demo");
    await p
      .getByLabel("Dosen pengampu", { exact: true })
      .fill("Dosen Persiapan Demo");
    await p
      .getByRole("button", {
        name: "Simpan & lanjut ke Mahasiswa →",
        exact: true,
      })
      .click();
    await p.waitForURL(/tab=mahasiswa$/);
    await p.getByRole("heading", { name: "Mahasiswa", exact: true }).waitFor();
    const classId = new URL(p.url()).pathname.split("/")[2];
    assert.equal(
      await p
        .getByRole("button", { name: "Aktifkan kelas", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await p
        .getByRole("navigation", { name: "Bagian kelas", exact: true })
        .getByRole("link")
        .count(),
      5,
    );
    await p
      .getByRole("button", { name: "Impor Excel / CSV", exact: true })
      .click();
    const label = "File mahasiswa (maksimum 5 MB)";
    await drop(p, label, "wrong.txt", "text/plain", "bad");
    await p
      .getByRole("alert")
      .filter({ hasText: "Format file tidak sesuai" })
      .waitFor();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["NIM", "Nama", "Golongan"],
        ["00001", "Mahasiswa XLS Demo", "A"],
      ]),
      "Data",
    );
    await drop(
      p,
      label,
      "demo.xls",
      "application/vnd.ms-excel",
      XLSX.write(wb, { type: "buffer", bookType: "biff8" }),
    );
    await p
      .getByRole("dialog", { name: "Impor mahasiswa", exact: true })
      .getByText("Mahasiswa XLS Demo", { exact: true })
      .waitFor();
    await p.getByRole("dialog").getByText("00001", { exact: true }).waitFor();
    const csv =
      "NIM,Nama,Golongan\n" +
      Array.from(
        { length: 93 },
        (_, i) =>
          `QA${String(i + 1).padStart(5, "0")},Mahasiswa Impor Demo ${i + 1},A`,
      ).join("\n");
    await drop(p, label, "demo.csv", "text/csv", csv);
    await p
      .getByRole("button", {
        name: "Konfirmasi impor 93 mahasiswa",
        exact: true,
      })
      .click();
    await p
      .getByRole("dialog", { name: "Impor mahasiswa", exact: true })
      .waitFor({ state: "detached" });
    assert.equal(await p.locator(".mg-roster-list .mg-list-row").count(), 10);
    await p
      .getByRole("navigation", { name: "Halaman mahasiswa", exact: true })
      .getByText("1–10 dari 93", { exact: true })
      .waitFor();
    const next = p.getByRole("button", {
      name: "Lanjut ke Jadwal →",
      exact: true,
    });
    const box = await next.boundingBox();
    assert(
      box.y >= 0 && box.y + box.height <= 900,
      "next is visible above roster",
    );
    await p.screenshot({ path: `${out}/${engine}-students.png` });
    ok(
      engine,
      "drag/drop validates files, preserves XLS leading zeros, imports CSV and keeps next above a paginated roster",
    );
    await next.click();
    await p
      .getByRole("heading", { name: "Jadwal pertemuan", exact: true })
      .waitFor();
    assert.equal(await p.getByRole('status').filter({hasText:'93 mahasiswa diproses.'}).count(),0);
    assert.equal(
      await p.getByText("Geser jadwal terpilih", { exact: true }).count(),
      0,
    );
    assert.equal(
      await p
        .getByLabel("Pulihkan draf jadwal dari file", { exact: true })
        .isVisible(),
      false,
    );
    await p.locator('.schedule-empty').click();
    assert.equal(await p.locator('.schedule-card-toggle[aria-expanded="true"]').count(),0);
    await openMeeting(p,1);
    await p.getByLabel('Tanggal pertemuan baru 1',{exact:true}).fill('2026-02-30');
    await p.getByLabel('Ruang pertemuan baru 1',{exact:true}).focus();
    await p.getByRole('alert').filter({hasText:'Isi tanggal yang valid'}).waitFor();
    assert.equal(await p.getByRole('button',{name:'Simpan jadwal',exact:true}).getAttribute('aria-disabled'),'true');
    assert.equal(await p.evaluate(()=>window.__qa.calls.filter(c=>c.name==='meetingCommands:addMeeting').length),0);
    await p
      .getByRole("button", {
        name: "Pilih tanggal: Tanggal pertemuan baru 1",
        exact: true,
      })
      .click();
    const calendar = p.getByRole("dialog", {
      name: "Pilih tanggal · Tanggal pertemuan baru 1",
      exact: true,
    });
    await calendar
      .getByLabel("Bulan kalender", { exact: true })
      .selectOption("9");
    await calendar.getByLabel("Tahun kalender", { exact: true }).fill("2026");
    await calendar.locator('[data-calendar-date="2026-10-26"]').click();
    assert.equal(
      await p
        .getByLabel("Tanggal pertemuan baru 1", { exact: true })
        .inputValue(),
      "2026-10-26",
    );
    assert.equal(await p.locator("input[type=date]").count(), 0);
    await p.evaluate(() => window.__qa.setRequestDelay(700));
    await p
      .getByRole("button", { name: "Simpan jadwal", exact: true })
      .click();
    await p.getByRole("button",{name:"Menyimpan jadwal…",exact:true}).waitFor();
    await p.waitForFunction(()=>document.querySelectorAll(".schedule-card-shell.is-new").length===0);
    await openMeeting(p,1);
    await p.getByLabel("Tanggal pertemuan 1", { exact: true }).waitFor();
    await p
      .getByRole("button", { name: "Lanjut ke Template BAP →", exact: true })
      .waitFor({ state: "visible" });
    await p.screenshot({ path: `${out}/${engine}-schedule.png` });
    ok(
      engine,
      "new schedule starts with adding a meeting, has a custom calendar, and leads to Template rather than activation",
    );
    await p
      .getByLabel("Tanggal pertemuan 1", { exact: true })
      .fill("2026-10-27");
    await p
      .getByRole("button", { name: "Periksa tanggal & lanjut →", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "1 sesi akan berubah", exact: true })
      .waitFor();
    await p.waitForFunction(()=>{const heading=document.querySelector('[aria-label="Tinjau perubahan tanggal"] h3'),r=heading?.getBoundingClientRect();return r&&r.top>=64&&r.bottom<=innerHeight;});
    await p
      .getByRole("button", { name: "Simpan perubahan 1 sesi", exact: true })
      .click();
    await p.waitForURL(/tab=template$/);
    await p
      .getByRole("heading", {
        name: "Preview dokumen · 1 halaman",
        exact: true,
      })
      .waitFor();
    await p.locator('.mg-pdf-viewer canvas[data-rendered="true"]').waitFor();
    assert.equal(
      await p.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "kelola:saveTemplate")
            .length,
      ),
      0,
    );
    await p.getByText("Edit kop & identitas dokumen", { exact: true }).click();
    await p
      .getByLabel("Nama institusi", { exact: true })
      .fill("INSTITUSI PREVIEW DEMO");
    await p.getByText("Memperbarui preview…", { exact: true }).waitFor();
    const {DEFAULT_LOGO}=await import('../../bap-shared/assets/logo.js');await drop(p,'Logo PNG/JPEG (maksimum 350 KB)','logo-demo.png','',Buffer.from(DEFAULT_LOGO.split(',')[1],'base64'));await p.getByAltText('Logo yang dipilih',{exact:true}).waitFor();
    await p.waitForFunction(
      () =>
        window.__qa.calls.filter((c) => c.name === "bapNode:preview").at(-1)
          ?.args.config.unit === "INSTITUSI PREVIEW DEMO",
    );
    await p
      .getByRole("button", { name: "Simpan template & lanjut →", exact: true })
      .waitFor({ state: "visible" });
    await p.waitForFunction(
      () => document.querySelector('[form="setup-template"]').getAttribute('aria-disabled')==='false',
    );
    assert.equal(
      await p.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "kelola:saveTemplate")
            .length,
      ),
      0,
    );
    await p.screenshot({ path: `${out}/${engine}-template.png` });
    await p.evaluate(() => {
      document.getElementById("setup-template").requestSubmit();
      document.getElementById("setup-template").requestSubmit();
    });
    await p.getByText("Menyimpan template…", { exact: true }).waitFor();
    await p.waitForURL(/tab=review$/);
    assert.equal(
      await p.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "kelola:saveTemplate")
            .length,
      ),
      1,
    );
    await p
      .getByRole("heading", { name: "Tinjau persiapan kelas", exact: true })
      .waitFor();
    await p.getByText("Langkah 5 dari 5", { exact: true }).waitFor();
    await p.screenshot({ path: `${out}/${engine}-review.png` });
    ok(
      engine,
      "manual dates save before continuing; template preview refreshes without writes, save shows progress and advances once to review",
    );
    await p
      .getByRole("button", { name: "Aktifkan kelas", exact: true })
      .click();
    await p
      .getByRole("dialog", { name: "Aktifkan kelas?", exact: true })
      .getByRole("button", { name: "Ya, aktifkan", exact: true })
      .click();
    await p.waitForURL(/tab=pertemuan$/);
    await p.getByText("Kelas aktif", { exact: true }).waitFor();
    assert.equal(
      await p
        .getByRole("region", { name: "Persiapan kelas", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await p.evaluate(
        () =>
          window.__qa.calls.filter((c) => c.name === "kelola:saveClass").length,
      ),
      1,
    );
    ok(
      engine,
      "five-step setup ends with review and explicit activation, then opens attendance",
    );
    await p.evaluate(async (classId) => {
      const { navigate } = await import("/src/lib/navigation.js");
      await navigate(`/kelas/${classId}?tab=jadwal`);
    }, classId);
    await openMeeting(p,1);
    await p
      .getByRole("button", {
        name: "Pilih tanggal: Tanggal pertemuan 1",
        exact: true,
      })
      .click();
    const date = p.locator(".calendar-dialog");
    await date.locator('[data-calendar-focus="true"]').focus();
    await p.keyboard.press("ArrowRight");
    await p.waitForFunction(
      () =>
        document.activeElement.getAttribute("data-calendar-date") ===
        "2026-10-28",
    );
    await p.keyboard.press("Escape");
    assert.equal(
      await p.getByLabel("Tanggal pertemuan 1", { exact: true }).inputValue(),
      "2026-10-27",
    );
    ok(
      engine,
      "calendar keyboard moves through dates and Escape cancels without editing the date",
    );
    await p.evaluate(async()=>{const{navigate}=await import('/src/lib/navigation.js');await navigate('/kelas/k1?tab=template')});
    await p.locator('canvas[data-rendered="true"]').waitFor();
    const reads=await p.evaluate(()=>window.__qa.calls.filter(c=>c.name==='bapNode:preview').length);
    await p.evaluate(()=>window.__qa.controlAdvance('p3'));
    await p.waitForFunction(count=>window.__qa.calls.filter(c=>c.name==='bapNode:preview').length>count,reads);
    await p.getByText('Preview sesuai template tersimpan',{exact:true}).waitFor();
    await p.locator('canvas[data-rendered="true"]').waitFor();
    const saves=await p.evaluate(()=>window.__qa.calls.filter(c=>c.name==='kelola:saveTemplate').length);
    await p.getByRole('button',{name:'Muat data terbaru',exact:true}).click();
    await p.locator('.app-dialog').getByRole('button',{name:'Buang & muat terbaru',exact:true}).click();
    await p.locator('canvas[data-rendered="true"]').waitFor();
    assert.equal(await p.evaluate(()=>window.__qa.calls.filter(c=>c.name==='kelola:saveTemplate').length),saves);
    ok(engine,'external class revision refresh and explicit reload keep preview visible without template writes');
    await p.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const accessibility = await p.evaluate(() =>
      axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    assert.deepEqual(
      accessibility.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
      [],
    );
    for (const scheme of ["light", "dark"]) {
      await p.emulateMedia({ colorScheme: scheme });
      for (const width of [320, 390, 1280]) {
        await p.setViewportSize({ width, height: 900 });
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          engine + " overflow " + width,
        );
        await p.screenshot({ path: `${out}/${engine}-${scheme}-${width}.png` });
      }
    }
    await resize(p);
    await p.setViewportSize({ width: 320, height: 900 });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(native, []);
    assert.deepEqual(errors, []);
    ok(
      engine,
      "phone/desktop, light/dark, 200% text, automated accessibility and no native dialogs/runtime errors",
    );
    await c.close();
    await browser.close();
    browser = null;
  }
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ passed: true, checks }, null, 2),
  );
})()
  .catch(async (e) => {
    console.error(e);
    await page
      ?.screenshot({ path: `${out}/failure.png`, fullPage: true })
      .catch(() => {});
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
  });
