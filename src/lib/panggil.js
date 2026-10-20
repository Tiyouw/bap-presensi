// Progress belongs to this exact roster snapshot and attendance revision.
export function rosterPanggil(peserta) {
  return JSON.stringify(
    peserta.map(({ id, nim, nama, golongan }) => [id, nim, nama, golongan]),
  );
}

export function progresPanggil(saved, peserta, revision) {
  const roster = rosterPanggil(peserta);
  const valid = saved?.roster === roster && saved?.revision === revision;
  const ids = new Set(peserta.map((p) => p.id));
  return {
    roster,
    revision,
    currentId:
      valid && ids.has(saved.currentId) ? saved.currentId : peserta[0]?.id,
    reviewedIds:
      valid && Array.isArray(saved.reviewedIds)
        ? [...new Set(saved.reviewedIds.filter((id) => ids.has(id)))]
        : [],
    started: valid && saved.started === true,
  };
}

export const STATUS_PANGGIL = ["HADIR", "ALPHA", "SAKIT", "IZIN"];
