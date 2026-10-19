"use node";

import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Verifikasi password pakai scrypt (butuh Node crypto -> action, bukan mutation).
 * Format env BAP_PASS_HASH:  scrypt:N:r:p:saltHex:hashHex
 * Buat dengan: node scripts/hash-password.mjs "password-baru"
 */
function cocok(password, disimpan) {
  const [algo, N, r, p, saltHex, hashHex] = disimpan.split(":");
  if (algo !== "scrypt") throw new Error("format BAP_PASS_HASH tidak dikenal");
  const harap = Buffer.from(hashHex, "hex");
  const dapat = scryptSync(password, Buffer.from(saltHex, "hex"), harap.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return harap.length === dapat.length && timingSafeEqual(harap, dapat);
}

export const login = action({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    const disimpan = process.env.BAP_PASS_HASH;
    if (!disimpan) throw new ConvexError("BAP_PASS_HASH belum diset di environment");
    if (!cocok(password, disimpan)) throw new ConvexError("PASSWORD_SALAH");

    const token = randomBytes(32).toString("hex");
    await ctx.runMutation(internal.auth.createSession, { token });
    return { token };
  },
});
