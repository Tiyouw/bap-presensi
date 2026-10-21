import PdfPreview from "./PdfPreview.jsx";
import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import { susunPaket } from "../../bap-shared/printPlan.js";
import { hariTanggal } from "../lib/store.js";
import { pesanGalat, unduhPaket } from "../lib/presensi.js";
import Modal from "./Modal.jsx";
import { Notice } from "./Layout.jsx";
import { SkeletonRows, RefreshHint } from "./Loading.jsx";
import { usePageReady } from "../lib/usePageReady.js";
import HistoricalPacketPicker from "./HistoricalPacketPicker.jsx";

export default function PrintPack({
  token,
  network,
  onClose,
  selected,
  onSelectionChange: setSelected,
  contextMeeting,
  kelasId,
}) {
  const currentAvailable = useQuery(
    api.bap.ringkasanCetak,
    network.online ? { token, kelasId } : "skip",
  );
  const controls=useQuery(api.revisions.classAvailability,{token,kelasId});
  const [includeHistory,setIncludeHistory]=useState(false),[versionChoices,setVersionChoices]=useState({});
  const available=useMemo(()=>currentAvailable===undefined?undefined:[...new Map([...(currentAvailable||[]),...Object.values(includeHistory?versionChoices:{})].map(p=>[p.id,p])).values()], [currentAvailable,includeHistory,versionChoices]);
  const generate = useAction(api.bapNode.paketCetak);
  const ready = usePageReady(
    available !== undefined || !network.online,
    "print",
    180,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [format, setFormat] = useState("pdf");
  const [preview, setPreview] = useState(null);
  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const chosen = useMemo(
    () => (available || []).filter((p) => selected.includes(p.id)),
    [available, selected],
  );
  const selectionKey = chosen.map((p) => `${p.id}:${p.revision}`).join(",");
  useEffect(() => {
    setPreview(null);
    setSuccess(null);
  }, [selectionKey]);
  const plan = susunPaket(chosen);
  const formCount = plan.flat().length;
  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
    setError("");
    setSuccess(null);
  };
  async function download() {
    setBusy(true);
    setError("");
    setSuccess(null);
    const items = chosen.map((p) => ({
      pertemuanId: p.id,
      revision: p.revision,
      ...(p.revisionId?{revisionId:p.revisionId}:{}),
    }));
    try {
      const result = await generate({ token, kelasId, items, format });
      if (format === "pdf")
        setPreview({
          url: URL.createObjectURL(
            new Blob(
              [Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))],
              { type: "application/pdf" },
            ),
          ),
          pages: result.pageCount,
          fileName: result.fileName,
        });
      else unduhPaket(result.base64, result.fileName);
      setSuccess(result.revisions);
    } catch (err) {
      setError(pesanGalat(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Siapkan cetak" onClose={onClose} busy={busy} wide>
      <p className="modal-description">
        Pilih pertemuan terkunci. Dua form BAP disusun per folio, dari atas ke
        bawah, dengan ukuran tulisan mengikuti template.
      </p>
      <RefreshHint value={available} pending={network.online && !available} />
      {contextMeeting && (
        <p className="print-context">
          Akses cetak dari Pertemuan {contextMeeting.nomor}. Atur pilihan
          pertemuan yang ingin digabung di bawah ini. Pertemuan yang belum
          dikunci belum dapat ikut dicetak.
        </p>
      )}
      {!network.online && (
        <Notice kind="warning">
          Sambungkan internet untuk membaca presensi terbaru dan membuat paket
          cetak.
        </Notice>
      )}
      {controls?.enabled&&<><label className="mg-check"><input type="checkbox" checked={includeHistory} disabled={busy} onChange={e=>{setIncludeHistory(e.target.checked);setPreview(null);setSuccess(null);if(!e.target.checked){setVersionChoices({});setSelected(prev=>prev.filter(id=>(currentAvailable||[]).some(p=>p.id===id)))}}}/><span>Pilih versi historis, termasuk sesi dibatalkan</span></label>{includeHistory&&<HistoricalPacketPicker token={token} kelasId={kelasId} online={network.online} onChoose={row=>{setVersionChoices(old=>({...old,[row.id]:row}));setSelected(old=>old.includes(row.id)?old:[...old,row.id]);setPreview(null);setSuccess(null)}}/>}{chosen.some(p=>p.explicitVersion)&&<Notice kind="warning">Paket memuat versi yang dipilih secara eksplisit. Periksa kembali tanggal dan revisi sebelum mengunduh.</Notice>}</>}
      {!ready && <SkeletonRows title="Memuat pertemuan terkunci" rows={3} />}
      {ready && available?.length === 0 && (
        <div className="empty-state">
          <h3>Belum ada presensi terkunci</h3>
          <p>
            Isi, periksa, lalu simpan dan kunci satu pertemuan terlebih dahulu.
          </p>
        </div>
      )}
      {ready && available?.length > 0 && (
        <>
          <div className="print-selection-heading">
            <h3>Pertemuan yang dicetak</h3>
            <button
              className="button button--quiet"
              disabled={busy || !network.online}
              onClick={() => {
                setSelected(
                  chosen.length === available.length
                    ? []
                    : available.map((p) => p.id),
                );
                setSuccess(null);
              }}
            >
              {chosen.length === available.length
                ? "Hapus pilihan"
                : "Pilih semua"}
            </button>
          </div>
          <fieldset
            className="print-selection"
            disabled={busy || !network.online}
          >
            <legend className="sr-only">
              Pilih pertemuan untuk paket cetak
            </legend>
            {available.map((p) => (
              <label className="print-choice" key={p.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  aria-label={`Cetak pertemuan ${p.nomor}`}
                />
                <span>
                  <strong>Pertemuan {p.nomor}</strong>
                  <small>{hariTanggal(p.tanggal).replace(" / ", ", ")}</small>
                </span>
                <span className="print-choice-meta">
                  {p.jumlahAbsen} tidak hadir
                  <br />
                  {p.jumlahForm} form · rev {p.revision}
                </span>
              </label>
            ))}
          </fieldset>
          {chosen.length > 0 && (
            <section className="print-plan" aria-label="Susunan paket cetak">
              <h3>
                {chosen.length} pertemuan · {formCount} form
              </h3>
              <p className="muted">
                Perkiraan {plan.length} lembar folio. Form lanjutan ikut
                dihitung; nama yang panjang dapat menambah halaman. Periksa
                preview PDF atau pratinjau Word sebelum mencetak.
              </p>
              <ol className="print-sheets">
                {plan.map((sheet, i) => (
                  <li key={i}>
                    <span className="small-label">Lembar {i + 1}</span>
                    <div className="print-sheet-slots">
                      {[0, 1].map((slot) => (
                        <span key={slot}>
                          <small>{slot === 0 ? "Atas" : "Bawah"}</small>
                          {sheet[slot] ? (
                            <>
                              Pertemuan {sheet[slot].nomor}
                              {sheet[slot].lanjutan
                                ? ` · lanjutan ${sheet[slot].formKe}`
                                : ""}
                            </>
                          ) : (
                            "Kosong — jumlah form ganjil"
                          )}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {preview && (
        <section className="mg-print-preview">
          <h3>Preview paket · {preview.pages} halaman</h3>
          <PdfPreview title="Preview paket PDF" url={preview.url} />
          <a
            className="button button--primary"
            href={preview.url}
            download={preview.fileName}
          >
            Unduh paket PDF
          </a>
        </section>
      )}
      {success && (
        <Notice>
          Paket dibuat dari revisi{" "}
          {success.map((p) => `P${p.nomor}: r${p.revision}`).join(", ")}. Jika
          presensi dikoreksi setelah ini, unduh paket baru.
        </Notice>
      )}
      <details className="guide-print-help">
        <summary>Pengaturan cetak di Word</summary>
        <p>
          Pilih kertas folio sesuai ukuran dokumen: 215 × 330 mm. Gunakan skala
          100% dan 1 halaman per lembar. Susunan dua form sudah dibuat oleh
          aplikasi; jangan pilih 2 halaman per lembar lagi.
        </p>
        <p>
          Printer tetap dipilih lewat Word atau dialog cetak perangkat. Aplikasi
          menyiapkan berkasnya dan tidak mengirim langsung ke printer.
        </p>
      </details>
      <div className="modal-actions">
        <label className="mg-field">
          <span>Format paket</span>
          <select
            aria-label="Format paket"
            value={format}
            onChange={(e) => {
              setFormat(e.target.value);
              setPreview(null);
            }}
            disabled={busy}
          >
            <option value="pdf">PDF — preview sebelum cetak</option>
            <option value="docx">Word (.docx)</option>
          </select>
        </label>
        <button
          className="button button--primary button--full"
          disabled={!ready || busy || !network.online || !chosen.length}
          onClick={download}
        >
          {busy
            ? "Menyiapkan paket…"
            : format === "pdf"
              ? "Buat preview paket PDF"
              : "Unduh paket cetak (.docx)"}
        </button>
      </div>
    </Modal>
  );
}
