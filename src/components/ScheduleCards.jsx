import { useEffect, useRef, useState } from "react";
import { Field } from "./Form.jsx";
import ExplainButton from "./ExplainButton.jsx";
import { TYPES } from "../../bap-shared/management.js";
import { meetingHadAttendance } from "../../bap-shared/control.js";
import { confirmAction, showAppToast } from "../lib/appDialog.js";
import { additionError, nextMeetingCard } from "../lib/meetingCards.js";
import { navigate, linkClick } from "../lib/navigation.js";
import "./ScheduleCards.css";

function Symbol({ name }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "trash" ? <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/> : name === "down" ? <path d="m6 9 6 6 6-6"/> : name === "up" ? <path d="m5 12 7-7 7 7M12 5v14"/> : <path d="M12 5v14M5 12h14"/>}
  </svg>;
}
const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !isNaN(Date.parse(value)) ? new Date(value+"T12:00:00Z").toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Jakarta"}) : "Tanggal perlu diperiksa";

export default function ScheduleCards({ data, draft, update, canEdit, busy, online, stale, showCancelled, setShowCancelled, changeDate, canCorrect, onDelete, onSave, onPreviewDates, invalidDates }) {
  const [expanded,setExpanded] = useState(new Set()), [topVisible,setTopVisible] = useState(true);
  const top = useRef(null), root = useRef(null), confirming = useRef(false), alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
  useEffect(()=>{const observer=new IntersectionObserver(([e])=>setTopVisible(e.isIntersecting));observer.observe(top.current);return()=>observer.disconnect()},[]);
  const additions = draft.additions || [], pending = Boolean(draft.addRequest);
  const active = data.pertemuan.filter(p=>!p.cancelled), total = active.length + additions.length;
  const rows = [...data.pertemuan.filter(p=>showCancelled || !p.cancelled).map(p=>({...p,...draft.patches[p.id],cardKey:p.id})),...additions.map(p=>({...p,cardKey:p.key,isNew:true}))].sort((a,b)=>Number(a.nomor)-Number(b.nomor));
  const error = additionError(data.pertemuan, additions);
  const locked = !canEdit || busy || pending;
  const permissionReason = !canEdit ? "Akunmu belum memiliki izin jadwal atau editor sedang dipakai tab lain. Gunakan akun dengan izin jadwal dan tutup editor di tab lain." : busy ? "Tunggu proses penyimpanan selesai." : pending ? "Hasil permintaan sebelumnya belum diketahui. Klik Periksa & coba simpan lagi; permintaan yang sama tidak membuat pertemuan ganda." : "";
  const correctURL = p => `/kelas/${data.kelas.id}?tab=jadwal&correct=${p.id}`;
  const focusCard = (key,field) => {
    setExpanded(old=>new Set([...old,key]));
    requestAnimationFrame(()=>{
      const card=[...root.current.querySelectorAll("[data-card]")].find(el=>el.dataset.card===key);
      card?.scrollIntoView({block:"center"});
      (card?.querySelector(`[data-card-field="${field}"] input`) || card?.querySelector("input"))?.focus({preventScroll:true});
    });
  };
  const add = async () => {
    if (locked || confirming.current) return;
    let row;
    try { row=nextMeetingCard(data.pertemuan,additions,draft.patches,data.kelas.tempat); }
    catch(e) {
      if(await confirmAction(e.message,{title:"Periksa tanggal terakhir",confirmLabel:"Periksa tanggal",danger:false})) {
        const last=rows.filter(p=>!p.cancelled).at(-1);if(last)focusCard(last.cardKey,"tanggal");
      }
      return;
    }
    if(total>=16) {
      confirming.current=true;
      const accepted=await confirmAction(`Umumnya satu kelas memiliki 16 pertemuan. Setelah ditambah, jadwal ini akan berisi ${total+1} pertemuan. Tetap tambahkan?`,{title:"Lebih dari 16 pertemuan?",confirmLabel:"Tetap tambah",danger:false});
      confirming.current=false;
      if(!accepted || !alive.current)return;
    }
    update(d=>({...d,additions:[...(d.additions || []),row]}));
    showAppToast(`Pertemuan ${row.nomor} ditambahkan ke draf. Kartu tetap tertutup; simpan jadwal setelah selesai.`);
    // Keep the bottom add button available for repeated keyboard presses.
    requestAnimationFrame(()=>root.current?.querySelector(".schedule-add-card")?.focus({preventScroll:true}));
  };
  const updateRow = (key,field,value) => update(d=>({...d,additions:d.additions.map(p=>p.key===key?{...p,[field]:value}:p)}));
  const saveReason = !canEdit || busy ? permissionReason : !online ? "Hubungkan internet untuk menyimpan. Draf tetap dapat diatur pada halaman ini." : pending ? "" : stale ? "Data kelas berubah. Pilih Periksa dengan versi jadwal terbaru sebelum menyimpan draf." : error?.message;
  const saveDisabled = !canEdit || busy || !online || (!pending && (stale || Boolean(error)));
  const addReason = locked ? permissionReason : total>=100 ? "Batas aplikasi adalah 100 sesi aktif per kelas. Hapus draf yang tidak diperlukan atau batalkan sesi melalui editor rincian." : "";
  return <div ref={root} className="schedule-cards-editor">
    <div ref={top} className="schedule-card-toolbar" id="schedule-actions">
      <div><h3>{total ? `${total} pertemuan` : "Susun jadwal kelas"}</h3><p className="muted">{additions.length ? `${additions.length} kartu baru belum disimpan.` : "Kartu baru memakai tanggal kartu sebelumnya +7 hari."} Klik kartu untuk mengatur isinya.</p></div>
      <div className="mg-inline-actions">
        {additions.length>0 && <ExplainButton data-schedule-save className="button button--primary" unavailable={saveDisabled} reason={saveReason} onResolve={error&&!pending&&!busy&&canEdit&&online&&!stale?()=>focusCard(error.key,error.field):undefined} resolveLabel="Perbaiki isian" onClick={onSave}>{busy?"Menyimpan jadwal…":pending?"Periksa & coba simpan lagi":"Simpan jadwal"}</ExplainButton>}
        {!additions.length && draft.selected.length>0 && <ExplainButton data-schedule-save className="button button--primary" unavailable={!canEdit || busy || !online || stale || invalidDates} reason={permissionReason || (!online?"Hubungkan internet untuk menyimpan.":stale?"Periksa dengan versi jadwal terbaru terlebih dahulu.":"Ada tanggal yang belum valid. Buka kartu yang ditandai dan perbaiki tanggalnya.")} onClick={onPreviewDates}>Periksa perubahan tanggal</ExplainButton>}
        {total>0 && <ExplainButton className="button button--outline" unavailable={Boolean(addReason)} reason={addReason} onClick={add}><Symbol/>Tambah pertemuan</ExplainButton>}
      </div>
    </div>
    {pending && <p className="schedule-pending" role="status">Permintaan sebelumnya disimpan di perangkat. Periksa & coba simpan lagi untuk memastikan hasilnya sebelum menyunting draf.</p>}
    {!rows.length ? <ExplainButton className="schedule-empty" unavailable={Boolean(addReason)} reason={addReason} onClick={add}><span className="schedule-empty-plus"><Symbol/></span><strong>Tambah pertemuan</strong><span>Mulai dari sini. Nomor otomatis, tanggal hari ini, jenis Praktikum, dan ruang dari kelas sudah terisi.</span></ExplainButton> : <>
      <label className="mg-check schedule-cancelled"><input type="checkbox" checked={showCancelled} onChange={e=>setShowCancelled(e.target.checked)}/><span>Sertakan sesi dibatalkan</span></label>
      <div className="schedule-card-grid">
        {rows.map(p=>{
          const isOpen=expanded.has(p.cardKey), historical=!p.isNew && meetingHadAttendance(p);
          const canDelete=p.isNew || (p.revision===0 && p.status==="TERBUKA" && !p.cancelled);
          const deleteBlocked=locked || !canDelete || (!p.isNew && !online);
          const deleteReason=locked?permissionReason:!canDelete?"Sesi ini memiliki revisi, riwayat, atau sudah dibatalkan. Gunakan Edit rincian untuk pembatalan atau pemulihan agar riwayat tetap tersimpan.":"Hubungkan internet untuk menghapus sesi tersimpan.";
          return <div className={`schedule-card-shell ${p.isNew?"is-new":""}`} key={p.cardKey} data-card={p.cardKey}>
            <article className="schedule-meeting-card">
              <button type="button" className="schedule-card-toggle" aria-expanded={isOpen} aria-controls={`meeting-card-${p.cardKey}`} onClick={()=>setExpanded(old=>{const next=new Set(old);next.has(p.cardKey)?next.delete(p.cardKey):next.add(p.cardKey);return next})}>
                <span className="schedule-card-number">{p.nomor}</span><span className="schedule-card-summary"><strong>Pertemuan {p.nomor}</strong><small>{dateLabel(p.tanggal)}</small><small>{p.tipe==="REGULER"?"Praktikum":p.tipe} · {p.tempat || "Ruang belum diisi"}</small><span className="schedule-card-state">{p.isNew?"Draf baru · belum disimpan":p.cancelled?"Dibatalkan":historical?`Riwayat revisi ${p.revision}`:draft.selected.includes(p.id)?"Tanggal belum disimpan":"Tersimpan"}</span></span><Symbol name="down"/>
              </button>
              <div id={`meeting-card-${p.cardKey}`} className="schedule-card-body" hidden={!isOpen}>
                {p.isNew ? <div className="mg-form-grid">
                  <div data-card-field="nomor"><Field label={`Nomor pertemuan baru ${p.nomor}`} type="number" min="1" max="1000" disabled={locked} value={p.nomor} onChange={v=>updateRow(p.key,"nomor",v)}/></div>
                  <Field label={`Jenis pertemuan baru ${p.nomor}`} options={TYPES.map(value=>({value,label:value==="REGULER"?"Praktikum":value}))} disabled={locked} value={p.tipe} onChange={v=>updateRow(p.key,"tipe",v)}/>
                  <div data-card-field="tanggal"><Field label={`Tanggal pertemuan baru ${p.nomor}`} type="date" disabled={locked} value={p.tanggal} onChange={v=>updateRow(p.key,"tanggal",v)}/></div>
                  <div data-card-field="tempat"><Field label={`Ruang pertemuan baru ${p.nomor}`} maxLength="80" disabled={locked} value={p.tempat} onChange={v=>updateRow(p.key,"tempat",v)}/></div>
                </div> : <>
                  {!p.cancelled && !historical && <div data-card-field="tanggal"><Field label={`Tanggal pertemuan ${p.nomor}`} form="setup-schedule" type="date" disabled={locked} value={p.tanggal} onChange={v=>changeDate(data.pertemuan.find(row=>row.id===p.id),v)}/></div>}
                  {canCorrect && <a className="button button--outline" href={correctURL(p)} onClick={e=>linkClick(e,correctURL(p))}>{p.cancelled?"Pulihkan / lihat riwayat":"Edit rincian "+p.nomor}</a>}
                  {(historical || p.cancelled) && <p className="muted">Ubah tanggal atau batalkan sesi melalui Edit rincian agar riwayat tetap tercatat.</p>}
                </>}
              </div>
            </article>
            <ExplainButton className="button schedule-card-trash" aria-label={`Hapus ${p.isNew?"draf pertemuan":"sesi kosong"} ${p.nomor}`} unavailable={deleteBlocked} reason={deleteReason} resolveLabel="Buka Edit rincian" onResolve={!locked&&!canDelete&&canCorrect?()=>navigate(correctURL(p)):undefined} onClick={()=>p.isNew?update(d=>({...d,additions:d.additions.filter(r=>r.key!==p.key)})):onDelete(p)}><Symbol name="trash"/></ExplainButton>
          </div>;
        })}
        <ExplainButton className="schedule-add-card" unavailable={Boolean(addReason)} reason={addReason} onClick={add}><Symbol/><strong>Tambah pertemuan</strong><small>Tanggal kartu sebelumnya +7 hari</small></ExplainButton>
      </div>
    </>}
    <p className="schedule-defaults muted">Kartu pertama memakai hari ini (WIB). Atur tanggalnya sebelum menambah kartu berikutnya. Mengubah satu tanggal tidak menggeser kartu yang sudah ada. Lebih dari 16 pertemuan memerlukan konfirmasi.</p>
    {!topVisible && total>0 && <button type="button" className="button schedule-back-top" onClick={()=>{top.current.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});top.current.querySelector("button")?.focus({preventScroll:true})}}><Symbol name="up"/>Kembali ke atas</button>}
  </div>;
}
