import { ConvexError, getConvexSize } from "convex/values";

// Leave room for the meeting/document fields and Convex system fields (1 MiB).
export const MAX_SNAPSHOT_BYTES = 1_000_000;
export function assertSnapshotSize(snapshot) {
  const bytes = getConvexSize(snapshot);
  if (bytes > MAX_SNAPSHOT_BYTES)
    throw new ConvexError({
      code: "SNAPSHOT_TERLALU_BESAR",
      message: "Data sesi terlalu besar untuk dikunci. Kurangi ukuran logo atau bagi peserta ke kelas lain. Presensi dan draf belum diubah.",
      bytes,
      maximum: MAX_SNAPSHOT_BYTES,
    });
  return snapshot;
}
