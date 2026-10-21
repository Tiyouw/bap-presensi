import { parseArgs, stripVTControlCharacters } from "node:util";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const { values } = parseArgs({ options: { deployment: { type: "string" }, help: { type: "boolean" } } });
if (values.help) {
  console.log("node scripts/backfill-read-models.mjs --deployment TEAM:PROJECT:dev/NAME\nResume-safe internal backfill; never selects a deployment implicitly. Run after deploying the new schema/functions.");
  process.exit(0);
}
if (!values.deployment?.trim()) throw Error("Specify --deployment explicitly. No deployment has been selected.");
const phases = ["peserta", "pertemuan", "template", "bapDoc", "kelas"];
const hash = createHash("sha256").update(values.deployment).digest("hex").slice(0, 12);
const file = `out/audit/backfill-${hash}.json`;
mkdirSync("out/audit", { recursive: true });
const progress = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { deployment: values.deployment, phase: 0, cursor: null };
if (progress.deployment !== values.deployment) throw Error("Checkpoint deployment does not match.");
while (progress.phase < phases.length) {
  const phase = phases[progress.phase];
  const args = { phase, ...(progress.cursor ? { cursor: progress.cursor } : {}) };
  const raw = execFileSync(process.execPath, ["node_modules/convex/bin/main.js", "run", "maintenance:rebuildReadModels", JSON.stringify(args), "--deployment", values.deployment, "--codegen", "disable"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] });
  const result = JSON.parse(stripVTControlCharacters(raw).trim());
  if (typeof result.isDone !== "boolean" || (!result.isDone && !result.continueCursor)) throw Error("Unexpected backfill response; checkpoint unchanged.");
  progress.cursor = result.continueCursor;
  if (result.isDone) { progress.phase++; progress.cursor = null; }
  writeFileSync(file, JSON.stringify(progress, null, 2));
  console.log(`${phase}: ${result.count || 0} rows; ${result.isDone ? "complete" : "checkpoint saved"}`);
}
console.log("Read-model backfill complete. Source snapshots and archived files were preserved.");
