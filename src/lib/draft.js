const VALID = new Set(["HADIR", "ALPHA", "SAKIT", "IZIN"]);
export const rosterData = peserta => peserta.map(({ id, nim, nama, golongan }) => ({ id, nim, nama, golongan }));
export const rosterKey = peserta => JSON.stringify(rosterData(peserta));
export function recoverableDraft(draft) {
  return Boolean(draft && Number.isFinite(draft.baseRevision) && draft.statuses &&
    !Array.isArray(draft.statuses) && Object.keys(draft.statuses).length &&
    Object.values(draft.statuses).every(status => VALID.has(status)));
}
export function reconcileDraft(draft, peserta, serverRows = []) {
  if (!recoverableDraft(draft)) return null;
  const server = new Map(serverRows.map(p => [p.pesertaId, p.status]));
  const oldRoster = new Map((Array.isArray(draft.roster) ? draft.roster : []).filter(p => p && typeof p.id === "string").map(p => [p.id, p]));
  const currentIds = new Set(peserta.map(p => p.id));
  const added = peserta.filter(p => !Object.hasOwn(draft.statuses, p.id)).map(p => p.id);
  const changed = peserta.filter(p => oldRoster.has(p.id) &&
    ["nim", "nama", "golongan"].some(k => oldRoster.get(p.id)[k] !== p[k])).map(p => p.id);
  const removed = Object.keys(draft.statuses).filter(id => !currentIds.has(id));
  const reviewIds = [...new Set([...(Array.isArray(draft.rosterReviewIds) ? draft.rosterReviewIds : []).filter(id => currentIds.has(id)), ...added, ...changed])];
  return {
    ...draft,
    statuses: Object.fromEntries(peserta.map(p => [p.id,
      Object.hasOwn(draft.statuses, p.id) ? draft.statuses[p.id] : VALID.has(server.get(p.id)) ? server.get(p.id) : "HADIR",
    ])),
    roster: rosterData(peserta),
    rosterReviewIds: reviewIds,
    needsRosterReview: Boolean(draft.needsRosterReview || added.length || changed.length || removed.length),
    rosterChanged: Boolean(added.length || changed.length || removed.length),
  };
}
