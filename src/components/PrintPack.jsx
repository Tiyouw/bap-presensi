import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import { susunPaket } from "../../bap-shared/printPlan.js";
import { hariTanggal } from "../lib/store.js";
import { pesanGalat, unduhPaket } from "../lib/presensi.js";
import Modal from "./Modal.jsx";
import { Notice } from "./Layout.jsx";

export default function PrintPack({ token, network, onClose }) {
  const available = useQuery(
    api.bap.ringkasanCetak,
    network.online ? { token } : "skip",
  );
  const generate = useAction(api.bapNode.paketCetak);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const chosen = useMemo(
    () => (available || []).filter((p) => selected.includes(p.id)),
    [available, selected],
  );
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
    }));
    try {
      const result = await generate({ token, items });
      unduhPaket(result.base64, result.fileName);
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
      {!network.online && (
        <Notice kind="warning">
          Sambungkan internet untuk membaca presensi terbaru dan membuat paket
          cetak.
        </Notice>
      )}
      {network.online && !available && (
        <p role="status">Memuat pertemuan terkunci…</p>
      )}
      {available?.length === 0 && (
        <div className="empty-state">
          <h3>Belum ada presensi terkunci</h3>
          <p>
            Isi, periksa, lalu simpan dan kunci satu pertemuan terlebih dahulu.
          </p>
        </div>
      )}
      {available?.length > 0 && (
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
                pratinjau Word sebelum mencetak.
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
      {success && (
        <Notice>
          Paket diunduh dari revisi{" "}
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
        <button
          className="button button--primary button--full"
          disabled={busy || !network.online || !chosen.length}
          onClick={download}
        >
          {busy ? "Menyiapkan paket…" : "Unduh paket cetak (.docx)"}
        </button>
      </div>
    </Modal>
  );
}
