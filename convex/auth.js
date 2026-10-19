import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server.js";
import { requireSesi } from "./lib/auth.js";

const HARI_MS = 24 * 60 * 60 * 1000;
const UMUR_TOKEN_MS = 90 * HARI_MS; // PRD: token 90 hari, 1 akun

/** Dipanggil action login setelah password terbukti benar. */
export const createSession = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const now = Date.now();
    await ctx.db.insert("sesi", {
      token,
      dibuatPada: now,
      kedaluwarsaPada: now + UMUR_TOKEN_MS,
    });
    return { ok: true };
  },
});

/** Frontend memakai ini untuk memvalidasi token tersimpan saat app dibuka. */
export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesi = await requireSesi(ctx, token);
    return { ok: true, kedaluwarsaPada: sesi.kedaluwarsaPada };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesi = await ctx.db
      .query("sesi")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (sesi) await ctx.db.delete(sesi._id);
    return { ok: true };
  },
});
