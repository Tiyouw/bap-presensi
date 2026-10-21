// Progress belongs to this exact roster snapshot and attendance revision.
export function rosterPanggil(peserta) {
  return JSON.stringify(
    peserta.map(({ id, nim, nama, golongan }) => [id, nim, nama, golongan]),
  );
}

export function golonganPanggil(peserta) {
  const groups = new Map();
  for (const person of peserta) {
    const key = String(person.golongan ?? "");
    if (!groups.has(key))
      groups.set(key, {
        key,
        label: key ? `Golongan ${key}` : "Tanpa golongan",
        peserta: [],
      });
    groups.get(key).peserta.push(person);
  }
  return [...groups.values()];
}

export function progresPanggil(saved, peserta, revision) {
  const roster = rosterPanggil(peserta);
  const valid = saved?.roster === roster && saved?.revision === revision;
  const ids = new Set(peserta.map((p) => p.id));
  const groups = golonganPanggil(peserta);
  const selected =
    (valid && groups.find((g) => g.key === saved.groupKey)) ||
    (valid &&
      groups.find((g) => g.peserta.some((p) => p.id === saved.currentId))) ||
    groups[0];
  const positions = Object.fromEntries(
    groups.map((g) => {
      const stored =
        valid && Object.hasOwn(saved.positions || {}, g.key)
          ? saved.positions[g.key]
          : null;
      return [
        g.key,
        g.peserta.some((p) => p.id === stored) ? stored : g.peserta[0]?.id,
      ];
    }),
  );
  const currentId =
    valid && selected?.peserta.some((p) => p.id === saved.currentId)
      ? saved.currentId
      : selected
        ? positions[selected.key]
        : undefined;
  if (selected) positions[selected.key] = currentId;
  return {
    roster,
    revision,
    currentId,
    groupKey: selected?.key,
    positions,
    reviewedIds:
      valid && Array.isArray(saved.reviewedIds)
        ? [...new Set(saved.reviewedIds.filter((id) => ids.has(id)))]
        : [],
    started: valid && saved.started === true,
  };
}

export const STATUS_PANGGIL = ["HADIR", "ALPHA", "SAKIT", "IZIN"];
