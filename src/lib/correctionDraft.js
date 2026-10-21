import {MEETING_FIELDS,SNAPSHOT_CATEGORIES} from "../../bap-shared/control.js";
export const correctionKey=(scope,id)=>`bap.correction.${scope}:${id}`;
export const operationKey=()=>crypto.randomUUID();
const fields=m=>Object.fromEntries(MEETING_FIELDS.map(k=>[k,m[k]]));
export function newCorrectionDraft(model){const statuses=Object.fromEntries(model.statuses.map(s=>[s.pesertaId,s.status]));return{version:1,baseMeetingRevision:model.meeting.revision,baseClassRevision:model.classRevision,baseFields:fields(model.meeting),fields:fields(model.meeting),baseStatuses:statuses,statuses,editStatuses:false,refreshCategories:[],templateVersion:'',restoreRevision:'',reason:'',operationKey:operationKey()};}
export function loadCorrectionDraft(scope,id,model){try{const d=JSON.parse(localStorage.getItem(correctionKey(scope,id))||'null');
 if(!d||d.version!==1||d.operationKey===model.lastOperationKey||d.operationKey===model.completedOperation?.operationKey||!Number.isInteger(d.baseMeetingRevision)||!Number.isInteger(d.baseClassRevision)||typeof d.operationKey!=='string'||typeof d.reason!=='string'||!d.fields||!d.baseFields||!Array.isArray(d.refreshCategories)||typeof d.statuses!=='object'||!d.statuses||typeof d.baseStatuses!=='object'||!d.baseStatuses||Array.isArray(d.statuses))return null;
 if(MEETING_FIELDS.some(k=>d.fields[k]===undefined||d.baseFields[k]===undefined)||Object.values(d.statuses).some(v=>!['HADIR','ALPHA','SAKIT','IZIN'].includes(v))||typeof d.editStatuses!=='boolean'||typeof d.restoreRevision!=='string'||typeof d.templateVersion!=='string'||d.refreshCategories.some(c=>!SNAPSHOT_CATEGORIES.includes(c)))return null;
 return d;}catch{return null;}}
export function rebaseCorrectionDraft(d,model){const fresh=newCorrectionDraft(model);return{...d,baseMeetingRevision:fresh.baseMeetingRevision,baseClassRevision:fresh.baseClassRevision,baseFields:fresh.baseFields,baseStatuses:fresh.baseStatuses,
 fields:Object.fromEntries(MEETING_FIELDS.map(k=>[k,d.fields[k]!==d.baseFields[k]?d.fields[k]:fresh.fields[k]])),
 statuses:Object.fromEntries(model.snapshot.peserta.map(p=>[p.id,d.statuses[p.id]!==d.baseStatuses[p.id]&&d.statuses[p.id]?d.statuses[p.id]:fresh.statuses[p.id]||'HADIR'])),operationKey:operationKey()};}
export function correctionRequest(d,token,id,roster){const restore=d.restoreRevision!=='';return{token,pertemuanId:id,expectedMeetingRevision:d.baseMeetingRevision,expectedClassRevision:d.baseClassRevision,
 patch:restore?{}:Object.fromEntries(MEETING_FIELDS.filter(k=>d.fields[k]!==d.baseFields[k]).map(k=>[k,d.fields[k]])),
 refreshCategories:restore?[]:d.refreshCategories,reason:d.reason,
 ...(restore?{restoreRevision:Number(d.restoreRevision)}:{}),...(!restore&&d.templateVersion!==''?{templateVersion:Number(d.templateVersion)}:{}),
 ...(!restore&&d.editStatuses?{statuses:roster.map(p=>({pesertaId:p.id,status:d.statuses[p.id]||'HADIR'}))}:{})};}
