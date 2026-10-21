export const CAPABILITIES=["schedule","roster","identity","template","lifecycle","export","history","delegate"];
export const CAPABILITY_LABELS={schedule:"Ubah jadwal",roster:"Kelola peserta",identity:"Ubah identitas",template:"Kelola template",lifecycle:"Batalkan dan pulihkan",export:"Ekspor dan restore data",history:"Koreksi sesi bersejarah",delegate:"Atur izin Operator"};
export const SNAPSHOT_CATEGORIES=["identity","roster","template"];
export const MEETING_FIELDS=["nomor","tanggal","tempat","tipe"];
export const meetingHadAttendance=p=>p.status==="KUNCI"||Boolean(p.dikunciPada)||p.jumlahTercatat>0|| (p.hasAttendanceHistory!==undefined?Boolean(p.hasAttendanceHistory):Boolean(p.hasSnapshot||p.snapshot));
