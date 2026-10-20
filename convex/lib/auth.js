import { ConvexError } from "convex/values";

export const HARI = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
export const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** "2026-09-28" -> "Senin / 28 September 2026". Hari DITURUNKAN dari tanggal. */
export function hariTanggal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const nama = `${HARI[dt.getUTCDay()]} / ${d} ${BULAN[m - 1]} ${y}`;
  return nama;
}

/** Token sesi wajib valid; query/mutation Convex defaultnya publik. */
export async function hashToken(token) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function requireSesi(ctx, token, allowPassword = false) {
  if (!token) throw new ConvexError("TANPA_TOKEN");
  const awaitToken = await hashToken(token);
  const sesi = await ctx.db
    .query("sesi")
    .withIndex("by_token", (q) => q.eq("token", awaitToken))
    .unique();
  if (!sesi?.penggunaId) throw new ConvexError("TOKEN_TIDAK_DIKENAL");
  if (sesi.kedaluwarsaPada < Date.now())
    throw new ConvexError("TOKEN_KEDALUWARSA");
  const user = await ctx.db.get(sesi.penggunaId);
  if (!user?.aktif) throw new ConvexError("TOKEN_TIDAK_DIKENAL");
  if (user.wajibGanti && !allowPassword)
    throw new ConvexError("WAJIB_GANTI_PASSWORD");
  return { ...sesi, user };
}

export const TEMPLATE_VERSION = "bap-template-1f-2026.10";
