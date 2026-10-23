import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import { ConnectionStatus, Header, Notice } from "../components/Layout.jsx";
import Modal from "../components/Modal.jsx";
import ModePanggil, { PanggilIcon } from "../components/ModePanggil.jsx";
import { progresPanggil } from "../lib/panggil.js";
import { RefreshHint, SkeletonRows } from "../components/Loading.jsx";
import { usePageReady } from "../lib/usePageReady.js";
import { useScopedStore } from "../lib/ScopedStorage.jsx";
import { registerNavigationGuard } from "../lib/navigation.js";
import { reconcileDraft, rosterData, rosterKey } from "../lib/draft.js";
import { useDraftLock } from "../lib/useDraftLock.js";
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

function initialState(pertemuan, peserta, store, resumeDraft) {
  const cached = store.bacaDetail(pertemuan.id);
  // Bootstrap can be newer than a cached detail: never roll its revision back.
  const cacheMatches =
    cached?.pertemuan?.revision === pertemuan.revision &&
    cached?.pertemuan?.status === pertemuan.status &&
    Array.isArray(cached.presensi);
  const record = pertemuan;
  const local = store.bacaDraf(pertemuan.id);
  const memoryResume = Boolean(resumeDraft && (!local || resumeDraft.baseRevision > local.baseRevision ||
    (resumeDraft.baseRevision === local.baseRevision && resumeDraft.ts > (local.ts || 0))));
  const draft = memoryResume ? resumeDraft : local;
  const reconciled = reconcileDraft(draft, peserta, cacheMatches ? cached.presensi : []);
  const valid = Boolean(reconciled);
  const useDraft =
    valid &&
    (record.status !== "KUNCI" || draft.baseRevision !== record.revision);
  return {
    record,
    statuses: useDraft
      ? reconciled.statuses
      : statusAwal(peserta, cacheMatches ? cached.presensi : []),
    base: useDraft ? draft.baseRevision : record.revision,
    dirty: useDraft,
    conflict: useDraft && draft.baseRevision !== record.revision,
    known: record.status !== "KUNCI" || cacheMatches,
    restored: useDraft ? draft.ts : null,
    panggil:
      useDraft && draft.baseRevision === record.revision ? draft.panggil : null,
    rosterReview: useDraft && reconciled.needsRosterReview,
    rosterReviewIds: useDraft ? reconciled.rosterReviewIds : [],
    backup: useDraft && reconciled.rosterChanged ? draft : null,
    memoryResume,
  };
}

export default function Presensi({
  token,
  pertemuan,
  peserta,
  network,
  onKembali,
  onEditMeeting,
  onHelp,
  onPrint,
  kelas,
  readOnly = false,
  resumeDraft,
  snapshotControls,
  onResumeCleared,
}) {
  const store = useScopedStore();
  const { simpanDetail, bacaDraf, simpanDraf, hapusDraf, cadangkanDraf } =
    store;
  const classInfo = kelas
    ? { nama: kelas.matkulNama, kode: kelas.matkulKode }
    : KELAS;
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
  const [initial] = useState(() => initialState(pertemuan, peserta, store, resumeDraft));
  const pageReady = usePageReady(
    Boolean(detail) || !network.online,
    pertemuan.id,
  );
  const [record, setRecord] = useState(initial.record);
  const [status, setStatus] = useState(initial.statuses);
  const [baseRevision, setBase] = useState(initial.base);
  const [dirty, setDirty] = useState(initial.dirty);
  const [known, setKnown] = useState(initial.known);
  const [konflik, setKonflik] = useState(initial.conflict);
  const [mode, setMode] = useState("ALPHA");
  const [gol, setGol] = useState(null);
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
  const [panggil, setPanggil] = useState(initial.panggil);
  const panggilTriggerRef = useRef(null);
  const [autoPanggil, setAutoPanggil] = useState(() =>
    store.bacaPreferensiPanggil("preferences"),
  );
  const [autoKeluarPanggil, setAutoKeluarPanggil] = useState(() =>
    store.bacaKeluarOtomatisPanggil("preferences"),
  );
  const [preferensiAman, setPreferensiAman] = useState(true);
  const [remainingApproved, setRemainingApproved] = useState(false);
  const [rosterReview, setRosterReview] = useState(initial.rosterReview);
  const [rosterReviewIds, setRosterReviewIds] = useState(initial.rosterReviewIds);
  const [rosterApproved, setRosterApproved] = useState(false);
  const backupRef = useRef(initial.backup);
  const previousRoster = useRef(rosterData(peserta));
  const progres = progresPanggil(panggil, peserta, baseRevision);
  const persistedDraftRef = useRef(
    JSON.stringify({
      baseRevision: initial.base,
      statuses: initial.statuses,
      panggil: progresPanggil(initial.panggil, peserta, initial.base),
    }),
  );
  const belumDiperiksa = progres.started
    ? peserta.filter((p) => !progres.reviewedIds.includes(p.id))
    : [];
  useEffect(() => {
    setRemainingApproved(false);
    setRosterApproved(false);
  }, [modal?.kind]);
  useEffect(
    () =>
      registerNavigationGuard(() =>
        sibuk
          ? {
              block: true,
              message: "Tunggu proses selesai sebelum berpindah halaman.",
            }
          : dirty && !drafAman
            ? {
                message:
                  "Draf belum tersimpan karena penyimpanan perangkat penuh. Tetap tinggalkan halaman dan buang perubahan?",
              }
            : null,
      ),
    [sibuk, dirty, drafAman],
  );
  const [generated, setGenerated] = useState(null);
  const [docPending, setDocPending] = useState(false);
  const dirtyRef = useRef(initial.dirty);
  const operationRef = useRef("");
  const syncedRef = useRef("");
  const footerRef = useRef(null);
  const layoutRef = useRef(null);
  const editor = useDraftLock(`${store.scope}:${pertemuan.id}`, () => {
    const latest = initialState(pertemuan, peserta, store, resumeDraft);
    setRecord(latest.record);
    setStatus(latest.statuses);
    setBase(latest.base);
    setDirty(latest.dirty);
    dirtyRef.current = latest.dirty;
    setKnown(latest.known);
    setKonflik(latest.conflict);
    setPanggil(latest.panggil);
    setRosterReview(latest.rosterReview);
    setRosterReviewIds(latest.rosterReviewIds);
    backupRef.current = latest.backup;
    previousRoster.current = rosterData(peserta);
    persistedDraftRef.current = latest.backup || latest.memoryResume ? "" : JSON.stringify({
      baseRevision: latest.base, statuses: latest.statuses,
      panggil: progresPanggil(latest.panggil, peserta, latest.base),
      roster: rosterData(peserta), needsRosterReview: latest.rosterReview,
      rosterReviewIds: latest.rosterReviewIds,
    });
    syncedRef.current = "";
    if (resumeDraft && !latest.memoryResume) onResumeCleared?.();
  });
  const makeDraft = () => ({ baseRevision, statuses: status, panggil: progres,
    roster: previousRoster.current, needsRosterReview: rosterReview, rosterReviewIds });
  if (snapshotControls) snapshotControls.current = {
    prepare() {
      if (!editor.owns() || readOnly || konflik || operationRef.current)
        throw Error("Perbarui snapshot dari tab yang sedang mengedit setelah konflik diselesaikan.");
      const draft = makeDraft();
      if (!cadangkanDraf(pertemuan.id, draft))
        throw Error("Draf belum dapat dicadangkan. Kosongkan ruang penyimpanan sebelum memperbarui snapshot.");
      operationRef.current = "snapshot";
      setSibuk("snapshot");
      return draft;
    },
    abort() { operationRef.current = ""; setSibuk(""); },
  };

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      layoutRef.current?.style.setProperty(
        "--footer-height",
        `${entry.target.getBoundingClientRect().height}px`,
      );
    });
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, [pageReady]);

  const terkunci = record.status === "KUNCI";
  const canEdit = editor.owned && !readOnly && !terkunci && !sibuk && !konflik && known;
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
  const fileName = `BAP_${classInfo.kode}_P${String(record.nomor).padStart(2, "0")}_${record.tanggal}_r${record.revision}.docx`;

  useEffect(() => {
    if (!detail) return;
    simpanDetail(pertemuan.id, detail);
    if (operationRef.current) return;
    const key = `${detail.pertemuan.revision}:${detail.pertemuan.status}:${rosterKey(peserta)}`;
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
      setPanggil(null);
      setRosterReview(false);
      setRosterReviewIds([]);
      previousRoster.current = rosterData(peserta);
    } else if (rosterKey(previousRoster.current) !== rosterKey(peserta)) {
      const draft = makeDraft();
      const next = reconcileDraft(draft, peserta, detail.presensi);
      if (next) {
        backupRef.current = draft;
        previousRoster.current = rosterData(peserta);
        setStatus(next.statuses);
        setRosterReview(next.needsRosterReview);
        setRosterReviewIds(next.rosterReviewIds);
        setRosterApproved(false);
        setRiwayat([]);
      }
    }
  }, [detail, peserta, pertemuan.id, baseRevision, sibuk]);

  useEffect(() => {
    if (!editor.owns() || !dirty || terkunci || !peserta.length) return;
    // A roster effect will reconcile first. Never persist a new roster with old statuses.
    if (rosterKey(previousRoster.current) !== rosterKey(peserta) || !drafValid({ baseRevision, statuses: status }, peserta)) return;
    if (backupRef.current) {
      if (!cadangkanDraf(pertemuan.id, backupRef.current)) { setDrafAman(false); return; }
      backupRef.current = null;
    }
    const draft = { ...makeDraft(), roster: rosterData(peserta) };
    const serialized = JSON.stringify(draft);
    if (persistedDraftRef.current === serialized) return;
    const saved = simpanDraf(pertemuan.id, draft);
    if (saved) persistedDraftRef.current = serialized;
    if (saved && resumeDraft) onResumeCleared?.();
    setDrafAman(saved);
  }, [status, panggil, baseRevision, dirty, terkunci, pertemuan.id, peserta, rosterReview, rosterReviewIds, editor.owned]);

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
    if (!editor.owns() || !canEdit || status[pesertaId] === nilai) return;
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

  function ubahPanggil(patch) {
    if (!canEdit) return;
    setPanggil((previous) => {
      const next = {
        ...progresPanggil(previous, peserta, baseRevision),
        ...patch,
      };
      if (patch.currentId) {
        const person = peserta.find((p) => p.id === patch.currentId);
        if (person) {
          next.groupKey = String(person.golongan ?? "");
          next.positions = { ...next.positions, [next.groupKey]: person.id };
        }
      }
      return progresPanggil(next, peserta, baseRevision);
    });
    setDirty(true);
    dirtyRef.current = true;
  }

  function pilihPanggil(id, nilai) {
    if (!canEdit) return;
    setSatu(id, nilai);
    ubahPanggil({
      reviewedIds: [...new Set([...progres.reviewedIds, id])],
      started: true,
    });
  }

  function bukaPanggil(lanjutBelum = false) {
    if (!canEdit || !peserta.length) return;
    if (lanjutBelum && belumDiperiksa.length)
      ubahPanggil({ currentId: belumDiperiksa[0].id });
    setModal({
      kind:
        !lanjutBelum && progres.reviewedIds.length === peserta.length
          ? "review"
          : "panggil",
      resume: lanjutBelum,
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
    if (!detail || !editor.owns()) return;
    if (
      dirtyRef.current &&
      !cadangkanDraf(pertemuan.id, makeDraft())
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
    setPanggil(null);
    setRosterReview(false);
    setRosterReviewIds([]);
    previousRoster.current = rosterData(peserta);
    setModal(null);
    setGalat("");
    hapusDraf(pertemuan.id);
    onResumeCleared?.();
    setInfo(
      "Data server dimuat. Salinan draf sebelumnya tetap disimpan di perangkat.",
    );
  }

  function gunakanDraf() {
    if (!editor.owns() || !detail || detail.pertemuan.status === "KUNCI") return;
    const draft = makeDraft();
    if (!cadangkanDraf(pertemuan.id, draft)) {
      setGalat("Draf belum dapat dicadangkan. Kosongkan ruang penyimpanan sebelum menggunakan draf ini.");
      return;
    }
    const next = reconcileDraft(draft, peserta, detail.presensi);
    if (!next) return;
    setStatus(next.statuses);
    setRosterReview(next.needsRosterReview);
    setRosterReviewIds(next.rosterReviewIds);
    previousRoster.current = rosterData(peserta);
    setPanggil(null);
    setRiwayat([]);
    setRosterApproved(false);
    persistedDraftRef.current = "";
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
    if (!editor.owns() || !network.online || !canEdit || operationRef.current) return;
    if (belumDiperiksa.length && !remainingApproved) return;
    if (rosterReview && !rosterApproved) return;
    if (backupRef.current && !cadangkanDraf(pertemuan.id, backupRef.current)) {
      setGalat("Draf sebelum perubahan roster belum dapat dicadangkan. Kosongkan ruang perangkat lalu coba lagi.");
      return;
    }
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
      setPanggil(null);
      setRosterReview(false);
      setRosterReviewIds([]);
      hapusDraf(pertemuan.id);
      onResumeCleared?.();
      simpanDetail(pertemuan.id, {
        pertemuan: nextRecord,
        presensi: statuses,
        peserta,
        kelas,
      });
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
    if (!editor.owns() || readOnly || !network.online || operationRef.current) return;
    operationRef.current = "unlock";
    setSibuk("buka");
    setGalat("");
    try {
      await bukaKunci({ token, pertemuanId: pertemuan.id, expectedRevision: modal?.revision ?? record.revision });
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
      (!terkunci && (!detail || readOnly || !editor.owned)),
    // readOnly still permits downloads of locked attendance.
  );

  if (!pageReady || !editor.ready)
    return (
      <div className="attendance-layout" ref={layoutRef}>
        <Header onKembali={onKembali} onHelp={onHelp} />
        <main className="page attendance-page" aria-busy="true">
          <p className="eyebrow">Pertemuan {pertemuan.nomor}</p>
          <h1>Memuat presensi</h1>
          <SkeletonRows title="Menyiapkan daftar mahasiswa" rows={5} />
        </main>
        <footer className="attendance-footer" ref={footerRef}>
          <div className="attendance-footer-inner" aria-hidden="true">
            <div className="skeleton skeleton--button" />
            <div className="skeleton skeleton--button" />
          </div>
        </footer>
      </div>
    );

  return (
    <div className="attendance-layout" ref={layoutRef}>
      <Header
        onHelp={onHelp}
        onEditMeeting={onEditMeeting}
        onKembali={() => {
          if (dirty && !drafAman) setModal({ kind: "unsaved" });
          else onKembali();
        }}
        onBap={() => setModal({ kind: "bap" })}
        onUndo={undo}
        undoDisabled={!canEdit || !riwayat.length}
        busy={Boolean(sibuk)}
      />
      <main className="page attendance-page page-enter">
        <RefreshHint value={detail} pending={!detail && network.online} />
        <div className="attendance-heading" data-tour="attendance-heading">
          <div>
            <p className="eyebrow">{classInfo.nama}</p>
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
          <HelpButton topic="localDraft"/>
        </div>
        {editor.ready && !editor.owned && !readOnly && (
          <Notice kind="warning">
            {editor.supported
              ? "Presensi ini sedang diedit di tab lain. Tab ini hanya membaca. Tutup tab pengedit untuk melanjutkan di sini; draf terbaru akan dimuat otomatis."
              : "Browser belum menyediakan penguncian editor yang aman. Gunakan browser terbaru melalui HTTPS untuk mengedit presensi."}
          </Notice>
        )}
        {rosterReview && (
          <Notice kind="warning">
            Daftar atau identitas mahasiswa berubah. Status yang cocok dipertahankan dan draf sebelumnya dicadangkan.
            Periksa kembali daftar sebelum mengunci.
          </Notice>
        )}
        {!terkunci && !readOnly && (
          <div className="call-entry">
            <button
              ref={panggilTriggerRef}
              className="button button--outline"
              disabled={!canEdit || !peserta.length}
              onClick={() => bukaPanggil()}
            >
              <PanggilIcon /> Mode Panggil
              {progres.started && (
                <span>
                  · {progres.reviewedIds.length}/{peserta.length}
                </span>
              )}
            </button><HelpButton topic="calling"/>
          </div>
        )}
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
        {!preferensiAman && (
          <Notice kind="warning">
            Pengaturan lanjut otomatis belum tersimpan di perangkat. Pilihan
            tetap berlaku selama halaman ini terbuka.
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
              disabled={!editor.owned || readOnly || !network.online || Boolean(sibuk) || !known}
              onClick={() => { setGalat(""); setModal({ kind: "unlock", revision: record.revision }); }}
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
          <div className="roster-tools" data-tour="attendance-filter">
            <div className="group-filters" aria-label="Filter golongan">
              {[null, ...golongan].map((g) => (
                <button
                  key={g === null ? "all" : `gol:${g}`}
                  className={`filter-button${gol === g ? " is-active" : ""}`}
                  aria-pressed={gol === g}
                  onClick={() => setGol(g)}
                >
                  {g === null
                    ? "Semua"
                    : g.toLocaleUpperCase("id-ID") === "SEMUA"
                      ? `Gol. ${g}`
                      : g}
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
              <div className="brush-toolbar" data-tour="attendance-mode">
                <div className="brush-label">
                  <span>Tandai sebagai</span>
                  <span>Ketuk nama untuk mengubah</span>
                  <HelpButton topic="statuses"/>
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
          <div className="roster-label" data-tour="attendance-list">
            <span>
              Mahasiswa <span className="roster-count">{daftar.length}</span>
              {gol !== null && <span> · Golongan {gol}</span>}
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
                    setGol(null);
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
          <div className="attendance-footer-actions" data-tour="attendance-save">
            <button
              className="button button--outline"
              disabled={Boolean(sibuk)}
              onClick={() => onPrint(record)}
              data-tour="attendance-documents"
            >
              Siapkan cetak
            </button>
            <button
              className="button button--primary"
              disabled={primaryDisabled}
              onClick={primaryAction}
            >
              {primaryLabel}
              <span aria-hidden="true">{terkunci ? "↓" : "→"}</span>
            </button>
          </div>
          <DisabledReason>{primaryDisabled?(sibuk?"Tunggu proses yang sedang berjalan selesai.":!network.online?"Hubungkan internet untuk menyimpan atau membuat dokumen; draf lokal tetap ada.":konflik?"Ada perubahan server. Periksa konflik sebelum menyimpan.":!known||!detail?"Tunggu rincian presensi selesai dimuat.":!peserta.length?"Tambahkan mahasiswa aktif sebelum mencatat presensi.":readOnly&&!terkunci?"Kelas draf/arsip hanya dapat dibaca. Aktifkan atau pulihkan kelas sesuai akses.":!editor.owned&&!terkunci?"Tab ini hanya membaca. Gunakan tab pengedit atau browser yang mendukung penguncian.":null):null}</DisabledReason>
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

      {modal?.kind === "panggil" && peserta.length > 0 && (
        <ModePanggil
          key={`${progres.roster}:${baseRevision}`}
          returnFocusRef={panggilTriggerRef}
          peserta={peserta}
          statuses={status}
          progress={progres}
          auto={autoPanggil}
          autoExit={autoKeluarPanggil}
          resume={modal.resume}
          canEdit={canEdit}
          unsafe={!drafAman || !preferensiAman}
          nomor={record.nomor}
          kode={classInfo.kode}
          onChoose={pilihPanggil}
          onProgress={ubahPanggil}
          onAuto={(auto) => {
            setAutoPanggil(auto);
            setPreferensiAman(
              store.simpanPreferensiPanggil(
                "preferences",
                auto,
                autoKeluarPanggil,
              ),
            );
          }}
          onAutoExit={(autoExit) => {
            setAutoKeluarPanggil(autoExit);
            setPreferensiAman(
              store.simpanPreferensiPanggil(
                "preferences",
                autoPanggil,
                autoExit,
              ),
            );
          }}
          onClose={(message) => {
            if (typeof message === "string") setInfo(message);
            setModal(null);
          }}
          onReview={() => setModal({ kind: "review" })}
        />
      )}

      {modal?.kind === "review" && (
        <Modal title="Periksa presensi" onClose={() => setModal(null)}>
          <p className="modal-description">
            Pertemuan {record.nomor} ·{" "}
            {hariTanggal(record.tanggal).replace(" / ", ", ")}
          </p>
          {rosterReview && (
            <section className="call-unreviewed" aria-label="Perubahan roster">
              <strong>Periksa perubahan roster sebelum mengunci</strong>
              <p>Status peserta yang masih cocok dipertahankan. Nama baru atau identitas yang berubah perlu diperiksa.</p>
              {rosterReviewIds.length > 0 && <ul>{peserta.filter(p => rosterReviewIds.includes(p.id)).map(p =>
                <li key={p.id}>{p.nama} · {p.nim} · {LABEL[status[p.id]]}</li>)}</ul>}
              <label className="call-auto"><input type="checkbox" checked={rosterApproved}
                onChange={e => setRosterApproved(e.target.checked)} />Saya sudah memeriksa perubahan roster dan seluruh status presensi.</label>
            </section>
          )}
          {belumDiperiksa.length > 0 && (
            <section
              className="call-unreviewed"
              aria-label="Nama belum diperiksa"
            >
              <strong>
                {belumDiperiksa.length} nama belum diperiksa di Mode Panggil
              </strong>
              <p>
                Nama yang dilewati tetap memakai status pada daftar. Periksa
                kembali sebelum mengunci.
              </p>
              <ul>
                {belumDiperiksa.map((p) => (
                  <li key={p.id}>
                    {p.nama} · Golongan {p.golongan} · {LABEL[status[p.id]]}
                  </li>
                ))}
              </ul>
              <button
                className="button button--outline button--full"
                disabled={!canEdit}
                onClick={() => bukaPanggil(true)}
              >
                Lanjutkan nama yang belum diperiksa
              </button>
              <label className="call-auto">
                <input
                  type="checkbox"
                  checked={remainingApproved}
                  onChange={(event) =>
                    setRemainingApproved(event.target.checked)
                  }
                />
                Saya sudah memeriksa nama tersebut dan menggunakan status pada
                daftar.
              </label>
            </section>
          )}
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
              disabled={
                primaryDisabled ||
                (rosterReview && !rosterApproved) ||
                (belumDiperiksa.length > 0 && !remainingApproved)
              }
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
          {galat && <Notice kind="error">{galat}</Notice>}
          <div className="modal-actions">
            <button
              className="button button--primary button--full"
              disabled={!editor.owned || readOnly || !network.online || Boolean(sibuk)}
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
              disabled={!detail || !editor.owned}
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
          {galat && <Notice kind="error">{galat}</Notice>}
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
            {terkunci && (
              <button
                className="button button--outline button--full"
                disabled={Boolean(sibuk) || !network.online}
                onClick={async () => {
                  setSibuk("pdf");
                  setGalat("");
                  try {
                    const result = await generate({
                      token,
                      pertemuanId: pertemuan.id,
                      format: "pdf",
                    });
                    if (result.status !== "READY")
                      throw Error("PDF sedang diproses. Coba lagi sebentar.");
                    await unduhDokumen(
                      result.url,
                      fileName.replace(/\.docx$/, ".pdf"),
                    );
                    setInfo(
                      "PDF siap diunduh. Periksa preview sebelum mencetak.",
                    );
                  } catch (e) {
                    setGalat(pesanGalat(e));
                  } finally {
                    setSibuk("");
                  }
                }}
              >
                Unduh PDF
              </button>
            )}
            <button
              className="button button--quiet button--full"
              disabled={Boolean(sibuk)}
              onClick={() => setModal(null)}
            >
              Kembali ke presensi
            </button>
            <p className="modal-help">
              Unduhan di atas untuk satu pertemuan. Gabungkan beberapa BAP lewat
              Siapkan cetak.
            </p>
            <button
              className="button button--outline button--full"
              disabled={Boolean(sibuk)}
              onClick={() => {
                setModal(null);
                onPrint(record);
              }}
            >
              Siapkan cetak
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
import { HelpButton, DisabledReason } from "../components/Help.jsx";
