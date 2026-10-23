/** Full UI against the isolated, synthetic Convex QA deployment (never production). */
const { chromium, webkit } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const results = [],
  out = "out/management/ui";
fs.mkdirSync(out, { recursive: true });
let server,
  browser,
  page,
  serverOutput = "";
const password =
  process.env.BAP_QA_PASSWORD ||
  JSON.parse(fs.readFileSync("out/management/qa-credentials.json")).password;
const ok = (browser, name) => {
  results.push({ browser, name, passed: true });
  console.log("OK", browser, name);
};
async function login(p, username = "admin.qa", pw = password) {
  await p.goto("http://127.0.0.1:5187/");
  await p.getByLabel("Username", { exact: true }).fill(username);
  await p.getByLabel("Password", { exact: true }).fill(pw);
  await p.getByRole("button", { name: "Masuk ke aplikasi" }).click();
}
async function noOverflow(p) {
  assert.ok(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "horizontal viewport overflow",
  );
}
(async () => {
  const { ConvexHttpClient } = await import("convex/browser"),
    { api } = await import("../../convex/_generated/api.js");
  const { prefixedRosterFile } = await import("../xlsx-fixture.mjs");
  const backend = new ConvexHttpClient("https://doting-horse-423.convex.cloud");
  const token = (
    await backend.action(api.authNode.login, { username: "admin.qa", password })
  ).token;
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5187",
      "--strictPort",
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  server.stderr.on("data", (b) => (output += b));
  server.stdout.on("data", (b) => (serverOutput += String(b)));
  server.stderr.on("data", (b) => (serverOutput += String(b)));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5187/")).ok) break;
    } catch {}
    if (server.exitCode !== null) throw Error(output);
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    browser = await type.launch();
    const errors = [];
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "dark",
      acceptDownloads: true,
      reducedMotion: "reduce",
    });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page);
    await page
      .getByRole("heading", { name: "Siap untuk kelas berikutnya." })
      .waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Lewati", exact: true }).click();
    ok(name, "individual login, loading transition, skippable onboarding");
    await page.keyboard.press("Control+k");
    await page
      .getByRole("combobox", { name: "Cari matkul, mahasiswa, atau fitur" })
      .fill("template PPB");
    await page.getByRole("option").first().waitFor();
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: "Template BAP", exact: true })
      .waitFor();
    assert.ok(page.url().includes("tab=template"));
    await page
      .getByRole("link", { name: "BAP Praktikum — Beranda", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Siap untuk kelas berikutnya." })
      .waitFor();
    ok(
      name,
      "global feature search opens a class template directly from the dashboard",
    );
    const suffix = Date.now().toString(36);
    await page
      .getByRole("button", { name: "Tambah kelas", exact: false })
      .first()
      .click();
    for (const [label, value] of Object.entries({
      "Nama mata kuliah": `Desain Pariwisata ${suffix}`,
      "Kode mata kuliah": `DP${suffix}`,
      "Nama kelas": "Kelas UI Demo",
      "Dosen pengampu": "Dr. Éléonore Demo",
    }))
      await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Simpan & lanjutkan" }).click();
    await page
      .getByRole("heading", { name: "Mahasiswa", exact: true })
      .waitFor();
    const classId = new URL(page.url()).pathname.split("/")[2];
    await page.reload();
    await page
      .getByRole("heading", { name: "Mahasiswa", exact: true })
      .waitFor();
    ok(name, "new course/class wizard saved as resumable draft");
    await page.getByRole("button", { name: "Impor Excel / CSV" }).click();
    await page.getByLabel("File mahasiswa (maksimum 5 MB)").setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "NIM,Nama,Golongan\n00001,Alya Demo,X\n00001,Bima Demo,Y",
      ),
    });
    await page.getByText("NIM duplikat dalam file", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: /Konfirmasi impor/ }).isDisabled(),
      true,
    );
    await page.getByLabel("File mahasiswa (maksimum 5 MB)").setInputFiles({
      name: "mahasiswa.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await prefixedRosterFile()),
    });
    await page
      .getByRole("button", { name: "Konfirmasi impor 3 mahasiswa" })
      .click();
    await page.getByText("00001 · Gol. X", { exact: true }).waitFor();
    await page.getByText("00003 · Gol. X", { exact: true }).waitFor();
    ok(
      name,
      "CSV duplicate guard and prefixed XLSX mapping/preview/import; leading-zero NIM retained",
    );
    await page.getByRole("link", { name: "Jadwal", exact: true }).click();
    await page.getByLabel("Tanggal mulai", { exact: true }).fill("2026-10-20");
    await page.getByLabel("Jumlah minggu", { exact: true }).fill("3");
    await page.getByLabel("Pola awal", { exact: true }).selectOption("REGULER");
    await page.getByRole("button", { name: "Buat preview jadwal" }).click();
    await page.getByRole("button", { name: "Periksa & simpan jadwal" }).click();
    await page.getByRole("button", { name: "Ya, simpan jadwal" }).click();
    await page.getByText("Jadwal tersimpan.", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Template BAP", exact: true }).click();
    await page
      .getByLabel("Jurusan (opsional)", { exact: true })
      .fill("JURUSAN CONTOH");
    await page
      .getByLabel("Email / situs (opsional)", { exact: true })
      .fill("Email: contoh@example.test");
    await page
      .getByRole("button", { name: "Gunakan format resmi", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Jurusan (opsional)", { exact: true }).inputValue(),
      "JURUSAN BAHASA KOMUNIKASI DAN PARIWISATA",
    );
    assert.equal(
      await page.getByLabel("Label dosen", { exact: true }).inputValue(),
      "",
    );
    await page
      .getByLabel("Nama institusi", { exact: true })
      .fill("POLITEKNIK DEMO");
    await page.getByRole("button", { name: "Simpan & preview PDF" }).click();
    await page
      .getByRole("heading", { name: /Preview dokumen/ })
      .waitFor({ timeout: 30000 });
    const pdfCanvas = page.locator('canvas[data-rendered="true"]').first();
    await pdfCanvas.waitFor({ timeout: 30000 });
    await page
      .getByText(/JURUSAN BAHASA KOMUNIKASI DAN PARIWISATA/)
      .last()
      .waitFor({ state: "attached" });
    await page
      .getByText(/Email: politeknik@polije.ac.id/)
      .last()
      .waitFor({ state: "attached" });
    assert.ok(
      await pdfCanvas.evaluate((canvas) => {
        const ctx = canvas.getContext("2d");
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let dark = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i] < 160 && data[i + 1] < 160 && data[i + 2] < 160) dark++;
        return dark > 500;
      }),
    );
    await page.screenshot({
      path: `${out}/${name}-template.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Terbitkan versi baru" }).click();
    await page.getByRole("button", { name: "Ya, terbitkan" }).click();
    await page.getByText("Template diterbitkan.", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Periksa & aktifkan", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ya, aktifkan", exact: true })
      .click();
    await page.getByRole("link", { name: "Pertemuan", exact: true }).click();
    await page
      .getByRole("button", { name: "Buka presensi", exact: true })
      .click();
    await page.locator(".student-row").last().waitFor();
    ok(
      name,
      "custom practical week 1, template actual PDF preview/publish, draft activation",
    );
    await page.getByRole("button", { name: /^Mode Panggil/ }).click();
    await page
      .getByLabel("Keluar otomatis 3 detik setelah golongan selesai")
      .uncheck();
    await page.locator(".call-start").click();
    await page.getByLabel("Lanjut otomatis").uncheck();
    for (const [group, count] of [
      ["X", 2],
      ["Y", 1],
    ]) {
      for (let i = 0; i < count; i++) {
        await page.getByRole("button", { name: /Hadir 1/ }).click();
        await page
          .getByRole("button", {
            name: i === count - 1 ? /Selesaikan golongan/ : /Selanjutnya/,
          })
          .click();
      }
      await page
        .getByText(`Golongan ${group} selesai.`, { exact: true })
        .waitFor();
      if (group === "X")
        await page
          .getByRole("button", { name: "Lanjut ke golongan Y", exact: true })
          .click();
    }
    await page
      .getByRole("button", {
        name: "Periksa presensi seluruh kelas",
        exact: true,
      })
      .click();
    await page.getByRole("dialog", { name: "Periksa presensi" }).waitFor();
    await page.keyboard.press("Escape");
    ok(
      name,
      "Mode Panggil uses the real QA class roster and completes into the existing review without auto-lock",
    );
    await page.locator(".student-row").first().click();
    await page
      .getByRole("button", { name: "Urungkan", exact: true })
      .first()
      .click();
    assert.equal(
      await page
        .locator(".student-row")
        .first()
        .locator(".status-badge")
        .innerText(),
      "Hadir",
    );
    await page.locator(".student-row").first().click();
    await page.reload();
    await page.locator(".student-row").last().waitFor();
    assert.equal(
      await page
        .locator(".student-row")
        .first()
        .locator(".status-badge")
        .innerText(),
      "Alpha",
    );
    await page.context().setOffline(true);
    await page.locator(".student-row").nth(1).click();
    await page
      .getByRole("button", { name: "Simpan & Kunci", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Simpan & Kunci", exact: true })
        .isDisabled(),
      true,
    );
    await page.context().setOffline(false);
    await page
      .getByRole("button", { name: "Simpan & Kunci", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        !document.querySelector(".sticky-footer button.button--primary")
          ?.disabled,
    );
    await page
      .getByRole("button", { name: "Simpan & Kunci", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("button", { name: "Kunci sekarang", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Unduh BAP (.docx)", exact: true })
      .waitFor({ timeout: 45000 });
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Unduh BAP (.docx)", exact: true })
      .click();
    assert.ok((await download).suggestedFilename().endsWith(".docx"));
    await page
      .getByRole("button", { name: "Siapkan cetak", exact: false })
      .first()
      .click();
    await page.getByRole("button", { name: "Buat preview paket PDF" }).click();
    await page
      .getByRole("heading", { name: /Preview paket ·/ })
      .waitFor({ timeout: 30000 });
    await page
      .locator('canvas[data-rendered="true"]')
      .waitFor({ timeout: 30000 });
    await page.keyboard.press("Escape");
    ok(
      name,
      "undo, persisted offline draft, atomic review/lock, real Word download and PDF print preview",
    );
    await page.keyboard.press("Meta+k");
    await page
      .getByRole("combobox", { name: "Cari matkul, mahasiswa, atau fitur" })
      .fill("Alya");
    await page
      .getByRole("option")
      .filter({ hasText: `00001 · Desain Pariwisata ${suffix}` })
      .first()
      .waitFor();
    const resultIndex = Number(
      (
        await page
          .getByRole("option")
          .filter({ hasText: `00001 · Desain Pariwisata ${suffix}` })
          .first()
          .getAttribute("id")
      )
        .split("-")
        .at(-1),
    );
    for (let i = 0; i < resultIndex; i++)
      await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: "Mahasiswa", exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Cari nama atau NIM", { exact: true }).inputValue(),
      "00001",
    );
    await page.keyboard.press("Control+k");
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.goBack();
    await page.locator(".student-row").last().waitFor();
    ok(
      name,
      "Cmd+K/Ctrl+K, keyboard result selection, deep link and browser Back",
    );
    for (const width of [320, 390, 768, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        await noOverflow(page);
        await page.screenshot({
          path: `${out}/${name}-attendance-${width}-${theme}.png`,
        });
      }
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await noOverflow(page);
    await page.evaluate(() => (document.documentElement.style.fontSize = ""));
    ok(
      name,
      "320/390/768/1280, both themes, reduced motion and 200% text sizing",
    );
    await page.goto(`http://127.0.0.1:5187/kelas/${classId}?tab=pengaturan`);
    await page
      .getByLabel("Dosen pengampu", { exact: true })
      .fill("Dosen Draf Lokal");
    const beforeExternal = await backend.query(api.kelola.detail, {
      token,
      kelasId: classId,
    });
    await backend.mutation(api.kelola.saveClass, {
      token,
      kelasId: classId,
      baseRevision: beforeExternal.kelas.revision,
      data: { ...beforeExternal.kelas, dosen: "Dosen Perangkat Lain" },
    });
    await page
      .getByText("Data kelas berubah sejak editor dibuka.", { exact: false })
      .waitFor();
    await page
      .getByRole("button", { name: "Simpan pengaturan", exact: true })
      .click();
    await page
      .getByText("Data sudah berubah di perangkat lain.", { exact: false })
      .waitFor();
    assert.equal(
      await page.getByLabel("Dosen pengampu", { exact: true }).inputValue(),
      "Dosen Draf Lokal",
    );
    assert.equal(
      (await backend.query(api.kelola.detail, { token, kelasId: classId }))
        .kelas.dosen,
      "Dosen Perangkat Lain",
    );
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Muat data terbaru", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Dosen pengampu", { exact: true }).inputValue(),
      "Dosen Perangkat Lain",
    );
    ok(
      name,
      "reactive updates preserve editor revision and explicit reload recovers",
    );
    await page.getByRole("link", { name: "Akun & akses", exact: true }).click();
    await page
      .getByRole("button", { name: "Tambah akun", exact: true })
      .click();
    await page.getByLabel("Username", { exact: true }).fill(`op.${suffix}`);
    await page.getByLabel("Nama", { exact: true }).fill("Operator Demo");
    await page.getByLabel("Password sementara", { exact: true }).fill(password);
    await page
      .getByRole("checkbox", { name: new RegExp(`DP${suffix}`) })
      .check();
    await page
      .getByRole("button", { name: "Simpan akun", exact: true })
      .click();
    await page.getByText(`op.${suffix} · OPERATOR`, { exact: false }).waitFor();
    ok(
      name,
      "admin creates an operator account and assigns a class through the UI",
    );
    await page.getByRole("button", { name: "Menu akun", exact: true }).click();
    await page.getByRole("button", { name: "Keluar", exact: true }).click();
    await page
      .getByRole("heading", { name: "Keluar dari aplikasi?" })
      .waitFor();
    await page.getByRole("button", { name: "Batal", exact: true }).click();
    await page.getByRole("button", { name: "Menu akun", exact: true }).click();
    await page.getByRole("button", { name: "Keluar", exact: true }).click();
    await page.getByRole("button", { name: "Ya, keluar" }).click();
    await page.getByLabel("Username", { exact: true }).waitFor();

    await login(page, `op.${suffix}`);
    await page.getByRole("heading", { name: "Amankan akunmu." }).waitFor();
    await page
      .getByLabel("Password baru", { exact: true })
      .fill(password + "x");
    await page
      .getByLabel("Ulangi password baru", { exact: true })
      .fill(password + "x");
    await page
      .getByRole("button", { name: "Simpan password", exact: true })
      .click();
    await page.getByLabel("Username", { exact: true }).waitFor();
    await login(page, `op.${suffix}`, password + "x");
    await page
      .getByRole("heading", { name: "Siap untuk kelas berikutnya." })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Tambah kelas" }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("link", { name: "Akun & akses" }).count(),
      0,
    );
    ok(
      name,
      "logout confirmation, forced password replacement, operator menu respects role",
    );
    assert.deepEqual(errors, []);
    await context.close();
    await browser.close();
    browser = null;
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(`${results.length} real-backend UI groups passed.`);
})()
  .catch(async (e) => {
    console.error(e);
    console.error("Vite output:", serverOutput.slice(-2000));
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
