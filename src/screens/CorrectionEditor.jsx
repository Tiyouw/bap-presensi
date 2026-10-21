import {useEffect,useRef,useState} from "react";
import {useQuery,useMutation,useAction,useConvex,usePaginatedQuery} from "convex/react";
import {api} from "../../convex/_generated/api.js";
import {MEETING_FIELDS,CAPABILITY_LABELS,meetingHadAttendance} from "../../bap-shared/control.js";
import {TYPES} from "../../bap-shared/management.js";
import {LABEL,pesanGalat,unduhDokumen} from "../lib/presensi.js";
import {useScopedStore} from "../lib/ScopedStorage.jsx";
import {useDraftLock} from "../lib/useDraftLock.js";
import {useEditorGuard} from "../lib/useEditorGuard.js";
import {correctionKey,newCorrectionDraft,loadCorrectionDraft,rebaseCorrectionDraft,correctionRequest} from "../lib/correctionDraft.js";
import {Field,useTask,Feedback} from "../components/Form.jsx";
import {Notice} from "../components/Layout.jsx";
import {SkeletonRows} from "../components/Loading.jsx";
import {navigate} from "../lib/navigation.js";
const labels={nomor:'Nomor pertemuan',tanggal:'Tanggal',tempat:'Ruang',tipe:'Jenis',status:'Status sesi',cancelled:'Dibatalkan'};
const formatValue=(field,value)=>field==='cancelled'?(value?'Dibatalkan':'Aktif'):field==='status'?(value==='KUNCI'?'Siap digunakan':'Terbuka'):field==='tipe'&&value==='REGULER'?'Praktikum':String(value);
const track=d=>({...d,operationKey:undefined});
function downloadDraft(d){const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='draf-koreksi-bap.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function CorrectionEditor({token,data,pertemuanId,network}){
 const store=useScopedStore(),cacheKey=`bap.correction.cache.${store.scope}:${pertemuanId}`;
 const [pendingOperation]=useState(()=>{try{const k=JSON.parse(localStorage.getItem(correctionKey(store.scope,pertemuanId))||'null')?.operationKey;return typeof k==='string'&&k.length<=128?k:undefined}catch{return undefined}});
 const model=useQuery(api.revisions.editor,{token,pertemuanId,...(pendingOperation?{operationKey:pendingOperation}:{})});
 const [cached,setCached]=useState(()=>{try{return JSON.parse(localStorage.getItem(cacheKey)||'null')}catch{return null}});
 useEffect(()=>{if(model){setCached(model);try{localStorage.setItem(cacheKey,JSON.stringify(model))}catch{}}},[model,cacheKey]);
 const value=model||cached;
 if(!value)return <SkeletonRows title="Memuat editor koreksi"/>;
 if(!value.enabled)return <Notice>Koreksi sesi belum tersedia pada kelas ini.</Notice>;
 return <CorrectionForm key={pertemuanId} token={token} data={data} id={pertemuanId} model={value} online={network.online&&Boolean(model)}/>;
}
function CorrectionForm({token,data,id,model,online}){
 const store=useScopedStore(),client=useConvex(),commit=useMutation(api.revisions.commitCorrection),generate=useAction(api.bapNode.generate),task=useTask();
 const latest=useRef(model);latest.current=model;
 const [draft,setDraft]=useState(()=>loadCorrectionDraft(store.scope,id,model)||newCorrectionDraft(model)),draftRef=useRef(draft);draftRef.current=draft;
 const [preview,setPreview]=useState(null),[reviewed,setReviewed]=useState(false),[storageError,setStorageError]=useState(false),[saved,setSaved]=useState(null),processing=useRef(false);
 const editor=useDraftLock(`${store.scope}:${id}`,()=>{const d=loadCorrectionDraft(store.scope,id,latest.current);if(d){draftRef.current=d;setDraft(d);}});
 const guard=useEditorGuard(track(draft),true,task.busy,"Perubahan belum diterapkan. Draf lokal tetap disimpan jika penyimpanan tersedia. Tinggalkan editor?");
 useEffect(()=>{guard.markSaved(track(newCorrectionDraft(latest.current)));},[]);
 useEffect(()=>{if(model.lastOperationKey&&model.lastOperationKey===draftRef.current.operationKey&&model.meeting.revision>draftRef.current.baseMeetingRevision){
   const next=newCorrectionDraft(model);setSaved({revision:model.meeting.revision,date:model.meeting.tanggal});draftRef.current=next;setDraft(next);setPreview(null);guard.markSaved(track(next));try{localStorage.removeItem(correctionKey(store.scope,id))}catch{}
 }},[model]);
 const persist=next=>{try{localStorage.setItem(correctionKey(store.scope,id),JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}};
 const update=fn=>{if(!editor.owns()||processing.current)return;const next=fn(draftRef.current);draftRef.current=next;setDraft(next);persist(next);setPreview(null);setReviewed(false);setSaved(null);task.clear();};
 const capabilities=model.capabilities||[],can=c=>capabilities.includes(c),historical=meetingHadAttendance(model.meeting)||model.statuses.length>0;
 const stale=draft.baseMeetingRevision!==model.meeting.revision||draft.baseClassRevision!==model.classRevision;
 const roster=draft.refreshCategories.includes('roster')?data.peserta.filter(p=>p.aktif!==false):model.snapshot.peserta;
 const disabled=!editor.owned||model.archived||task.busy;
 const request=()=>correctionRequest(draftRef.current,token,id,roster);
 const run=(fn,message)=>{if(processing.current)return;processing.current=true;task.run(fn,message).catch(()=>{}).finally(()=>{processing.current=false});};
 const close=()=>navigate(`/kelas/${data.kelas.id}?tab=jadwal`);
 return <section className="correction-editor">
  <div className="mg-section-heading"><div><p className="eyebrow">Koreksi sesi · revisi {model.meeting.revision}</p><h2>Pertemuan {model.meeting.nomor}</h2><p>Ubah data, periksa dampaknya, lalu simpan sebagai revisi baru.</p></div><button className="button button--outline" onClick={close}>Kembali ke jadwal</button></div>
  {!online&&<Notice kind="warning">Offline. Draf dapat disunting; periksa dan simpan revisi setelah tersambung kembali.</Notice>}
  {editor.ready&&!editor.owned&&<Notice kind="warning">{editor.supported?'Editor presensi/koreksi sedang digunakan tab lain. Tab ini hanya membaca.':'Browser ini belum mendukung penguncian editor. Gunakan browser modern untuk menyunting.'}</Notice>}
  {storageError&&<Notice kind="warning">Draf belum tersimpan di perangkat. Tetap di halaman ini atau unduh draf sebelum menutup.<button className="button button--outline" onClick={()=>downloadDraft(draft)}>Unduh draf koreksi</button></Notice>}
  {stale&&!saved&&<Notice kind="warning">Versi sesi atau kelas berubah. Drafmu tetap ada. Bawa perubahan ke versi terbaru dan periksa ulang.<button className="button button--outline" disabled={disabled||!online} onClick={()=>update(d=>rebaseCorrectionDraft(d,model))}>Bawa draf ke versi terbaru</button></Notice>}
  {model.archived&&<Notice kind="warning">Pulihkan kelas arsip terlebih dahulu untuk menyimpan koreksi.</Notice>}
  {model.meeting.cancelled&&<Notice kind="warning">Sesi ini dibatalkan dan tidak masuk rekap atau paket aktif. Pilih Pulihkan sesi untuk menggunakannya kembali. Arsip lama tetap tersedia.</Notice>}
  <Feedback task={task}/>
  {saved?<div className="mg-panel"><h3>Revisi {saved.revision} tersimpan</h3><p>Tanggal berlaku: {saved.date}. Arsip versi sebelumnya tetap utuh.</p><p className="muted">Word/PDF terbaru dibuat dari revisi ini. Jika pembuatan gagal, data koreksi tetap tersimpan dan dapat dicoba lagi.</p><div className="mg-inline-actions">{['docx','pdf'].map(format=><button key={format} className="button button--outline" disabled={!online||task.busy||model.meeting.tipe!=='REGULER'||model.meeting.status!=='KUNCI'||model.meeting.cancelled} onClick={()=>run(async()=>{const result=await generate({token,pertemuanId:id,format,expectedRevision:saved.revision});if(result.status!=='READY')throw Error('Dokumen sedang dibuat. Coba lagi sebentar.');await unduhDokumen(result.url,`BAP_P${model.meeting.nomor}_r${saved.revision}.${format}`);},'Dokumen terbaru diunduh.')}>Buat & unduh {format==='docx'?'Word':'PDF'}</button>)}<button className="button button--quiet" disabled={task.busy} onClick={()=>{const next=newCorrectionDraft(model);draftRef.current=next;setDraft(next);guard.markSaved(track(next));setSaved(null);}}>Koreksi lagi</button></div></div>:<>
  <fieldset disabled={disabled} className="mg-panel"><div className="mg-form-grid">
    <Field label="Tindakan sesi" value={draft.lifecycleAction} disabled={!can('lifecycle')||draft.restoreRevision!==''} options={[{value:'',label:'Koreksi data sesi'},model.meeting.cancelled?{value:'restore',label:'Pulihkan sesi yang dibatalkan'}:{value:'cancel',label:'Batalkan pertemuan (riwayat tetap ada)'}]} onChange={lifecycleAction=>update(d=>({...d,lifecycleAction}))}/>
    <Field label="Tanggal pelaksanaan" type="date" value={draft.fields.tanggal} disabled={!can('schedule')||draft.restoreRevision!==''} onChange={tanggal=>update(d=>({...d,fields:{...d.fields,tanggal}}))}/>
    <Field label="Nomor pertemuan" type="number" min="1" max="1000" value={draft.fields.nomor} disabled={!can('schedule')||draft.restoreRevision!==''} onChange={v=>update(d=>({...d,fields:{...d.fields,nomor:Number(v)}}))}/>
    <Field label="Ruang pelaksanaan" value={draft.fields.tempat} maxLength="80" disabled={!can('schedule')||draft.restoreRevision!==''} onChange={tempat=>update(d=>({...d,fields:{...d.fields,tempat}}))}/>
    <Field label="Jenis pertemuan" value={draft.fields.tipe} disabled={!can('schedule')||draft.restoreRevision!==''} options={TYPES.map(value=>({value,label:value==='REGULER'?'Praktikum':value}))} onChange={tipe=>update(d=>({...d,fields:{...d.fields,tipe},attendanceMode:''}))}/>
    {model.meeting.tipe!=='REGULER'&&draft.fields.tipe==='REGULER'&&historical&&<Field label="Presensi saat kembali menjadi praktikum" value={draft.attendanceMode} options={[{value:'',label:'Pilih cara memulai presensi'},{value:'restore',label:'Pulihkan status presensi sebelumnya'},{value:'reset',label:'Mulai kosong; buka sesi untuk diisi ulang'}]} onChange={attendanceMode=>update(d=>({...d,attendanceMode,...(attendanceMode==='reset'?{editStatuses:false}:{})}))}/>}
    <Field label="Catatan perubahan" value={draft.reason} maxLength="240" help={historical?'Wajib untuk koreksi sesi bersejarah.':'Opsional untuk jadwal tanpa riwayat.'} onChange={reason=>update(d=>({...d,reason}))}/>
  </div>
  <details className="correction-options"><summary>Identitas, roster, template dan presensi</summary><p className="muted">Tanggal saja tidak mengganti data lain. Pilih kategori hanya jika sesi ini perlu memakai data kelas terbaru.</p>
    {['identity','roster','template'].map(category=><label className="mg-check" key={category}><input type="checkbox" checked={draft.refreshCategories.includes(category)} disabled={!can(category)||draft.restoreRevision!==''} onChange={e=>update(d=>({...d,refreshCategories:e.target.checked?[...d.refreshCategories,category]:d.refreshCategories.filter(c=>c!==category)}))}/><span>Terapkan {category==='identity'?'identitas/dosen':category==='roster'?'daftar peserta':'template terbit'} terbaru</span></label>)}
    <Field label="Atau pilih versi template" value={draft.templateVersion} disabled={!can('template')||draft.restoreRevision!==''} options={[{value:'',label:'Pertahankan template sesi'},...data.templates.map(t=>({value:String(t.version),label:`Template versi ${t.version}`}))]} onChange={templateVersion=>update(d=>({...d,templateVersion,refreshCategories:d.refreshCategories.filter(c=>c!=='template')}))}/>
    <label className="mg-check"><input type="checkbox" checked={draft.editStatuses} disabled={!can('history')||draft.restoreRevision!==''} onChange={e=>update(d=>({...d,editStatuses:e.target.checked}))}/><span>Koreksi status presensi</span></label>
    {draft.editStatuses&&<div className="correction-roster">{roster.map(p=><div className="mg-list-row" key={p.id}><span><strong>{p.nama}</strong><small>{p.nim} · {p.golongan}</small></span><Field label={`Status ${p.nama}`} value={draft.statuses[p.id]||'HADIR'} options={Object.entries(LABEL).map(([value,label])=>({value,label}))} onChange={status=>update(d=>({...d,statuses:{...d.statuses,[p.id]:status}}))}/></div>)}</div>}
  </details>
  <RevisionRestore token={token} id={id} value={draft.restoreRevision} disabled={disabled||!can('history')} onChange={restoreRevision=>update(d=>({...d,restoreRevision,lifecycleAction:''}))}/>
  {store.bacaDraf(id)&&<Notice kind="warning">Ada draf presensi lokal untuk sesi ini. Draf itu tetap disimpan.<button className="button button--outline" disabled={!can('history')} onClick={()=>{const old=store.bacaDraf(id);if(old?.statuses)update(d=>({...d,editStatuses:true,statuses:{...d.statuses,...old.statuses}}));}}>Bawa status dari draf presensi</button></Notice>}
  <div className="mg-inline-actions"><button className="button button--primary" disabled={!online||stale} onClick={()=>run(async()=>{const args=request(),result=await client.query(api.revisions.previewCorrection,args);setPreview({args,result});setReviewed(false);},'Preview siap diperiksa.')}>Periksa perubahan</button><button className="button button--quiet" onClick={()=>downloadDraft(draft)}>Unduh draf koreksi</button></div>
  </fieldset>
  {preview&&<section className="mg-panel correction-review"><h3>Periksa sebelum menyimpan revisi {preview.result.nextRevision}</h3><ul>{preview.result.fields.map(f=><li key={f.field}><strong>{labels[f.field]||f.field}:</strong> {formatValue(f.field,f.before)} → {formatValue(f.field,f.after)}</li>)}{preview.result.refresh.map(c=><li key={c}>{CAPABILITY_LABELS[c]}: diperbarui secara eksplisit</li>)}<li>{preview.result.statusChanged?'Status presensi berubah; periksa daftar di bawah.':'Status presensi tetap dipertahankan.'}</li></ul>{draft.restoreRevision!==''&&<p>Memulihkan nilai dari revisi {draft.restoreRevision} sebagai revisi baru. Versi setelahnya tetap tersimpan.</p>}
    {preview.result.warnings.map(w=><Notice key={w} kind="warning">{w}</Notice>)}
    {(preview.result.statusChanged||preview.result.needsRosterReview)&&<details open={preview.result.needsRosterReview}><summary>Periksa {preview.result.snapshot.peserta.length} peserta dan status</summary>{preview.result.snapshot.peserta.map(p=><div className="mg-list-row" key={p.id}><span>{p.nama} · {p.nim}</span><strong>{LABEL[preview.result.statuses.find(s=>s.pesertaId===p.id)?.status]||'Belum dicatat'}</strong></div>)}</details>}
    {preview.result.needsRosterReview&&<label className="mg-check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>Saya sudah memeriksa perubahan daftar dan status peserta.</span></label>}
    <p className="muted">Word/PDF lama tetap disimpan. Buat dokumen terbaru setelah revisi tersimpan.</p><button className="button button--primary" disabled={disabled||!online||stale||preview.result.needsRosterReview&&!reviewed} onClick={()=>run(async()=>{if(!editor.owns())throw Error('Editor sedang digunakan tab lain.');const result=await commit({...preview.args,rosterReviewed:reviewed,previewHash:preview.result.previewHash,operationKey:draftRef.current.operationKey});setSaved({revision:result.revision,date:preview.result.snapshot.tanggal});guard.markSaved(track(draftRef.current));try{localStorage.removeItem(correctionKey(store.scope,id))}catch{}setPreview(null);},'Koreksi tersimpan. Arsip sebelumnya tetap utuh.')}>Simpan revisi {preview.result.nextRevision}</button>
  </section>}
  </>}
 </section>;
}
function RevisionRestore({token,id,value,disabled,onChange}){
 const {results:history,status,loadMore}=usePaginatedQuery(api.revisions.historyPage,{token,pertemuanId:id},{initialNumItems:20});
 return <div><Field label="Pulihkan dari revisi sebelumnya" value={value} disabled={disabled} options={[{value:'',label:'Tidak memulihkan versi lama'},...(history||[]).map(r=>({value:String(r.revision),label:`Revisi ${r.revision} · ${r.tanggal}${r.legacyPartial||!r.metadataVerified?' · riwayat parsial, tidak dapat dipulihkan':''}`,disabled:r.legacyPartial||!r.metadataVerified}))]} onChange={onChange} help="Pemulihan menghasilkan revisi baru. Data historis yang tidak lengkap tidak dipulihkan otomatis."/>{status==='CanLoadMore'&&<button type="button" className="button button--quiet" onClick={()=>loadMore(20)}>Muat revisi lebih lama</button>}</div>;
}
