import { ConvexError } from "convex/values";
import { requireSesi } from "./auth.js";
export function safeUser(u) {
  return {
    id: u._id,
    username: u.username,
    nama: u.nama,
    peran: u.peran,
    aktif: u.aktif,
    wajibGanti: u.wajibGanti,
    kelasIds: u.kelasIds,
  };
}
export async function requireUser(ctx, token, allowPassword = false) {
  return (await requireSesi(ctx, token, allowPassword)).user;
}
export async function requireAdmin(ctx, token) {
  const user = await requireUser(ctx, token);
  if (user.peran !== "ADMIN") throw new ConvexError("AKSES_DITOLAK");
  return user;
}
export async function requireClass(
  ctx,
  token,
  kelasId,
  manage = false,
  write = false,
) {
  const user = await requireUser(ctx, token);
  const kelas = kelasId && (await ctx.db.get(kelasId));
  if (!kelas || (user.peran !== "ADMIN" && !user.kelasIds.includes(kelasId)))
    throw new ConvexError("AKSES_DITOLAK");
  if (manage && user.peran === "OPERATOR")
    throw new ConvexError("AKSES_DITOLAK");
  if (write && kelas.arsip) throw new ConvexError("KELAS_DIARSIPKAN");
  return { user, kelas };
}
export async function requireMeeting(ctx, token, id, write = false) {
  const meeting = await ctx.db.get(id);
  if (!meeting) throw new ConvexError("PERTEMUAN_TIDAK_ADA");
  const access = await requireClass(ctx, token, meeting.kelasId, false, write);
  if (write && access.kelas.draft) throw new ConvexError("KELAS_BELUM_AKTIF");
  return { ...access, meeting };
}
export async function audit(ctx, user, jenis, ringkas, kelasId, pertemuanId) {
  await ctx.db.insert("audit", {
    actorId: user._id,
    jenis,
    ringkas,
    pada: Date.now(),
    ...(kelasId ? { kelasId } : {}),
    ...(pertemuanId ? { pertemuanId } : {}),
  });
}
