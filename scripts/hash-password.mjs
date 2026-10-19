/**
 * Buat hash password untuk env BAP_PASS_HASH (Convex dashboard -> Settings -> Env).
 *   node scripts/hash-password.mjs "password-rahasia"
 * Hasilnya satu baris: scrypt:N:r:p:saltHex:hashHex
 */
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('pakai: node scripts/hash-password.mjs "password"');
  process.exit(1);
}

const N = 16384;
const r = 8;
const p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, { N, r, p });

console.log(`scrypt:${N}:${r}:${p}:${salt.toString("hex")}:${hash.toString("hex")}`);
