import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";

import { hariTanggal, hapusDraf, bacaDraf, simpanDraf } from "../lib/store.js";

const SEMUA = "HADIR"; // status default
const URUT_STATUS = ["HADIR", "ALPHA", "SAKIT", "IZIN"];
const LABEL = { HADIR: "Hadir", ALPHA: "Alpha", SAKIT: "Sakit", IZIN: "Izin" };

function pesanGalat(err) {
  const s = String(err?.data || err?.message || err);
  if (s.includes("KONFLIK_REVISI")) return "Data sudah berubah di perangkat lain. Muat ulang dulu.";
  if (s.includes("BELUM_DIKUNCI")) return "Presensi belum dikunci.";
  if (s.includes("PESERTA_KURANG") || s.includes("PESERTA_ASING"))
    return "Data peserta tidak cocok dengan server.";
  if (s.includes("BUSY")) return "Dokumen sedang dibuat. Tunggu sebentar lalu coba lagi.";
  return "Gagal: " + s;
}

export default function Presensi({ token, pertemuan, peserta, onKembali }) {
  const detail = useQuery(api.sesi.detail, { token, pertemuanId: pertemuan.id });
  const bapAda = useQuery(api.bap.forSesi, { token, pertemuanId: pertemuan.id });

  const simpanKunci = useMutation(api.sesi.simpanDanKunci);
  const bukaKunci = useMutation(api.sesi.bukaKunci);
  const generate = useAction(api.bapNode.generate);

  const [status, setStatus] = useState({});          // pesertaId -> status
  const [baseRevision, setBase] = useState(null);
  const [mode, setMode] = useState(null);            // mode kuas: null | status
  const [buka, setBuka] = useState(null);            // pesertaId di bottom sheet
  const [cari, setCari] = useState("");
  const [gol, setGol] = useState("SEMUA");
  const [riwayat, setRiwayat] = useState([]);        // untuk undo
  const [sibuk, setSibuk] = useState("");
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const initRef = useRef("");

  const terkunci = detail?.pertemuan.status === "KUNCI";
  const revisionServer = detail?.pertemuan.revision ?? pertemuan.revision;

  // Inisialisasi: server dulu, lalu draf lokal menang bila revisinya sama.
  useEffect(() => {
    if (!detail) return;
    const kunci = `${pertemuan.id}:${detail.pertemuan.revision}:${detail.pertemuan.status}`;
    if (initRef.current === kunci) return;
    initRef.current = kunci;

    const dasar = {};
    for (const p of peserta) dasar[p.id] = SEMUA;
    for (const b of detail.presensi) dasar[b.pesertaId] = b.status;

    const draf = bacaDraf(pertemuan.id);
    if (draf && draf.baseRevision === detail.pertemuan.revision) {
      Object.assign(dasar, draf.statuses);
      setInfo("Draf lokal dipulihkan.");
    }
    setStatus(dasar);
    setBase(detail.pertemuan.revision);
    setRiwayat([]);
  }, [detail, peserta, pertemuan.id]);

  // Draf disimpan tiap perubahan (murah, lokal) — bukan mutation.
  useEffect(() => {
    if (baseRevision === null) return;
    if (Object.keys(status).length === 0) return;
    simpanDraf(pertemuan.id, { baseRevision, statuses: status });
  }, [status, baseRevision, pertemuan.id]);

  function setSatu(pesertaId, nilai, catat = true) {
    setStatus((prev) => {
      if (prev[pesertaId] === nilai) return prev;
      if (catat) setRiwayat((r) => [...r.slice(-19), { pesertaId, sebelum: prev[pesertaId] }]);
      return { ...prev, [pesertaId]: nilai };
    });
  }

  function undo() {
    setRiwayat((r) => {
      if (r.length === 0) return r;
      const aksi = r[r.length - 1];
      setStatus((prev) => ({ ...prev, [aksi.pesertaId]: aksi.sebelum }));
      return r.slice(0, -1);
    });
  }

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return peserta
      .filter((p) => (gol === "SEMUA" ? true : p.golongan === gol))
      .filter((p) => (q ? p.nama.toLowerCase().includes(q) : true));
  }, [peserta, gol, cari]);

  const tidakHadir = useMemo(
    () => peserta.filter((p) => status[p.id] && status[p.id] !== "HADIR").length,
    [peserta, status]
  );

  const indeksBuka = buka ? daftar.findIndex((p) => p.id === buka) : -1;
  const orangBuka = indeksBuka >= 0 ? daftar[indeksBuka] : null;

  async function simpan() {
    setGalat("");
    setInfo("");
    setSibuk("simpan");
    try {
      const statuses = peserta.map((p) => ({
        pesertaId: p.id,
        status: status[p.id] || SEMUA,
      }));
      await simpanKunci({
        token,
        pertemuanId: pertemuan.id,
        baseRevision,
        statuses,
      });
      setInfo("Presensi tersimpan & dikunci. Membuat BAP…");
      const hasil = await generate({ token, pertemuanId: pertemuan.id });
      if (hasil.status === "READY") {
        setInfo("BAP siap diunduh.");
        if (hasil.url) window.open(hasil.url, "_blank");
      } else {
        setInfo("Dokumen sedang dibuat di perangkat lain. Coba lagi sebentar.");
      }
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSibuk("");
    }
  }

  async function bukaKuncinya() {
    if (!confirm("Buka kunci presensi? BAP yang sudah ada akan ditandai usang.")) return;
    setSibuk("buka");
    setGalat("");
    try {
      await bukaKunci({ token, pertemuanId: pertemuan.id });
      initRef.current = ""; // paksa muat ulang status dari server
      setInfo("Presensi dibuka. Koreksi lalu simpan lagi untuk membuat BAP baru.");
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSibuk("");
    }
  }

  async function unduhUlang() {
    setSibuk("generate");
    setGalat("");
    try {
      const hasil = await generate({ token, pertemuanId: pertemuan.id });
      if (hasil.url) window.open(hasil.url, "_blank");
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSibuk("");
    }
  }

  if (!detail) {
    return (
      <div className="wrap">
        <div className="card muted">Memuat presensi…</div>
      </div>
    );
  }

  const bapUsang = bapAda && bapAda.revision !== revisionServer;

  return (
    <>
      <div className="topbar">
        <button onClick={onKembali}>←</button>
        <h1>
          Pertemuan {pertemuan.nomor} · {hariTanggal(pertemuan.tanggal)}
        </h1>
        <button onClick={undo} disabled={riwayat.length === 0}>
          Undo
        </button>
      </div>

      <div className="wrap">
        {galat && <div className="alert">{galat}</div>}
        {info && <div className="ok">{info}</div>}

        <div className="card">
          <div className="row">
            <div className="grow">
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {tidakHadir} tidak hadir dari {peserta.length}
              </div>
              <div className="muted">
                Tempat {pertemuan.tempat} · {terkunci ? "Terkunci" : "Terbuka"} · rev {revisionServer}
              </div>
            </div>
            {terkunci ? (
              <button className="ghost" onClick={bukaKuncinya} disabled={sibuk !== ""}>
                Buka kunci
              </button>
            ) : null}
          </div>
          {terkunci && (
            <div style={{ marginTop: 10 }}>
              <button
                className="primary"
                onClick={unduhUlang}
                disabled={sibuk !== ""}
              >
                {sibuk === "generate" ? "Menyiapkan…" : bapUsang ? "Buat BAP baru" : "Unduh BAP"}
              </button>
              {bapUsang && (
                <p className="muted" style={{ marginBottom: 0 }}>
                  BAP yang tersimpan berasal dari revisi {bapAda.revision} — sudah usang.
                </p>
              )}
            </div>
          )}
        </div>

        <input
          type="search"
          placeholder="Cari nama…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />

        <div className="tabs" style={{ margin: "8px 0" }}>
          {["SEMUA", "A", "B", "C", "D"].map((g) => (
            <button key={g} className={gol === g ? "on" : ""} onClick={() => setGol(g)}>
              {g === "SEMUA" ? "Semua" : `Gol ${g}`}
            </button>
          ))}
        </div>

        <div className="list">
          {daftar.map((p) => (
            <div
              key={p.id}
              className="item"
              onClick={() => {
                if (terkunci) return;
                if (mode) setSatu(p.id, mode);
                else setBuka(p.id);
              }}
            >
              <span className="gol">{p.golongan}</span>
              <span className="nm">{p.nama}</span>
              <span className={`chip ${status[p.id] || SEMUA}`}>{LABEL[status[p.id] || SEMUA]}</span>
            </div>
          ))}
          {daftar.length === 0 && <div className="item muted">Tidak ada nama yang cocok.</div>}
        </div>

        {!terkunci && (
          <div style={{ marginTop: 12 }}>
            <button className="primary" onClick={simpan} disabled={sibuk !== ""}>
              {sibuk === "simpan" ? "Menyimpan…" : "Simpan & kunci"}
            </button>
            <p className="muted">
              Satu tombol menyimpan presensi sekaligus mengunci dan membuat BAP.
            </p>
          </div>
        )}
      </div>

      {!terkunci && (
        <div className="paintbar">
          {URUT_STATUS.map((s) => (
            <button
              key={s}
              className={`${mode === s ? "on " : ""}${s}`}
              onClick={() => setMode(mode === s ? null : s)}
            >
              {LABEL[s]}
            </button>
          ))}
        </div>
      )}

      {orangBuka && (
        <div className="sheet-bg" onClick={() => setBuka(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{orangBuka.nama}</h2>
            <p className="muted">
              Gol {orangBuka.golongan} · {orangBuka.nim}
            </p>
            <div className="grid4">
              {URUT_STATUS.map((s) => (
                <button
                  key={s}
                  className={`${(status[orangBuka.id] || SEMUA) === s ? "on " : ""}${s}`}
                  onClick={() => setSatu(orangBuka.id, s)}
                >
                  {LABEL[s]}
                </button>
              ))}
            </div>
            <div className="row">
              <button
                className="ghost grow"
                disabled={indeksBuka <= 0}
                onClick={() => setBuka(daftar[indeksBuka - 1].id)}
              >
                ← Sebelumnya
              </button>
              <button
                className="ghost grow"
                disabled={indeksBuka >= daftar.length - 1}
                onClick={() => setBuka(daftar[indeksBuka + 1].id)}
              >
                Berikutnya →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
