import {useState} from "react";
import {useConvex,usePaginatedQuery} from "convex/react";
import {api} from "../../convex/_generated/api.js";
import {useTask,Feedback} from "./Form.jsx";
import {Notice} from "./Layout.jsx";
export default function HistoricalPacketPicker({token,kelasId,onChoose,online}){
 const client=useConvex(),task=useTask(),{results,status,loadMore}=usePaginatedQuery(api.revisions.printVersionsPage,{token,kelasId},{initialNumItems:20});
 const [picked,setPicked]=useState('');
 return <section className="mg-panel"><h3>Pilih versi pertemuan untuk paket</h3><p>Versi lengkap yang siap cetak dapat dipilih, termasuk sebelum sesi dibatalkan atau berubah jenis. Satu versi untuk setiap pertemuan.</p><Feedback task={task}/>
  <Notice kind="warning">Periksa tanggal dan revisi. Versi yang dipilih dapat berbeda dari data yang sedang berlaku.</Notice>
  {results.map(r=><div className="mg-list-row" key={r._id}><span><strong>Pertemuan {r.nomor} · revisi {r.revision}</strong><small>{r.tanggal} · {r.rowCount} peserta · {picked===r._id?'sudah dipilih':'versi lengkap'}</small></span><button className="button button--outline" disabled={!online||task.busy} onClick={()=>task.run(async()=>{const d=await client.query(api.revisions.detail,{token,pertemuanId:r.pertemuanId,revision:r.revision});if(!d||d.legacyPartial)throw Error('Versi tidak tersedia untuk dibuat ulang.');const count=d.statuses.filter(s=>s.status!=='HADIR').length;onChoose({id:r.pertemuanId,revisionId:r._id,revision:r.revision,nomor:r.nomor,tanggal:r.tanggal,jumlahAbsen:count,jumlahForm:Math.max(1,Math.ceil(count/12)),explicitVersion:true});setPicked(r._id);},'Versi dipilih untuk paket.').catch(()=>{})}>Gunakan pertemuan {r.nomor} revisi {r.revision}</button></div>)}
  {!results.length&&<p>Belum ada versi lengkap pada halaman ini. Arsip legacy yang parsial tetap dapat diunduh dari Arsip BAP.</p>}
  {status==='CanLoadMore'&&<button className="button button--outline" onClick={()=>loadMore(20)}>Muat versi sebelumnya</button>}
 </section>;
}
