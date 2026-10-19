import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import { ConnectionStatus, Header, Notice } from "../components/Layout.jsx";
import Modal from "../components/Modal.jsx";
import {
  bacaDetail,
  bacaDraf,
  cadangkanDraf,
  hapusDraf,
  hariTanggal,
  simpanDetail,
  simpanDraf,
} from "../lib/store.js";
import {
  cariPeserta,
  drafValid,
  hitungStatus,
  KELAS,
  KODE,
  LABEL,
  pesanGalat,
  statusAwal,
  unduhDokumen,
  URUT_STATUS,
} from "../lib/presensi.js";

function initialState(pertemuan, peserta) {
  const cached = bacaDetail(pertemuan.id);
  // Bootstrap can be newer than a cached detail: never roll its revision back.
  const cacheMatches =
    cached?.pertemuan?.revision === pertemuan.revision &&
    cached?.pertemuan?.status === pertemuan.status &&
    Array.isArray(cached.presensi);
  const record = pertemuan;
  const draft = bacaDraf(pertemuan.id);
  const valid = drafValid(draft, peserta);
  const useDraft =
    valid &&
    (record.status !== "KUNCI" || draft.baseRevision !== record.revision);
  return {
    record,
    statuses: useDraft
      ? Object.fromEntries(peserta.map((p) => [p.id, draft.statuses[p.id]]))
      : statusAwal(peserta, cacheMatches ? cached.presensi : []),
    base: useDraft ? draft.baseRevision : record.revision,
    dirty: useDraft,
    conflict: useDraft && draft.baseRevision !== record.revision,
    known: record.status !== "KUNCI" || cacheMatches,
    restored: useDraft ? draft.ts : null,
  };
}

export default function Presensi({
  token,
  pertemuan,
  peserta,
  network,
  onKembali,
}) {
  const detail = useQuery(api.sesi.detail, {
    token,
    pertemuanId: pertemuan.id,
  });
  const bapAda = useQuery(api.bap.forSesi, {
    token,
    pertemuanId: pertemuan.id,
  });
  const simpanKunci = useMutation(api.sesi.simpanDanKunci);
  const bukaKunci = useMutation(api.sesi.bukaKunci);
  const generate = useAction(api.bapNode.generate);
  const [initial] = useState(() => initialState(pertemuan, peserta));
  const [record, setRecord] = useState(initial.record);
  const [status, setStatus] = useState(initial.statuses);
  const [baseRevision, setBase] = useState(initial.base);
  const [dirty, setDirty] = useState(initial.dirty);
  const [known, setKnown] = useState(initial.known);
  const [konflik, setKonflik] = useState(initial.conflict);
  const [mode, setMode] = useState("ALPHA");
  const [gol, setGol] = useState("SEMUA");
  const [cari, setCari] = useState("");
  const [riwayat, setRiwayat] = useState([]);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [sibuk, setSibuk] = useState("");
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState(
    initial.restored
      ? `Draf dari ${new Date(initial.restored).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} dipulihkan.`
      : "",
  );
  const [drafAman, setDrafAman] = useState(true);
  const [generated, setGenerated] = useState(null);
  const [docPending, setDocPending] = useState(false);
  const dirtyRef = useRef(initial.dirty);
  const operationRef = useRef("");
  const syncedRef = useRef("");
  const footerRef = useRef(null);
  const layoutRef = useRef(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      layoutRef.current?.style.setProperty(
        "--footer-height",
        `${entry.target.getBoundingClientRect().height}px`,
      );
    });
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  const terkunci = record.status === "KUNCI";
  const canEdit = !terkunci && !sibuk && !konflik && known;
  const daftar = useMemo(
    () => cariPeserta(peserta, gol, cari),
    [peserta, gol, cari],
  );
  const golongan = useMemo(
    () => [...new Set(peserta.map((p) => p.golongan))].sort(),
    [peserta],
  );
  const counts = useMemo(
    () => hitungStatus(peserta, status),
    [peserta, status],
  );
  const absen = useMemo(
    () => peserta.filter((p) => status[p.id] && status[p.id] !== "HADIR"),
    [peserta, status],
  );
  const orangBuka =
    modal?.kind === "person" ? daftar.find((p) => p.id === modal.id) : null;
  const indeksBuka = orangBuka ? daftar.indexOf(orangBuka) : -1;
  const currentDoc =
    terkunci && !konflik
      ? [generated, bapAda].find(
          (doc) => doc?.url && doc.revision === record.revision,
        )
      : null;
  const bapUsang = Boolean(
    bapAda?.url && (!terkunci || bapAda.revision !== record.revision),
  );
  const fileName = `BAP_${KELAS.kode}_P${String(record.nomor).padStart(2, "0")}_${record.tanggal}_r${record.revision}.docx`;

  useEffect(() => {
    if (!detail) return;
    simpanDetail(pertemuan.id, detail);
    if (operationRef.current) return;
    const key = `${detail.pertemuan.revision}:${detail.pertemuan.status}`;
    if (syncedRef.current === key) return;
    syncedRef.current = key;
    if (dirtyRef.current && detail.pertemuan.revision !== baseRevision) {
      setKonflik(true);
      return; // Keep the draft and its base revision. Reactivity must not erase edits.
    }
    setRecord(detail.pertemuan);
    setKnown(true);
    if (!dirtyRef.current || detail.pertemuan.status === "KUNCI") {
      setStatus(statusAwal(peserta, detail.presensi));
      setBase(detail.pertemuan.revision);
      setDirty(false);
      dirtyRef.current = false;
      setRiwayat([]);
    }
  }, [detail, peserta, pertemuan.id, baseRevision, sibuk]);

  useEffect(() => {
    if (!dirty || terkunci || !peserta.length) return;
    setDrafAman(simpanDraf(pertemuan.id, { baseRevision, statuses: status }));
  }, [status, baseRevision, dirty, terkunci, pertemuan.id, peserta.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!dirty || drafAman) return;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, drafAman]);

  function setSatu(pesertaId, nilai) {
    if (!canEdit || status[pesertaId] === nilai) return;
    setRiwayat((previous) => [
      ...previous.slice(-19),
      { pesertaId, sebelum: status[pesertaId] },
    ]);
    setStatus((previous) => ({ ...previous, [pesertaId]: nilai }));
    setDirty(true);
    dirtyRef.current = true;
    setToast({
      nama: peserta.find((p) => p.id === pesertaId)?.nama,
      status: nilai,
      key: Date.now(),
    });
  }

  function undo() {
    if (!canEdit || !riwayat.length) return;
    const last = riwayat[riwayat.length - 1];
    setStatus((previous) => ({ ...previous, [last.pesertaId]: last.sebelum }));
    setRiwayat((previous) => previous.slice(0, -1));
    setToast(null);
    setDirty(true);
    dirtyRef.current = true;
  }

  function muatServer() {
    if (!detail) return;
    if (
      dirtyRef.current &&
      !cadangkanDraf(pertemuan.id, { baseRevision, statuses: status })
    ) {
      setGalat(
        "Draf belum dapat dicadangkan. Kosongkan ruang penyimpanan perangkat sebelum mengganti draf.",
      );
      return;
    }
    setStatus(statusAwal(peserta, detail.presensi));
    setRecord(detail.pertemuan);
    setBase(detail.pertemuan.revision);
    setKonflik(false);
    setDirty(false);
    dirtyRef.current = false;
    setKnown(true);
    setRiwayat([]);
    setModal(null);
    setGalat("");
    hapusDraf(pertemuan.id);
    setInfo(
      "Data server dimuat. Salinan draf sebelumnya tetap disimpan di perangkat.",
    );
  }

  function gunakanDraf() {
    if (!detail || detail.pertemuan.status === "KUNCI") return;
    setRecord(detail.pertemuan);
    setBase(detail.pertemuan.revision);
    setKonflik(false);
    setKnown(true);
    setDirty(true);
    dirtyRef.current = true;
    setModal(null);
    setGalat("");
    setInfo(
      "Draf perangkat dipertahankan. Periksa daftar, lalu simpan dan kunci untuk mengirimnya.",
    );
  }

  async function buatBap() {
    setSibuk("generate");
    setDocPending(false);
    setGalat("");
    try {
      const hasil = await generate({ token, pertemuanId: pertemuan.id });
      if (hasil.status === "READY" && hasil.url) {
        setGenerated(hasil);
        setInfo("BAP siap diunduh.");
      } else {
        setDocPending(true);
        setInfo(
          "Presensi terkunci. BAP sedang diproses; hasilnya akan muncul setelah siap.",
        );
      }
    } catch (error) {
      setGalat(pesanGalat(error));
    } finally {
      setSibuk("");
    }
  }

  async function simpan() {
    if (!network.online || !canEdit || operationRef.current) return;
    setModal(null);
    setGalat("");
    setInfo("");
    setToast(null);
    operationRef.current = "save";
    setSibuk("simpan");
    try {
      const statuses = peserta.map((p) => ({
        pesertaId: p.id,
        status: status[p.id] || "HADIR",
      }));
      const hasil = await simpanKunci({
        token,
        pertemuanId: pertemuan.id,
        baseRevision,
        statuses,
      });
      const nextRecord = {
        ...record,
        status: "KUNCI",
        revision: hasil.revision,
      };
      setRecord(nextRecord);
      setBase(hasil.revision);
      setDirty(false);
      dirtyRef.current = false;
      setRiwayat([]);
      hapusDraf(pertemuan.id);
      simpanDetail(pertemuan.id, { pertemuan: nextRecord, presensi: statuses });
      setInfo("Presensi tersimpan dan terkunci. Menyiapkan BAP…");
      await buatBap(); // Generator failures never turn a successful save into a failed save.
    } catch (error) {
      setGalat(pesanGalat(error));
      if (String(error?.data || error?.message).includes("KONFLIK_REVISI"))
        setKonflik(true);
    } finally {
      operationRef.current = "";
      setSibuk("");
    }
  }

  async function bukaKuncinya() {
    if (!network.online || operationRef.current) return;
    operationRef.current = "unlock";
    setSibuk("buka");
    setGalat("");
    try {
      await bukaKunci({ token, pertemuanId: pertemuan.id });
      setRecord((previous) => ({ ...previous, status: "TERBUKA" }));
      setGenerated(null);
      setModal(null);
      setKonflik(false);
      syncedRef.current = "";
      setInfo(
        "Presensi dibuka. Koreksi lalu simpan kembali untuk membuat BAP yang sesuai.",
      );
    } catch (error) {
      setGalat(pesanGalat(error));
    } finally {
      operationRef.current = "";
      setSibuk("");
    }
  }

  async function unduh() {
    if (!currentDoc || !network.online || sibuk) return;
    setSibuk("unduh");
    setGalat("");
    try {
      await unduhDokumen(currentDoc.url, fileName);
      setInfo("Unduhan BAP dimulai.");
    } catch {
      setGalat(
        "BAP sudah tersedia, tetapi unduhan belum berhasil. Periksa koneksi lalu coba unduh lagi.",
      );
    } finally {
      setSibuk("");
    }
  }

  const draftLabel = !drafAman
    ? "Draf belum tersimpan"
    : konflik
      ? "Draf perangkat ini"
      : terkunci
        ? "Presensi tersimpan di server"
        : dirty
          ? "Draf tersimpan di perangkat"
          : "Semua hadir secara default";
  const primaryLabel =
    sibuk === "simpan"
      ? network.online
        ? "Menyimpan presensi…"
        : "Menunggu konfirmasi server…"
      : sibuk === "generate"
        ? "Menyiapkan BAP…"
        : sibuk === "unduh"
          ? "Menyiapkan unduhan…"
          : terkunci
            ? currentDoc
              ? "Unduh BAP (.docx)"
              : docPending
                ? "Periksa BAP"
                : "Buat BAP (.docx)"
            : "Simpan & Kunci";
  const primaryAction = terkunci
    ? currentDoc
      ? unduh
      : buatBap
    : () => setModal({ kind: "review" });
  const primaryDisabled = Boolean(
    sibuk ||
    !network.online ||
    konflik ||
    !known ||
    !peserta.length ||
    (!terkunci && !detail),
  );

  return (
    <div className="attendance-layout" ref={layoutRef}>
      <Header
        onKembali={() => {
          if (dirty && !drafAman) setModal({ kind: "unsaved" });
          else onKembali();
        }}
        onBap={() => setModal({ kind: "bap" })}
        onUndo={undo}
        undoDisabled={!canEdit || !riwayat.length}
        busy={Boolean(sibuk)}
      />
      <main className="page attendance-page">
        <div className="attendance-heading">
          <div>
            <p className="eyebrow">{KELAS.nama}</p>
            <h1>PRESENSI</h1>
            <p className="attendance-date">
              {hariTanggal(record.tanggal).replace(" / ", ", ")}{" "}
              <span>· Ruang {record.tempat}</span>
            </p>
          </div>
          <span
            className="attendance-number"
            aria-label={`Pertemuan ${record.nomor}`}
          >
            {String(record.nomor).padStart(2, "0")}
          </span>
        </div>
        <div className="attendance-meta">
          <span
            className={`session-badge${terkunci ? " session-badge--locked" : ""}`}
          >
            {konflik
              ? "Periksa perubahan"
              : terkunci
                ? "Terkunci"
                : "Draf presensi"}
          </span>
          <ConnectionStatus network={network} />
        </div>
        {!network.online && (
          <Notice kind="warning">
            {network.deviceOnline
              ? "Koneksi server belum tersambung. "
              : "Kamu sedang offline. "}
            Draf bisa diedit; sambungkan internet untuk mengunci dan membuat
            BAP.
          </Notice>
        )}
        {!drafAman && (
          <Notice kind="error">
            Draf belum tersimpan di perangkat. Jangan tutup halaman; periksa
            ruang penyimpanan atau sambungkan internet untuk menyimpan ke
            server.
          </Notice>
        )}
        {konflik && (
          <Notice
            kind="warning"
            actions={
              <>
                <button
                  className="button button--outline"
                  disabled={!detail}
                  onClick={() => setModal({ kind: "conflict" })}
                >
                  Periksa perubahan
                </button>
              </>
            }
          >
            Data di server lebih baru. Ringkasan di bawah adalah draf perangkat
            ini. Draf tidak ditimpa otomatis.
          </Notice>
        )}
        {galat && <Notice kind="error">{galat}</Notice>}
        {info && <Notice kind="info">{info}</Notice>}
        {terkunci && !konflik && (
          <section className="locked-summary">
            <div>
              <strong>
                {currentDoc
                  ? "BAP siap diunduh"
                  : sibuk === "generate" || docPending
                    ? "BAP sedang disiapkan"
                    : "Presensi sudah terkunci"}
              </strong>
              <p>
                {currentDoc
                  ? `Dokumen untuk presensi revisi ${record.revision}.`
                  : "Data kehadiran aman. BAP dapat dibuat dari presensi ini."}
              </p>
            </div>
            <button
              className="button button--outline"
              disabled={!network.online || Boolean(sibuk) || !known}
              onClick={() => setModal({ kind: "unlock" })}
            >
              Buka kunci
            </button>
          </section>
        )}
        {!known && (
          <Notice kind="warning">
            Rincian presensi terkunci belum tersedia di perangkat. Sambungkan
            internet untuk melihat status yang tersimpan.
          </Notice>
        )}
        {bapUsang && !konflik && (
          <Notice kind="warning">
            BAP sebelumnya berasal dari presensi lama. Kunci koreksi dan buat
            BAP baru sebelum mencetak.
          </Notice>
        )}

        <section
          className="attendance-stats"
          aria-label={
            konflik ? "Ringkasan draf perangkat" : "Ringkasan seluruh kelas"
          }
          aria-live="polite"
        >
          {["HADIR", "ALPHA", "SAKIT", "IZIN"].map((s) => (
            <div key={s} className={`attendance-stat ${s}`}>
              <strong>{known ? counts[s] : "—"}</strong>
              <span>{LABEL[s]}</span>
            </div>
          ))}
        </section>

        <section className="roster-section" aria-label="Presensi mahasiswa">
          <div className="roster-tools">
            <div className="group-filters" aria-label="Filter golongan">
              {["SEMUA", ...golongan].map((g) => (
                <button
                  key={g}
                  className={`filter-button${gol === g ? " is-active" : ""}`}
                  aria-pressed={gol === g}
                  onClick={() => setGol(g)}
                >
                  {g === "SEMUA" ? "Semua" : g}
                </button>
              ))}
            </div>
            <label className="search-field">
              <span className="sr-only">Cari nama atau NIM</span>
              <input
                type="search"
                placeholder="Cari nama atau NIM"
                value={cari}
                onChange={(event) => setCari(event.target.value)}
              />
            </label>
            {!terkunci && (
              <div className="brush-toolbar">
                <div className="brush-label">
                  <span>Tandai sebagai</span>
                  <span>Ketuk nama untuk mengubah</span>
                </div>
                <div className="brush-modes" aria-label="Mode status">
                  {URUT_STATUS.map((s) => (
                    <button
                      key={s}
                      aria-pressed={mode === s}
                      className={mode === s ? "is-active" : ""}
                      disabled={!canEdit}
                      onClick={() => setMode(s)}
                    >
                      <span className="status-code">{KODE[s]}</span>
                      {LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="roster-label">
            <span>
              Mahasiswa <span className="roster-count">{daftar.length}</span>
              {gol !== "SEMUA" && <span> · Golongan {gol}</span>}
            </span>
            <span>{terkunci ? "Tersimpan" : "Status"}</span>
          </div>
          <div className="student-list">
            {daftar.map((p) => (
              <div className="student-row" key={p.id}>
                <button
                  className="student-main"
                  disabled={!canEdit}
                  onClick={() => setSatu(p.id, mode)}
                  aria-label={`${p.nama}, ${known ? LABEL[status[p.id] || "HADIR"] : "belum dimuat"}${canEdit ? `. Tandai ${LABEL[mode]}` : ""}`}
                >
                  <span className="student-number" aria-hidden="true">
                    {String(p.urut ?? peserta.indexOf(p) + 1).padStart(2, "0")}
                  </span>
                  <span className="student-copy">
                    <strong>{p.nama}</strong>
                    <span>
                      {p.nim} · Gol. {p.golongan}
                    </span>
                  </span>
                  <span
                    className={`status-badge ${known ? status[p.id] || "HADIR" : ""}`}
                  >
                    {known ? LABEL[status[p.id] || "HADIR"] : "—"}
                  </span>
                </button>
                <button
                  className="student-edit"
                  disabled={!canEdit}
                  aria-label={`Ubah status ${p.nama}`}
                  onClick={() => setModal({ kind: "person", id: p.id })}
                >
                  ⋯
                </button>
              </div>
            ))}
            {!daftar.length && (
              <div className="empty-state">
                <h3>Nama atau NIM tidak ditemukan</h3>
                <p>Coba kata lain atau tampilkan semua golongan.</p>
                <button
                  className="button button--outline"
                  onClick={() => {
                    setCari("");
                    setGol("SEMUA");
                  }}
                >
                  Hapus pencarian
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="attendance-footer" ref={footerRef}>
        <div className="attendance-footer-inner">
          <div className="save-summary">
            <span className={!drafAman ? "text-error" : ""}>{draftLabel}</span>
            <strong>
              {known
                ? `${absen.length} tidak hadir · ${peserta.length} mahasiswa`
                : "Menunggu rincian presensi"}
            </strong>
          </div>
          <button
            className="button button--primary"
            disabled={primaryDisabled}
            onClick={primaryAction}
          >
            {primaryLabel}
            <span aria-hidden="true">{terkunci ? "↓" : "→"}</span>
          </button>
          {!network.online && (
            <p className="footer-hint">
              Mengunci dan mengunduh membutuhkan koneksi.
            </p>
          )}
        </div>
      </footer>
      {toast && canEdit && (
        <div className="undo-toast" role="status">
          <span>
            {toast.nama} → {LABEL[toast.status]}
          </span>
          <button onClick={undo}>Urungkan</button>
        </div>
      )}

      {modal?.kind === "unsaved" && (
        <Modal title="Draf belum tersimpan" onClose={() => setModal(null)}>
          <p className="modal-description">
            Penyimpanan perangkat belum berhasil. Kembali ke daftar sekarang
            akan menghilangkan perubahan yang belum tersimpan. Tetap di presensi
            untuk menyimpan ke server setelah koneksi tersedia.
          </p>
          <div className="modal-actions">
            <button
              className="button button--primary button--full"
              onClick={() => setModal(null)}
            >
              Tetap di presensi
            </button>
            <button
              className="button button--quiet button--full"
              onClick={onKembali}
            >
              Keluar tanpa menyimpan
            </button>
          </div>
        </Modal>
      )}

      {modal?.kind === "person" && orangBuka && (
        <Modal title={orangBuka.nama} onClose={() => setModal(null)}>
          <p className="modal-description">
            {orangBuka.nim} · Golongan {orangBuka.golongan}
          </p>
          <div className="person-modes">
            {URUT_STATUS.map((s) => (
              <button
                key={s}
                aria-pressed={status[orangBuka.id] === s}
                className={status[orangBuka.id] === s ? "is-active" : ""}
                disabled={!canEdit}
                onClick={() => setSatu(orangBuka.id, s)}
              >
                <span className={`status-dot ${s}`} aria-hidden="true" />
                {LABEL[s]}
              </button>
            ))}
          </div>
          <div className="person-navigation">
            <button
              className="button button--outline"
              disabled={indeksBuka <= 0}
              onClick={() =>
                setModal({ kind: "person", id: daftar[indeksBuka - 1].id })
              }
            >
              ← Sebelumnya
            </button>
            <button
              className="button button--outline"
              disabled={indeksBuka >= daftar.length - 1}
              onClick={() =>
                setModal({ kind: "person", id: daftar[indeksBuka + 1].id })
              }
            >
              Berikutnya →
            </button>
          </div>
        </Modal>
      )}

      {modal?.kind === "review" && (
        <Modal title="Periksa presensi" onClose={() => setModal(null)}>
          <p className="modal-description">
            Pertemuan {record.nomor} ·{" "}
            {hariTanggal(record.tanggal).replace(" / ", ", ")}
          </p>
          <div className="review-stats">
            {["HADIR", "ALPHA", "SAKIT", "IZIN"].map((s) => (
              <span key={s} className={`status-badge ${s}`}>
                {counts[s]} {LABEL[s]}
              </span>
            ))}
          </div>
          {absen.length ? (
            <ul className="review-list">
              {absen.map((p) => (
                <li key={p.id}>
                  <span>
                    <strong>{p.nama}</strong>
                    <small>
                      Golongan {p.golongan} · {p.nim}
                    </small>
                  </span>
                  <span className={`status-badge ${status[p.id]}`}>
                    {LABEL[status[p.id]]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="all-present">
              Semua {peserta.length} mahasiswa dicatat hadir.
            </div>
          )}
          <p className="modal-help">
            Setelah dikunci, perubahan perlu membuka kunci presensi. BAP dibuat
            dari data yang sama.
          </p>
          <div className="modal-actions">
            <button
              className="button button--primary button--full"
              disabled={primaryDisabled}
              onClick={simpan}
            >
              Kunci sekarang<span aria-hidden="true">→</span>
            </button>
            <button
              className="button button--quiet button--full"
              onClick={() => setModal(null)}
            >
              Kembali periksa
            </button>
          </div>
        </Modal>
      )}

      {modal?.kind === "unlock" && (
        <Modal
          title="Buka kunci presensi?"
          onClose={() => setModal(null)}
          busy={Boolean(sibuk)}
        >
          <p className="modal-description">
            Kamu dapat memperbaiki status mahasiswa. BAP sebelumnya menjadi
            usang sampai koreksi dikunci dan BAP dibuat kembali.
          </p>
          <div className="modal-actions">
            <button
              className="button button--primary button--full"
              disabled={!network.online || Boolean(sibuk)}
              onClick={bukaKuncinya}
            >
              {sibuk ? "Membuka kunci…" : "Buka kunci & koreksi"}
            </button>
            <button
              className="button button--quiet button--full"
              disabled={Boolean(sibuk)}
              onClick={() => setModal(null)}
            >
              Batal
            </button>
          </div>
        </Modal>
      )}

      {modal?.kind === "conflict" && (
        <Modal title="Data server sudah berubah" onClose={() => setModal(null)}>
          <p className="modal-description">
            Draf ini dimulai dari revisi {baseRevision}. Data server{" "}
            {detail
              ? `sudah revisi ${detail.pertemuan.revision}`
              : "belum tersambung"}
            . Pilih data yang ingin ditampilkan; tidak ada penggabungan
            otomatis.
          </p>
          <div className="modal-actions">
            <button
              className="button button--primary button--full"
              disabled={!detail}
              onClick={muatServer}
            >
              Muat data server
            </button>
            <p className="modal-help">
              Draf perangkat dicadangkan sebelum data diganti.
            </p>
            {detail?.pertemuan.status === "TERBUKA" && (
              <button
                className="button button--outline button--full"
                onClick={() => setModal({ kind: "keep-draft" })}
              >
                Pertahankan draf perangkat
              </button>
            )}
            {detail?.pertemuan.status === "KUNCI" && (
              <p className="modal-help">
                Presensi server terkunci. Muat data server untuk melihat
                hasilnya dan membuka kunci jika perlu koreksi.
              </p>
            )}
          </div>
        </Modal>
      )}
      {modal?.kind === "keep-draft" && (
        <Modal
          title="Gunakan draf perangkat ini?"
          onClose={() => setModal(null)}
        >
          <p className="modal-description">
            Saat disimpan nanti, seluruh status pada draf ini akan menggantikan
            presensi server. Periksa nama-nama tidak hadir sebelum mengunci.
          </p>
          <button
            className="button button--primary button--full"
            disabled={!network.online || detail?.pertemuan.status !== "TERBUKA"}
            onClick={gunakanDraf}
          >
            Gunakan draf ini
          </button>
          <button
            className="button button--quiet button--full"
            onClick={() => setModal(null)}
          >
            Batal
          </button>
        </Modal>
      )}

      {modal?.kind === "bap" && (
        <Modal
          title="Dokumen BAP"
          onClose={() => setModal(null)}
          busy={Boolean(sibuk)}
        >
          <p className="modal-description">
            Pertemuan {record.nomor} ·{" "}
            {hariTanggal(record.tanggal).replace(" / ", ", ")}
          </p>
          <div className="document-preview" aria-label="Informasi dokumen">
            <span className="document-type">DOCX</span>
            <h3>
              {currentDoc
                ? "BAP siap diunduh"
                : terkunci
                  ? "Presensi sudah terkunci"
                  : "Kunci presensi lebih dulu"}
            </h3>
            <p>
              {currentDoc
                ? fileName
                : terkunci
                  ? "Buat dokumen dari presensi tersimpan. Format mengikuti template resmi prodi."
                  : "Periksa daftar mahasiswa, lalu simpan dan kunci untuk membuat BAP."}
            </p>
            {currentDoc && (
              <span className="muted">
                Revisi presensi {record.revision} · Word (.docx)
              </span>
            )}
          </div>
          {galat && <Notice kind="error">{galat}</Notice>}
          <div className="modal-actions">
            {terkunci ? (
              <button
                className="button button--primary button--full"
                disabled={primaryDisabled}
                onClick={currentDoc ? unduh : buatBap}
              >
                {primaryLabel}
              </button>
            ) : (
              <button
                className="button button--primary button--full"
                disabled={!canEdit || !network.online || !detail}
                onClick={() => setModal({ kind: "review" })}
              >
                Periksa presensi
              </button>
            )}
            <button
              className="button button--quiet button--full"
              disabled={Boolean(sibuk)}
              onClick={() => setModal(null)}
            >
              Kembali ke presensi
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
