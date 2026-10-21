import {MEETING_FIELDS,SNAPSHOT_CATEGORIES} from "../../bap-shared/control.js";
export const correctionKey=(scope,id)=>`bap.correction.${scope}:${id}`;
export const operationKey=()=>crypto.randomUUID();
const fields=m=>Object.fromEntries(MEETING_FIELDS.map(k=>[k,m[k]]));
export function newCorrectionDraft(model){const statuses=Object.fromEntries(model.statuses.map(s=>[s.pesertaId,s.status]));return{version:1,baseMeetingRevision:model.meeting.revision,baseClassRevision:model.classRevision,baseFields:fields(model.meeting),fields:fields(model.meeting),baseStatuses:statuses,statuses,editStatuses:false,refreshCategories:[],templateVersion:'',restoreRevision:'',lifecycleAction:'',attendanceMode:'',reason:'',operationKey:operationKey()};}
export function validCorrectionDraft(d){
 if(!d||d.version!==1||!Number.isInteger(d.baseMeetingRevision)||d.baseMeetingRevision<0||!Number.isInteger(d.baseClassRevision)||d.baseClassRevision<0||typeof d.operationKey!=="string"||d.operationKey.length<16||d.operationKey.length>128||typeof d.reason!=="string"||d.reason.length>240||!d.fields||!d.baseFields||!Array.isArray(d.refreshCategories)||!d.statuses||!d.baseStatuses||Array.isArray(d.statuses)||Array.isArray(d.baseStatuses))return false;
 if([d.fields,d.baseFields].some(f=>!Number.isInteger(f.nomor)||["tanggal","tempat","tipe"].some(k=>typeof f[k]!=="string"||f[k].length>100)))return false;
 if([d.statuses,d.baseStatuses].some(s=>Object.keys(s).length>2000||Object.entries(s).some(([k,v])=>k.length>200||!["HADIR","ALPHA","SAKIT","IZIN"].includes(v))))return false;
 return typeof d.editStatuses==="boolean"&&typeof d.restoreRevision==="string"&&typeof d.templateVersion==="string"&&/^(|[0-9]{1,8})$/.test(d.restoreRevision)&&/^(|[0-9]{1,8})$/.test(d.templateVersion)&&d.refreshCategories.length<=3&&d.refreshCategories.every(c=>SNAPSHOT_CATEGORIES.includes(c))&&[undefined,"","cancel","restore"].includes(d.lifecycleAction)&&[undefined,"","reset","restore"].includes(d.attendanceMode);
}
export function loadCorrectionDraft(scope,id,model){try{const d=JSON.parse(localStorage.getItem(correctionKey(scope,id))||"null");return validCorrectionDraft(d)&&d.operationKey!==model.lastOperationKey&&d.operationKey!==model.completedOperation?.operationKey?{...d,lifecycleAction:d.lifecycleAction||"",attendanceMode:d.attendanceMode||""}:null;}catch{return null;}}
export function rebaseCorrectionDraft(d,model){const fresh=newCorrectionDraft(model);return{...d,baseMeetingRevision:fresh.baseMeetingRevision,baseClassRevision:fresh.baseClassRevision,baseFields:fresh.baseFields,baseStatuses:fresh.baseStatuses,
 fields:Object.fromEntries(MEETING_FIELDS.map(k=>[k,d.fields[k]!==d.baseFields[k]?d.fields[k]:fresh.fields[k]])),
 statuses:Object.fromEntries(model.snapshot.peserta.map(p=>[p.id,d.statuses[p.id]!==d.baseStatuses[p.id]&&d.statuses[p.id]?d.statuses[p.id]:fresh.statuses[p.id]||'HADIR'])),operationKey:operationKey()};}
export function correctionRequest(d,token,id,roster){const restore=d.restoreRevision!=='';return{token,pertemuanId:id,expectedMeetingRevision:d.baseMeetingRevision,expectedClassRevision:d.baseClassRevision,
 patch:restore?{}:Object.fromEntries(MEETING_FIELDS.filter(k=>d.fields[k]!==d.baseFields[k]).map(k=>[k,d.fields[k]])),
 refreshCategories:restore?[]:d.refreshCategories,reason:d.reason,
 ...(!restore&&d.lifecycleAction?{lifecycleAction:d.lifecycleAction}:{}),...(!restore&&d.attendanceMode?{attendanceMode:d.attendanceMode}:{}),
 ...(restore?{restoreRevision:Number(d.restoreRevision)}:{}),...(!restore&&d.templateVersion!==''?{templateVersion:Number(d.templateVersion)}:{}),
 ...(!restore&&d.editStatuses?{statuses:roster.map(p=>({pesertaId:p.id,status:d.statuses[p.id]||'HADIR'}))}:{})};}
