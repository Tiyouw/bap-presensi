import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { hashToken, requireSesi } from "./lib/auth.js";
import { safeUser } from "./lib/access.js";
export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    try {
      const s = await requireSesi(ctx, token, true);
      return { ...safeUser(s.user), kedaluwarsaPada: s.kedaluwarsaPada };
    } catch(error) {
      if(/TOKEN_|TANPA_TOKEN/.test(String(error.data||error.message)))return null;
      throw error;
    }
  },
});
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const digest = await hashToken(token);
    const s = await ctx.db
      .query("sesi")
      .withIndex("by_token", (q) => q.eq("token", digest))
      .unique();
    if (s) await ctx.db.delete(s._id);
  },
});
export const sessions = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await requireSesi(ctx, token, true);
    return (
      await ctx.db
        .query("sesi")
        .withIndex("by_pengguna", (q) => q.eq("penggunaId", s.user._id))
        .collect()
    )
      .filter((s) => s.kedaluwarsaPada > Date.now())
      .map((x) => ({
        id: x._id,
        label: x.label || "Browser",
        dibuatPada: x.dibuatPada,
        saatIni: x._id === s._id,
      }));
  },
});
export const revokeSession = mutation({
  args: { token: v.string(), id: v.id("sesi") },
  handler: async (ctx, { token, id }) => {
    const s = await requireSesi(ctx, token, true),
      target = await ctx.db.get(id);
    if (target?.penggunaId === s.user._id) await ctx.db.delete(id);
  },
});
