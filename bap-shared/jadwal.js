/** Minggu 1 hanya teori. Berlaku juga untuk record/cache seed lama bertipe REGULER.
 * Nomor minggu, ID, tanggal, revisi, dan arsip lama tetap dipertahankan.
 */
export function tipePertemuan(pertemuan) {
  return !pertemuan.kelasId && pertemuan.nomor === 1 ? "TEORI" : pertemuan.tipe;
}

export function adaPraktikum(pertemuan) {
  return !pertemuan.cancelled && tipePertemuan(pertemuan) === "REGULER";
}
