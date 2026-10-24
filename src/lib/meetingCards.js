import { hariIni } from "./presensi.js";
import { parseDate } from "./calendarDate.js";

export function nextMeetingCard(meetings, additions, patches, tempat) {
  const ordered = [...meetings.filter(p => !p.cancelled).map(p => ({ ...p, ...patches[p.id] })), ...additions].sort((a,b) => a.nomor-b.nomor);
  const previous = ordered.at(-1);
  let tanggal = hariIni();
  if (previous) {
    if (!parseDate(previous.tanggal)) throw Error("Periksa tanggal kartu terakhir sebelum menambah pertemuan berikutnya.");
    const date = new Date(previous.tanggal + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + 7);
    tanggal = date.toISOString().slice(0,10);
    if (!parseDate(tanggal)) throw Error("Tanggal baru melewati batas kalender. Periksa tanggal kartu terakhir.");
  }
  return { key: crypto.randomUUID(), nomor: Math.max(0,...meetings.map(p=>p.nomor),...additions.map(p=>Number(p.nomor)||0))+1, tanggal, tempat: tempat || "", tipe: "REGULER" };
}

export function additionError(meetings, additions) {
  const numbers = new Set(meetings.filter(p=>!p.cancelled).map(p=>p.nomor));
  for (const row of additions) {
    if (!Number.isInteger(Number(row.nomor)) || +row.nomor < 1 || +row.nomor > 1000) return { key: row.key, field: "nomor", message: "Nomor pertemuan harus antara 1 dan 1000." };
    if (numbers.has(Number(row.nomor))) return { key: row.key, field: "nomor", message: `Nomor pertemuan ${row.nomor} sudah dipakai. Pilih nomor lain.` };
    numbers.add(Number(row.nomor));
    if (!parseDate(row.tanggal)) return { key: row.key, field: "tanggal", message: `Isi tanggal yang valid untuk pertemuan ${row.nomor}.` };
    if (!row.tempat.trim()) return { key: row.key, field: "tempat", message: `Isi ruang untuk pertemuan ${row.nomor}.` };
  }
  return null;
}
