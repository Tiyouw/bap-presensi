"use node";
import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v, ConvexError } from "convex/values";
import {
  randomBytes,
  scrypt as rawScrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(rawScrypt);
const digest = (s) => createHash("sha256").update(s).digest("hex");
export async function hashPassword(password) {
  if (password.length < 12 || password.length > 128)
    throw new ConvexError("PASSWORD_MIN_12");
  const salt = randomBytes(16),
    value = await scrypt(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 3,
      maxmem: 128 * 1024 * 1024,
    });
  return `scrypt:32768:8:3:${salt.toString("hex")}:${value.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [algo, n, r, p, salt, value] = stored.split(":");
  if (algo !== "scrypt" || password.length > 128) return false;
  const expected = Buffer.from(value, "hex"),
    actual = await scrypt(password, Buffer.from(salt, "hex"), expected.length, {
      N: +n,
      r: +r,
      p: +p,
      maxmem: 128 * 1024 * 1024,
    });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const login = action({
  args: {
    username: v.string(),
    password: v.string(),
    recovery: v.optional(v.boolean()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const user = await ctx.runMutation(internal.accounts.prepareLogin, {
      username: a.username,
    });
    const recoveryHash = digest(a.password);
    const ok =
      user &&
      (a.recovery
        ? user.recoveryHashes.includes(recoveryHash)
        : await verifyPassword(a.password, user.passwordHash));
    if (!ok) throw new ConvexError("PASSWORD_SALAH");
    const token = randomBytes(32).toString("hex");
    await ctx.runMutation(internal.accounts.issue, {
      id: user.id,
      hash: user.passwordHash,
      tokenHash: digest(token),
      label: a.label || "Browser",
      ...(a.recovery ? { recoveryHash } : {}),
    });
    return { token };
  },
});
export const createUser = action({
  args: {
    token: v.string(),
    username: v.string(),
    nama: v.string(),
    peran: v.string(),
    password: v.string(),
    kelasIds: v.array(v.id("kelas")),
  },
  handler: async (ctx, a) => {
    const actor = await ctx.runQuery(internal.accounts.secret, {
      token: a.token,
    });
    if (actor.peran !== "ADMIN" || actor.wajibGanti)
      throw new ConvexError("AKSES_DITOLAK");
    const { password, ...rest } = a;
    return ctx.runMutation(internal.accounts.saveInternal, {
      ...rest,
      passwordHash: await hashPassword(password),
    });
  },
});
export const changePassword = action({
  args: {
    token: v.string(),
    password: v.string(),
    oldPassword: v.string(),
    id: v.optional(v.id("pengguna")),
  },
  handler: async (ctx, a) => {
    const actor = await ctx.runQuery(internal.accounts.secret, {
      token: a.token,
    });
    const own = !a.id || a.id === actor._id;
    if (
      own &&
      !actor.wajibGanti &&
      !(await verifyPassword(a.oldPassword, actor.passwordHash))
    )
      throw new ConvexError("PASSWORD_SALAH");
    if (!own && actor.peran !== "ADMIN") throw new ConvexError("AKSES_DITOLAK");
    await ctx.runMutation(internal.accounts.passwordInternal, {
      token: a.token,
      id: a.id || actor._id,
      hash: await hashPassword(a.password),
      ...(own ? { expectedHash: actor.passwordHash } : {}),
    });
  },
});
export const recoveryCodes = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const codes = Array.from({ length: 8 }, () =>
      randomBytes(12).toString("hex"),
    );
    await ctx.runMutation(internal.accounts.recoveryInternal, {
      token,
      hashes: codes.map(digest),
    });
    return codes;
  },
});
