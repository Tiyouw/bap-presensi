import {text,validDate,TYPES,normalizeRoster,validateTemplate} from "./management.js";
export const BACKUP_FORMAT="bap-class-backup",BACKUP_VERSION=1;
export const IDENTITY_FIELDS=["nama","semester","tahunAkademik","tingkat","prodi","dosen","dosenId","asdos","asdosId","tempat","matkulNama","matkulKode"];
export function validateBackupFile(b){
 if(b?.format!==BACKUP_FORMAT||b.version!==BACKUP_VERSION||typeof b.source?.namespace!=="string"||typeof b.source?.kelasId!=="string"||!Array.isArray(b.participants)||b.participants.length>2000||!Array.isArray(b.meetings)||b.meetings.length>10000||!Array.isArray(b.versions)||b.versions.length>50000)throw Error("Format backup BAP tidak dikenali.");
 if(b.participants.some(p=>!p||typeof p.aktif!=="boolean"||["id","nim","nama","golongan"].some(k=>typeof p[k]!=="string"||p[k].length>200)))throw Error("Data peserta backup tidak valid.");
 for(const m of [...b.meetings,...b.versions]){const r=m?.version;if(typeof m?.sourceId!=="string"||!r||!Number.isInteger(r.revision)||["cancelled","legacyPartial","metadataVerified"].some(k=>typeof r[k]!=="boolean")||["tanggal","tempat","tipe","status"].some(k=>typeof r[k]!=="string")||!r.snapshot||!Array.isArray(r.snapshot.peserta)||r.snapshot.peserta.length>2000||!Array.isArray(r.statuses))throw Error("Data versi backup tidak valid.");}
 if(b.identity)b.identity=validateIdentity(b.identity);
 return b;
}
export const identityData=c=>Object.fromEntries(IDENTITY_FIELDS.map(k=>[k,String(c?.[k]??"")]));
export function validateIdentity(value){
 if(!value||IDENTITY_FIELDS.some(k=>typeof value[k]!=="string"))throw Error("BACKUP_IDENTITAS_TIDAK_VALID");
 const result=identityData(value);
 for(const k of IDENTITY_FIELDS)result[k]=text(result[k],k,k.endsWith("Id")||k==="tempat"?80:k==="matkulKode"||k==="tahunAkademik"?30:["semester","tingkat"].includes(k)?20:160,!k.endsWith("Id"));
 return result;
}
export function participantData(p){return{id:String(p.id||p._id),nim:p.nim,nama:p.nama,golongan:p.golongan,urut:p.urut,aktif:p.aktif!==false};}
export function versionData(r){return{revision:r.revision,nomor:r.nomor??null,tanggal:r.tanggal,tempat:r.tempat,tipe:r.tipe,status:r.status,cancelled:Boolean(r.cancelled),legacyPartial:Boolean(r.legacyPartial),metadataVerified:r.metadataVerified!==false,
 snapshot:{kelas:identityData(r.snapshot.kelas),template:r.snapshot.template,templateVersion:String(r.snapshot.templateVersion),peserta:r.snapshot.peserta.map(participantData),tanggal:r.tanggal,tempat:r.tempat},statuses:r.statuses.map(s=>({pesertaId:String(s.pesertaId),status:s.status})),
 provenance:{createdAt:r.createdAt??null,actor:r.actorName||null,action:r.action||"CURRENT",reason:r.reason||""}};}
// Imported metadata is untrusted. Whitelist academic fields; provenance never authorizes writes.
export function normalizeBackupSelection(b){
 if(b?.format!==BACKUP_FORMAT||b.version!==BACKUP_VERSION||typeof b.source?.namespace!=="string"||typeof b.source?.kelasId!=="string"||b.source.namespace.length>300||b.source.kelasId.length>200)throw Error("BACKUP_TIDAK_VALID");
 if(!Array.isArray(b.participants)||b.participants.length>2000)throw Error("BACKUP_PILIH_BAGIAN");
 const participants=b.participants.map(p=>{if(!p||typeof p.id!=="string"||!p.id||p.id.length>200||typeof p.aktif!=="boolean"||["nim","nama","golongan"].some(k=>typeof p[k]!=="string"))throw Error("BACKUP_TIDAK_VALID");const [row]=normalizeRoster([p]);return{...row,id:p.id,aktif:p.aktif,urut:Number.isInteger(p.urut)&&p.urut>0?p.urut:1};});
 if(new Set(participants.map(p=>p.id)).size!==participants.length||new Set(participants.map(p=>p.nim.toUpperCase())).size!==participants.length)throw Error("BACKUP_PESERTA_DOBEL");
 const result={format:BACKUP_FORMAT,version:BACKUP_VERSION,source:{namespace:b.source.namespace,kelasId:b.source.kelasId},participants};
 if(b.identity)result.identity=validateIdentity(b.identity);
 if(b.template)result.template=validateTemplate(b.template);
 if(b.meeting){
  const r=b.meeting.version;if(!r||["cancelled","legacyPartial","metadataVerified"].some(k=>typeof r[k]!=="boolean")||!Number.isInteger(r.revision)||r.revision<0)throw Error("BACKUP_TIDAK_VALID");if(r.legacyPartial||!r.metadataVerified)throw Error("REVISI_LAMA_PARSIAL");
  if(!Number.isInteger(r.nomor)||r.nomor<1||r.nomor>1000||!TYPES.includes(r.tipe)||!["KUNCI","TERBUKA"].includes(r.status))throw Error("BACKUP_TIDAK_VALID");
  validDate(r.tanggal);const tempat=text(r.tempat,"Ruang",80),ids=new Set();
  if(!Array.isArray(r.snapshot?.peserta)||r.snapshot.peserta.length>2000)throw Error("BACKUP_TIDAK_VALID");
  const peserta=r.snapshot.peserta.map(p=>{if(!p||typeof p.id!=="string"||!participants.some(x=>x.id===p.id)||ids.has(p.id))throw Error("BACKUP_PESERTA_ASING");if(["nim","nama","golongan"].some(k=>typeof p[k]!=="string"))throw Error("BACKUP_TIDAK_VALID");ids.add(p.id);const [row]=normalizeRoster([p]);return{...row,id:p.id,urut:Number.isInteger(p.urut)&&p.urut>0?p.urut:1};});
  if(!Array.isArray(r.statuses)||new Set(r.statuses.map(s=>s.pesertaId)).size!==r.statuses.length||r.statuses.some(s=>!ids.has(s.pesertaId)||!["HADIR","ALPHA","SAKIT","IZIN"].includes(s.status)))throw Error("PRESENSI_KOREKSI_TIDAK_LENGKAP");
  if(r.status==="KUNCI"&&r.tipe==="REGULER"&&(!ids.size||r.statuses.length!==ids.size))throw Error("PRESENSI_KOREKSI_TIDAK_LENGKAP");
  result.meeting={sourceId:text(b.meeting.sourceId,"Sesi sumber",200),version:{revision:Number.isInteger(r.revision)?r.revision:0,nomor:r.nomor,tanggal:r.tanggal,tempat,tipe:r.tipe,status:r.status,cancelled:Boolean(r.cancelled),snapshot:{kelas:validateIdentity(r.snapshot.kelas),template:validateTemplate(r.snapshot.template),templateVersion:String(r.snapshot.templateVersion).slice(0,200),peserta,tanggal:r.tanggal,tempat},statuses:r.statuses.map(s=>({pesertaId:s.pesertaId,status:s.status}))}};
 }
 return result;
}
// Quote all cells, retain Unicode, neutralize formulas even after whitespace/control chars.
export function csv(rows){return "\uFEFF"+rows.map(row=>row.map(value=>{let cell=String(value??"");if(/^[\s\u0000-\u001f]*[=+@-]/u.test(cell)||/^[\t\r\n]/u.test(cell))cell="'"+cell;return '"'+cell.replaceAll('"','""')+'"';}).join(",")).join("\r\n");}
