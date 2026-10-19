import { ConvexError } from "convex/values";

export const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "2026-09-28" -> "Senin / 28 September 2026". Hari DITURUNKAN dari tanggal. */
export function hariTanggal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const nama = `${HARI[dt.getUTCDay()]} / ${d} ${BULAN[m - 1]} ${y}`;
  return nama;
}

/** Token sesi wajib valid; query/mutation Convex defaultnya publik. */
export async function requireSesi(ctx, token) {
  if (!token) throw new ConvexError("TANPA_TOKEN");
  const sesi = await ctx.db
    .query("sesi")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!sesi) throw new ConvexError("TOKEN_TIDAK_DIKENAL");
  if (sesi.kedaluwarsaPada < Date.now()) throw new ConvexError("TOKEN_KEDALUWARSA");
  return sesi;
}

export const TEMPLATE_VERSION = "bap-template-1f-2026.10";
