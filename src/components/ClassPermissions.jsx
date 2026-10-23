import { HelpGroup } from "./Help.jsx";
import {useState} from "react";
import {useQuery,useMutation} from "convex/react";
import {api} from "../../convex/_generated/api.js";
import {CAPABILITY_LABELS} from "../../bap-shared/control.js";
import {Feedback,useTask} from "./Form.jsx";
export default function ClassPermissions({token,data}){
 const users=useQuery(api.classAccess.list,{token,kelasId:data.kelas.id});
 return <section className="mg-panel"><HelpGroup topic="permissions"><h3>Izin Operator kelas ini</h3></HelpGroup><p>Hanya Operator yang telah ditugaskan ke kelas ini. Presensi awal tetap tersedia; izin koreksi historis dapat dicabut secara eksplisit.</p>{users?.map(u=><PermissionRow key={u.id} token={token} kelasId={data.kelas.id} user={u} allowed={data.controls.capabilities} archived={data.kelas.arsip}/>)}{users?.length===0&&<p>Belum ada Operator yang ditugaskan.</p>}</section>;
}
function PermissionRow({token,kelasId,user,allowed,archived}){
 const [caps,setCaps]=useState(user.capabilities),[baseRevision,setBaseRevision]=useState(user.revision),save=useMutation(api.classAccess.setClassCapabilities),task=useTask();
 const limited=user.capabilities.some(c=>!allowed.includes(c));
 return <details className="control-job"><summary>{user.nama}{!user.aktif?' · Nonaktif':''}{user.self?' · Akunmu':''}</summary><Feedback task={task}/>{baseRevision!==user.revision&&<p>Izin Operator berubah sejak panel dibuka. Pilihanmu tetap ada; muat izin terbaru sebelum menyimpan.<button className="button button--outline" onClick={()=>{setCaps(user.capabilities);setBaseRevision(user.revision);task.clear();}}>Muat izin terbaru {user.nama}</button></p>}{limited&&<p>Izin akun ini mencakup tindakan di luar aksesmu. Minta Pengelola/Admin memperbaruinya.</p>}<fieldset disabled={archived||limited||user.self||!user.aktif||task.busy}>{Object.entries(CAPABILITY_LABELS).filter(([c])=>allowed.includes(c)||caps.includes(c)).map(([c,label])=><label className="mg-check" key={c}><input type="checkbox" checked={caps.includes(c)} disabled={!allowed.includes(c)} onChange={e=>setCaps(old=>e.target.checked?[...old,c]:old.filter(x=>x!==c))}/><span>{label}</span></label>)}<button className="button button--outline" disabled={baseRevision!==user.revision} onClick={()=>task.run(async()=>{const result=await save({token,kelasId,penggunaId:user.id,expectedRevision:baseRevision,capabilities:caps});setCaps(result.capabilities);setBaseRevision(result.revision);},'Izin tersimpan. Berlaku pada pemeriksaan server berikutnya.').catch(()=>{})}>Simpan izin {user.nama}</button></fieldset></details>;
}
