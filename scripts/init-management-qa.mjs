import { execFileSync } from "node:child_process";
import { hashPassword } from "../convex/authNode.js";
const deployment = "tiyouw-s-projects:yo-urconvex:dev/management-v2";
import { readFileSync } from "node:fs";
const passwordHash = await hashPassword(
  process.env.BAP_QA_PASSWORD ||
    JSON.parse(readFileSync("out/management/qa-credentials.json")).password,
);
const args = {
  demo: true,
  users: [
    {
      username: "admin.qa",
      nama: "Admin Demo",
      passwordHash,
      recoveryHashes: [],
    },
    {
      username: "marchaenta.qa",
      nama: "Marchaenta Demo",
      passwordHash,
      recoveryHashes: [],
    },
  ],
};
execFileSync(
  process.execPath,
  [
    "node_modules/convex/bin/main.js",
    "run",
    "migrate:initialize",
    JSON.stringify(args),
    "--deployment",
    deployment,
    "--codegen",
    "disable",
  ],
  { stdio: ["ignore", "pipe", "inherit"] },
);
console.log(
  "Synthetic QA deployment initialized (idempotent). No production data used.",
);
