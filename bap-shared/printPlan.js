export const MAX_PRINT_MEETINGS = 13;

export function jumlahForm(jumlahAbsen) {
  return Math.max(1, Math.ceil(jumlahAbsen / 12));
}

/** A continuation occupies a complete slot, before the next meeting starts. */
export function susunPaket(pertemuan) {
  const forms = [...pertemuan]
    .sort((a, b) => a.nomor - b.nomor)
    .flatMap((p) =>
      Array.from({ length: jumlahForm(p.jumlahAbsen) }, (_, i) => ({
        pertemuanId: p.id,
        nomor: p.nomor,
        tanggal: p.tanggal,
        revision: p.revision,
        lanjutan: i > 0,
        formKe: i + 1,
      })),
    );
  return Array.from({ length: Math.ceil(forms.length / 2) }, (_, i) =>
    forms.slice(i * 2, i * 2 + 2),
  );
}
