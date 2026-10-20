import { v, ConvexError } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
  mutation,
} from "./_generated/server.js";
import { requireAdmin, requireUser, safeUser, audit } from "./lib/access.js";
import { hashToken } from "./lib/auth.js";
import { ROLES, text } from "../bap-shared/management.js";
export const prepareLogin = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const key = username.toLowerCase().trim().slice(0, 80),
      now = Date.now();
    const attempt = await ctx.db
      .query("authAttempt")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (attempt && attempt.resetAt > now && attempt.count >= 8)
      throw new ConvexError("TERLALU_BANYAK_PERCOBAAN");
    const update = {
      key,
      count: attempt && attempt.resetAt > now ? attempt.count + 1 : 1,
      resetAt: attempt && attempt.resetAt > now ? attempt.resetAt : now + 60000,
    };
    if (attempt) await ctx.db.patch(attempt._id, update);
    else await ctx.db.insert("authAttempt", update);
    const user = await ctx.db
      .query("pengguna")
      .withIndex("by_username", (q) => q.eq("username", key))
      .unique();
    return user?.aktif
      ? {
          id: user._id,
          passwordHash: user.passwordHash,
          recoveryHashes: user.peran === "ADMIN" ? user.recoveryHashes : [],
        }
      : null;
  },
});
export const issue = internalMutation({
  args: {
    id: v.id("pengguna"),
    hash: v.string(),
    tokenHash: v.string(),
    label: v.string(),
    recoveryHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user?.aktif || user.passwordHash !== args.hash)
      throw new ConvexError("PASSWORD_SALAH");
    if (args.recoveryHash) {
      if (!user.recoveryHashes.includes(args.recoveryHash))
        throw new ConvexError("PASSWORD_SALAH");
      await ctx.db.patch(user._id, {
        recoveryHashes: user.recoveryHashes.filter(
          (h) => h !== args.recoveryHash,
        ),
        wajibGanti: true,
      });
    }
    const a = await ctx.db
      .query("authAttempt")
      .withIndex("by_key", (q) => q.eq("key", user.username))
      .unique();
    if (a) await ctx.db.delete(a._id);
    await ctx.db.insert("sesi", {
      token: args.tokenHash,
      penggunaId: user._id,
      label: args.label.slice(0, 100),
      dibuatPada: Date.now(),
      kedaluwarsaPada: Date.now() + 30 * 86400000,
    });
  },
});
export const secret = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => requireUser(ctx, token, true),
});
export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token);
    return (await ctx.db.query("pengguna").collect()).map(safeUser);
  },
});
export async function revokeAll(ctx, userId) {
  for (const s of await ctx.db
    .query("sesi")
    .withIndex("by_pengguna", (q) => q.eq("penggunaId", userId))
    .collect())
    await ctx.db.delete(s._id);
}
export const saveInternal = internalMutation({
  args: {
    token: v.string(),
    username: v.string(),
    nama: v.string(),
    peran: v.string(),
    passwordHash: v.string(),
    kelasIds: v.array(v.id("kelas")),
  },
  handler: async (ctx, a) => {
    const admin = await requireAdmin(ctx, a.token),
      username = text(a.username.toLowerCase(), "Username", 40);
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || !ROLES.includes(a.peran))
      throw new ConvexError("DATA_TIDAK_VALID");
    if (
      await ctx.db
        .query("pengguna")
        .withIndex("by_username", (q) => q.eq("username", username))
        .unique()
    )
      throw new ConvexError("USERNAME_SUDAH_ADA");
    for (const id of a.kelasIds)
      if (!(await ctx.db.get(id))) throw new ConvexError("KELAS_TIDAK_ADA");
    const id = await ctx.db.insert("pengguna", {
      username,
      nama: text(a.nama, "Nama"),
      peran: a.peran,
      passwordHash: a.passwordHash,
      kelasIds: a.kelasIds,
      aktif: true,
      wajibGanti: true,
      recoveryHashes: [],
      dibuatPada: Date.now(),
    });
    await audit(ctx, admin, "AKUN_BUAT", username);
    return id;
  },
});
export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("pengguna"),
    nama: v.string(),
    peran: v.string(),
    aktif: v.boolean(),
    kelasIds: v.array(v.id("kelas")),
  },
  handler: async (ctx, a) => {
    const admin = await requireAdmin(ctx, a.token),
      user = await ctx.db.get(a.id);
    if (!user || !ROLES.includes(a.peran))
      throw new ConvexError("DATA_TIDAK_VALID");
    if (
      user.peran === "ADMIN" &&
      user.aktif &&
      (a.peran !== "ADMIN" || !a.aktif)
    ) {
      const admins = (await ctx.db.query("pengguna").collect()).filter(
        (u) => u.aktif && u.peran === "ADMIN",
      );
      if (admins.length <= 1) throw new ConvexError("ADMIN_TERAKHIR");
    }
    for (const id of a.kelasIds)
      if (!(await ctx.db.get(id))) throw new ConvexError("KELAS_TIDAK_ADA");
    await ctx.db.patch(a.id, {
      nama: text(a.nama, "Nama"),
      peran: a.peran,
      aktif: a.aktif,
      kelasIds: a.kelasIds,
    });
    if (!a.aktif) await revokeAll(ctx, a.id);
    await audit(ctx, admin, "AKUN_UBAH", user.username);
  },
});
export const passwordInternal = internalMutation({
  args: {
    token: v.string(),
    id: v.id("pengguna"),
    hash: v.string(),
    expectedHash: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const actor = await requireUser(ctx, a.token, true),
      target = await ctx.db.get(a.id);
    if (
      !target ||
      (actor._id !== a.id && (actor.peran !== "ADMIN" || actor.wajibGanti))
    )
      throw new ConvexError("AKSES_DITOLAK");
    if (actor._id === a.id && target.passwordHash !== a.expectedHash)
      throw new ConvexError("KONFLIK_REVISI");
    await ctx.db.patch(a.id, {
      passwordHash: a.hash,
      wajibGanti: actor._id !== a.id,
    });
    await revokeAll(ctx, a.id);
    await audit(ctx, actor, "PASSWORD_UBAH", target.username);
  },
});
export const recoveryInternal = internalMutation({
  args: { token: v.string(), hashes: v.array(v.string()) },
  handler: async (ctx, { token, hashes }) => {
    const user = await requireAdmin(ctx, token);
    await ctx.db.patch(user._id, { recoveryHashes: hashes });
    await audit(ctx, user, "RECOVERY_BARU", "Kode lama dibatalkan");
  },
});
export const profile = mutation({
  args: { token: v.string(), nama: v.string() },
  handler: async (ctx, { token, nama }) => {
    const user = await requireUser(ctx, token);
    await ctx.db.patch(user._id, { nama: text(nama, "Nama") });
  },
});
