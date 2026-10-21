/** Real backend integration. Runs ONLY on the isolated synthetic QA deployment. */
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import JSZip from "jszip";
import { PDFDocument, PDFDict, PDFName } from "pdf-lib";
const url = "https://doting-horse-423.convex.cloud",
  client = new ConvexHttpClient(url),
  password =
    process.env.BAP_QA_PASSWORD ||
    JSON.parse(readFileSync("out/management/qa-credentials.json")).password,
  out = "out/management";
mkdirSync(out, { recursive: true });
let count = 0;
const ok = (name) => {
  console.log("OK", name);
  count++;
};
const denied = async (fn) =>
  assert.rejects(fn, /AKSES_DITOLAK|TOKEN_|WAJIB_GANTI_PASSWORD/);
const admin = (
  await client.action(api.authNode.login, { username: "admin.qa", password })
).token;
const manager = (
  await client.action(api.authNode.login, {
    username: "marchaenta.qa",
    password,
  })
).token;
assert.equal(
  (await client.query(api.auth.me, { token: admin })).peran,
  "ADMIN",
);
await assert.rejects(
  client.action(api.authNode.login, { username: "not-a-user", password }),
  /PASSWORD_SALAH/,
);
ok("individual login; unknown account rejected");
const suffix = Date.now().toString(36),
  base = {
    nama: `QA ${suffix}`,
    matkulNama: `Matkul QA ${suffix}`,
    matkulKode: `QA${suffix}`,
    semester: "GENAP",
    tahunAkademik: "2026/2027",
    tingkat: "4",
    prodi: "Destinasi Pariwisata",
    dosen: "Dr. Éléonore Demo",
    dosenId: "NIDN-001",
    asdos: "Marchaenta Demo",
    asdosId: "ASD-01",
    tempat: "Lab QA",
  };
const a = await client.mutation(api.kelola.saveClass, {
  token: manager,
  data: base,
});
const b = await client.mutation(api.kelola.saveClass, {
  token: admin,
  data: {
    ...base,
    nama: `Kelas privat ${suffix}`,
    matkulNama: `Privat ${suffix}`,
  },
});
let detail = await client.query(api.kelola.detail, {
  token: manager,
  kelasId: a,
});
await denied(() =>
  client.query(api.kelola.detail, { token: manager, kelasId: b }),
);
assert.ok(
  !(
    await client.query(api.kelola.search, {
      token: manager,
      q: `Privat ${suffix}`,
      includeArsip: true,
    })
  ).length,
);
await denied(() => client.query(api.accounts.list, { token: manager }));
ok(
  "manager-created class assigned; forged class IDs and global search respect ACL",
);
const roster = [
  { nim: "00001", nama: "Alya QA, Satu", golongan: "X" },
  { nim: "00002", nama: "Bima QA", golongan: "Y" },
  { nim: "ALT000001", nama: "Citra QA", golongan: "X" },
];
await assert.rejects(
  client.mutation(api.kelola.importRoster, {
    token: manager,
    kelasId: a,
    baseRevision: detail.kelas.revision,
    source: "bad.csv",
    allowUpdate: false,
    rows: [roster[0], roster[0]],
  }),
  /duplikat/i,
);
await client.mutation(api.kelola.importRoster, {
  token: manager,
  kelasId: a,
  baseRevision: detail.kelas.revision,
  source: "qa.csv",
  allowUpdate: false,
  rows: roster,
});
detail = await client.query(api.kelola.detail, { token: manager, kelasId: a });
assert.equal(detail.peserta.length, 3);
assert.equal(detail.peserta[0].nim, "00001");
await assert.rejects(
  client.mutation(api.kelola.saveParticipant, {
    token: manager,
    kelasId: a,
    baseRevision: detail.kelas.revision - 1,
    data: roster[0],
  }),
  /KONFLIK_REVISI/,
);
const schedule = [
  { nomor: 1, tanggal: "2026-10-20", tempat: "Lab QA", tipe: "REGULER" },
  { nomor: 2, tanggal: "2026-10-27", tempat: "Lab QA", tipe: "REGULER" },
  { nomor: 3, tanggal: "2026-11-03", tempat: "Lab QA", tipe: "LIBUR" },
];
await client.mutation(api.kelola.saveSchedule, {
  token: manager,
  kelasId: a,
  baseRevision: detail.kelas.revision,
  rows: schedule,
});
await client.mutation(api.kelola.activate, { token: manager, kelasId: a });
detail = await client.query(api.kelola.detail, { token: manager, kelasId: a });
assert.equal(detail.kelas.draft, false);
ok(
  "atomic roster validation, leading-zero NIM, free groups, stale revision and practical week 1",
);
const p = detail.pertemuan.find((p) => p.nomor === 1),
  libur = detail.pertemuan.find((p) => p.nomor === 3),
  statuses = detail.peserta.map((p, i) => ({
    pesertaId: p.id,
    status: i === 0 ? "ALPHA" : i === 1 ? "IZIN" : "HADIR",
  }));
await assert.rejects(
  client.mutation(api.sesi.simpanDanKunci, {
    token: manager,
    pertemuanId: libur.id,
    baseRevision: 0,
    statuses,
  }),
  /TANPA_PRAKTIKUM/,
);
await assert.rejects(
  client.mutation(api.sesi.simpanDanKunci, {
    token: manager,
    pertemuanId: p.id,
    baseRevision: 0,
    statuses: statuses.slice(1),
  }),
  /PESERTA_KURANG/,
);
await client.mutation(api.sesi.simpanDanKunci, {
  token: manager,
  pertemuanId: p.id,
  baseRevision: 0,
  statuses,
});
await assert.rejects(
  client.mutation(api.sesi.simpanDanKunci, {
    token: manager,
    pertemuanId: p.id,
    baseRevision: 0,
    statuses,
  }),
  /KONFLIK_REVISI/,
);
const original = await client.query(api.sesi.detail, {
  token: manager,
  pertemuanId: p.id,
});
assert.equal(original.pertemuan.snapshot.peserta.length, 3);
detail = await client.query(api.kelola.detail, { token: manager, kelasId: a });
await client.mutation(api.kelola.saveClass, {
  token: manager,
  kelasId: a,
  baseRevision: detail.kelas.revision,
  data: { ...base, dosen: "Dosen Setelah Dikunci" },
});
detail = await client.query(api.kelola.detail, { token: manager, kelasId: a });
await client.mutation(api.kelola.saveParticipant, {
  token: manager,
  kelasId: a,
  id: detail.peserta[0].id,
  baseRevision: detail.kelas.revision,
  data: { ...roster[0], nama: "Nama Setelah Dikunci", aktif: false },
});
detail = await client.query(api.kelola.detail, { token: manager, kelasId: a });
await client.mutation(api.kelola.saveTemplate, {
  token: manager,
  kelasId: a,
  config: {
    ...detail.kelas.templateDraft,
    unit: "INSTITUSI SETELAH DIKUNCI",
    logo: `data:image/png;base64,${readFileSync("scripts/ui/logo-demo.png").toString("base64")}`,
  },
  publish: true,
  baseRevision: detail.kelas.revision,
});
const frozen = await client.query(api.sesi.detail, {
  token: manager,
  pertemuanId: p.id,
});
assert.deepEqual(frozen.pertemuan.snapshot, original.pertemuan.snapshot);
ok(
  "locked session freezes roster, names, lecturer, and template across later edits",
);
for (const format of ["docx", "pdf"]) {
  const result = await client.action(api.bapNode.generate, {
    token: manager,
    pertemuanId: p.id,
    format,
  });
  assert.equal(result.status, "READY");
  const noAuth = await fetch(result.url);
  assert.equal(noAuth.status, 403);
  const res = await fetch(result.url, {
    headers: { Authorization: `Bearer ${manager}` },
  });
  assert.equal(res.status, 200);
  const bytes = Buffer.from(await res.arrayBuffer());
  writeFileSync(`${out}/integration-${suffix}.${format}`, bytes);
  const repeat = await client.action(api.bapNode.generate, {
    token: manager,
    pertemuanId: p.id,
    format,
  });
  assert.equal(result.sha256, repeat.sha256);
  if (format === "docx") {
    const zip = await JSZip.loadAsync(bytes),
      xml = await zip.file("word/document.xml").async("string");
    assert.match(xml, /Éléonore/);
    assert.match(xml, /Alya QA/);
    assert.ok(!xml.includes("INSTITUSI SETELAH DIKUNCI"));
    assert.ok(!xml.includes("+++"));
  } else {
    assert.ok(bytes.subarray(0, 5).toString().startsWith("%PDF"));
    const pdf = await PDFDocument.load(bytes);
    assert.ok(
      pdf.context
        .enumerateIndirectObjects()
        .some(
          ([, obj]) =>
            obj instanceof PDFDict &&
            (obj.has(PDFName.of("FontFile2")) ||
              obj.has(PDFName.of("FontFile3"))),
        ),
      "font embedded",
    );
  }
}
ok(
  "Word/PDF from frozen snapshot, embedded font, authenticated downloads and idempotent generation",
);
const second = detail.pertemuan.find((x) => x.nomor === 2);
const current = await client.query(api.kelola.detail, {
  token: manager,
  kelasId: a,
});
await client.mutation(api.sesi.simpanDanKunci, {
  token: manager,
  pertemuanId: second.id,
  baseRevision: 0,
  statuses: current.peserta
    .filter((p) => p.aktif !== false)
    .map((p) => ({ pesertaId: p.id, status: "HADIR" })),
});
const pack = await client.action(api.bapNode.paketCetak, {
  token: manager,
  kelasId: a,
  format: "pdf",
  items: [
    { pertemuanId: p.id, revision: 1 },
    { pertemuanId: second.id, revision: 1 },
  ],
});
assert.ok(pack.pageCount >= 1);
writeFileSync(
  `${out}/integration-pack-${suffix}.pdf`,
  Buffer.from(pack.base64, "base64"),
);
await client.mutation(api.kelola.saveSchedule, {
  token: admin,
  kelasId: b,
  baseRevision: (
    await client.query(api.kelola.detail, { token: admin, kelasId: b })
  ).kelas.revision,
  rows: [schedule[0]],
});
const other = (
  await client.query(api.kelola.detail, { token: admin, kelasId: b })
).pertemuan[0];
await denied(() =>
  client.query(api.sesi.detail, { token: manager, pertemuanId: other.id }),
);
await assert.rejects(
  client.action(api.bapNode.paketCetak, {
    token: admin,
    kelasId: a,
    format: "pdf",
    items: [{ pertemuanId: other.id, revision: 0 }],
  }),
  /AKSES_DITOLAK/,
);
await client.mutation(api.sesi.bukaKunci, {
  expectedRevision: 1,
  token: manager,
  pertemuanId: p.id,
});
let correction = await client.query(api.sesi.detail, {
  token: manager,
  pertemuanId: p.id,
});
assert.equal(correction.peserta.length, 3);
await client.mutation(api.kelola.refreshSnapshot, {
  token: manager,
  pertemuanId: p.id,
  baseRevision: 1,
});
correction = await client.query(api.sesi.detail, {
  token: manager,
  pertemuanId: p.id,
});
assert.equal(correction.peserta.length, 2);
await client.mutation(api.sesi.simpanDanKunci, {
  token: manager,
  pertemuanId: p.id,
  baseRevision: correction.pertemuan.revision,
  statuses: correction.peserta.map((p) => ({
    pesertaId: p.id,
    status: "HADIR",
  })),
});
assert.ok(
  (await client.query(api.bap.history, { token: manager, kelasId: a })).some(
    (d) => d.revision === 1,
  ),
);
ok(
  "same-class PDF pack, cross-class pack denied, explicit roster refresh, old archive retained",
);
const copied = await client.mutation(api.kelola.saveClass, {
  token: manager,
  copyId: a,
  copyRoster: false,
  data: { nama: `Salinan kosong ${suffix}` },
});
const copiedData = await client.query(api.kelola.detail, {
  token: manager,
  kelasId: copied,
});
assert.equal(copiedData.peserta.length, 0);
assert.equal(copiedData.pertemuan.length, 0);
assert.equal(copiedData.kelas.draft, true);
assert.equal(copiedData.kelas.templateDraft.unit, "INSTITUSI SETELAH DIKUNCI");
const copiedRoster = await client.mutation(api.kelola.saveClass, {
  token: manager,
  copyId: a,
  copyRoster: true,
  data: { nama: `Salinan roster ${suffix}` },
});
assert.equal(
  (
    await client.query(api.kelola.detail, {
      token: manager,
      kelasId: copiedRoster,
    })
  ).peserta.length,
  2,
);
const scopedSearch = await client.query(api.kelola.search, {
  token: manager,
  q: "Bima QA",
  includeArsip: false,
  kelasId: a,
});
assert.ok(scopedSearch[0].path.includes(a));
const privateData = await client.query(api.kelola.detail, {
  token: admin,
  kelasId: b,
});
await client.mutation(api.kelola.importRoster, {
  token: admin,
  kelasId: b,
  baseRevision: privateData.kelas.revision,
  source: "private.csv",
  allowUpdate: false,
  rows: [{ nim: "PRIVATE001", nama: "Nama Privat Demo", golongan: "Z" }],
});
await client.mutation(api.kelola.activate, { token: admin, kelasId: b });
const privateRoster = (
  await client.query(api.kelola.detail, { token: admin, kelasId: b })
).peserta;
await client.mutation(api.sesi.simpanDanKunci, {
  token: admin,
  pertemuanId: other.id,
  baseRevision: 0,
  statuses: privateRoster.map((p) => ({ pesertaId: p.id, status: "HADIR" })),
});
const privateDoc = await client.action(api.bapNode.generate, {
  token: admin,
  pertemuanId: other.id,
  format: "pdf",
});
assert.equal(
  (
    await fetch(privateDoc.url, {
      headers: { Authorization: `Bearer ${manager}` },
    })
  ).status,
  403,
);
ok(
  "copy settings without roster by default, explicit active-roster copy, contextual search and cross-class HTTP download denial",
);
const operatorName = `operator.${suffix}`,
  operatorId = await client.action(api.authNode.createUser, {
    token: admin,
    username: operatorName,
    nama: "Operator QA",
    peran: "OPERATOR",
    password,
    kelasIds: [a],
  });
let op = (
  await client.action(api.authNode.login, { username: operatorName, password })
).token;
await denied(() => client.query(api.kelola.detail, { token: op, kelasId: a }));
await client.action(api.authNode.changePassword, {
  token: op,
  oldPassword: "",
  password: password + "x",
});
assert.equal(await client.query(api.auth.me, { token: op }), null);
op = (
  await client.action(api.authNode.login, {
    username: operatorName,
    password: password + "x",
  })
).token;
await client.query(api.kelola.detail, { token: op, kelasId: a });
await denied(() =>
  client.mutation(api.kelola.saveTemplate, {
    token: op,
    kelasId: a,
    config: current.kelas.templateDraft,
    publish: false,
    baseRevision: 0,
  }),
);
await client.mutation(api.accounts.update, {
  token: admin,
  id: operatorId,
  nama: "Operator QA",
  peran: "ADMIN",
  aktif: true,
  kelasIds: [],
});
assert.equal((await client.query(api.auth.me, { token: op })).peran, "ADMIN");
await client.query(api.accounts.list, { token: op });
await client.mutation(api.accounts.update, {
  token: admin,
  id: operatorId,
  nama: "Operator QA",
  peran: "OPERATOR",
  aktif: false,
  kelasIds: [a],
});
assert.equal(await client.query(api.auth.me, { token: op }), null);
const users = await client.query(api.accounts.list, { token: admin }),
  me = users.find((u) => u.username === "admin.qa");
await assert.rejects(
  client.mutation(api.accounts.update, {
    token: admin,
    id: me.id,
    nama: me.nama,
    peran: "PENGELOLA",
    aktif: true,
    kelasIds: me.kelasIds,
  }),
  /ADMIN_TERAKHIR/,
);
ok(
  "forced password change, session revocation, operator restrictions, immediate promotion, deactivation, last admin",
);
const codes = await client.action(api.authNode.recoveryCodes, { token: admin });
const recovered = (
  await client.action(api.authNode.login, {
    username: "admin.qa",
    password: codes[0],
    recovery: true,
  })
).token;
assert.ok((await client.query(api.auth.me, { token: recovered })).wajibGanti);
await assert.rejects(
  client.action(api.authNode.login, {
    username: "admin.qa",
    password: codes[0],
    recovery: true,
  }),
  /PASSWORD_SALAH/,
);
await client.action(api.authNode.changePassword, {
  token: recovered,
  password,
  oldPassword: "",
});
const freshAdmin = (
  await client.action(api.authNode.login, { username: "admin.qa", password })
).token;
await client.mutation(api.kelola.archive, {
  token: freshAdmin,
  kelasId: a,
  arsip: true,
});
await assert.rejects(
  client.mutation(api.sesi.bukaKunci, { token: manager, pertemuanId: p.id, expectedRevision: 2 }),
  /KELAS_DIARSIPKAN/,
);
await client.query(api.bap.history, { token: manager, kelasId: a });
await client.mutation(api.kelola.archive, {
  token: freshAdmin,
  kelasId: a,
  arsip: false,
});
ok(
  "one-time admin recovery, forced recovery password, archived class write protection and readable documents",
);
writeFileSync(
  `${out}/backend-results.json`,
  JSON.stringify(
    { passed: count, at: new Date().toISOString(), deployment: url },
    null,
    2,
  ),
);
console.log(`ALL ${count} REAL BACKEND GROUPS PASSED`);
