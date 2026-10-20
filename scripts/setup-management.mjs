/** Deployment-owner-only bootstrap. Passwords never appear in terminal output. */
import { parseArgs } from "node:util";
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { hashPassword } from "../convex/authNode.js";
const { values } = parseArgs({
  options: {
    deployment: { type: "string" },
    demo: { type: "boolean", default: false },
    admin: { type: "string", default: "tiyouw" },
    manager: { type: "string", default: "marchaenta" },
    output: { type: "string", default: "out/credentials/management.json" },
  },
});
if (!values.deployment)
  throw Error(
    "Specify --deployment explicitly; production is never selected implicitly.",
  );
if (values.demo && !/:(preview|dev)\//.test(values.deployment))
  throw Error("--demo is limited to explicit dev/preview selectors.");
const output = resolve(values.output),
  privateRoot = resolve("out") + "\\";
if (!output.startsWith(privateRoot) && !output.startsWith(resolve("out") + "/"))
  throw Error("Credentials must be written inside gitignored out/.");
if (existsSync(output))
  throw Error(
    "Credential output exists. Choose another path; never overwrite recovery material.",
  );
const credentials = [];
for (const [index, username] of [values.admin, values.manager].entries()) {
  const password = randomBytes(20).toString("base64url"),
    recovery =
      index === 0
        ? Array.from({ length: 8 }, () => randomBytes(12).toString("hex"))
        : [];
  credentials.push({
    username,
    nama: index === 0 ? "Tiyouw" : "Marchaenta",
    password,
    recovery,
    passwordHash: await hashPassword(password),
    recoveryHashes: recovery.map((s) =>
      createHash("sha256").update(s).digest("hex"),
    ),
  });
}
const args = {
  demo: values.demo,
  users: credentials.map(
    ({ username, nama, passwordHash, recoveryHashes }) => ({
      username,
      nama,
      passwordHash,
      recoveryHashes,
    }),
  ),
};
const result = execFileSync(
  process.execPath,
  [
    "node_modules/convex/bin/main.js",
    "run",
    "migrate:initialize",
    JSON.stringify(args),
    "--deployment",
    values.deployment,
    "--codegen",
    "disable",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
if (/skipped:\s*true|"skipped":\s*true/.test(result)) {
  console.log("Already initialized; existing credentials are unchanged.");
  process.exit(0);
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    {
      deployment: values.deployment,
      demo: values.demo,
      users: credentials.map(
        ({ passwordHash, recoveryHashes, ...item }) => item,
      ),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(`Initialized. Private credentials: ${output}`);
