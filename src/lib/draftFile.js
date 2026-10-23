import {validCorrectionDraft} from "./correctionDraft.js";
export function validScheduleDraft(d){
 if(!d||d.version!==1||!Number.isInteger(d.base)||d.base<0||!Array.isArray(d.selected)||d.selected.length>200||typeof d.reason!=="string"||d.reason.length>240||typeof d.includeHistorical!=="boolean"||typeof d.operationKey!=="string"||d.operationKey.length<16||d.operationKey.length>128||!d.patches||!d.meetings||Array.isArray(d.patches)||Array.isArray(d.meetings))return false;
 if(Object.keys(d.meetings).length>200||Object.keys(d.patches).length>200||new Set(d.selected).size!==d.selected.length)return false;
 return Object.entries(d.meetings).every(([k,v])=>k.length<=200&&Number.isInteger(v)&&v>=0)&&d.selected.every(k=>typeof k==="string"&&Object.hasOwn(d.meetings,k))&&Object.entries(d.patches).every(([k,v])=>Object.hasOwn(d.meetings,k)&&v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).every(f=>["tanggal","tempat"].includes(f)&&typeof v[f]==="string"&&v[f].length<=100));
}
export function draftEnvelope(kind,scope,id,draft){return{format:"bap-local-draft",version:1,namespace:import.meta.env.VITE_CONVEX_URL,kind,scope,meetingId:id||null,draft};}
export function parseDraftEnvelope(value,kind,scope,id){
 if(value?.format!=="bap-local-draft"||value.version!==1||value.namespace!==import.meta.env.VITE_CONVEX_URL||value.kind!==kind||value.scope!==scope||value.meetingId!==(id||null))throw Error("Draf ini berasal dari akun, kelas, pertemuan atau server yang berbeda.");
 if(!(kind==="correction"?validCorrectionDraft(value.draft):validScheduleDraft(value.draft)))throw Error("Isi draf tidak valid atau tidak lengkap.");return value.draft;
}
export async function readDraftFile(file,kind,scope,id){if(file.size>5000000)throw Error("File draf melebihi 5 MB.");return parseDraftEnvelope(JSON.parse((await file.text()).replace(/^\uFEFF/,"")),kind,scope,id);}
