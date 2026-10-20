import { useState } from "react";
import {
  Header,
  ConnectionStatus,
  Loading,
  Notice,
} from "../components/Layout.jsx";
import { bacaDraf, hariTanggal } from "../lib/store.js";
import { hariIni, KELAS } from "../lib/presensi.js";
import { RefreshHint } from "../components/Loading.jsx";
import { usePageReady } from "../lib/usePageReady.js";

export default function Pertemuan({
  data,
  network,
  onPilih,
  onKeluar,
  onHelp,
  onPrint,
  freshData,
}) {
  const [filter, setFilter] = useState("semua");
  const ready = usePageReady(Boolean(data?.peserta.length), "meetings");
  if (!ready)
    return (
      <>
        <Header onKeluar={onKeluar} onHelp={onHelp} />
        {!network.online && (
          <div className="page">
            <Notice kind="warning">
              Sambungkan internet sekali untuk menyiapkan data kelas. Draf yang
              sudah ada tetap disimpan.
            </Notice>
          </div>
        )}
        <Loading />
      </>
    );

  const today = hariIni();
  const reguler = data.pertemuan.filter((p) => p.tipe === "REGULER");
  const dikunci = reguler.filter((p) => p.status === "KUNCI").length;
  const recommended =
    reguler.find((p) => p.tanggal === today) ||
    reguler.find((p) => p.status !== "KUNCI" && p.tanggal > today) ||
    [...reguler].reverse().find((p) => p.status !== "KUNCI") ||
    reguler[reguler.length - 1];
  const displayed = data.pertemuan.filter(
    (p) =>
      filter === "semua" ||
      (filter === "terkunci"
        ? p.status === "KUNCI" && p.tipe === "REGULER"
        : p.status !== "KUNCI" && p.tipe === "REGULER"),
  );
  const status = (p) =>
    p.tipe !== "REGULER"
      ? p.tipe
      : p.status === "KUNCI"
        ? "Terkunci"
        : bacaDraf(p.id)
          ? "Draf"
          : "Belum diisi";

  return (
    <>
      <Header onKeluar={onKeluar} onHelp={onHelp} />
      <main className="page meetings-page page-enter">
        <RefreshHint value={freshData} pending={!freshData && network.online} />
        <div className="page-context">
          <span>{KELAS.semester}</span>
          <ConnectionStatus network={network} />
        </div>
        <div className="page-heading">
          <div>
            <p className="eyebrow">{KELAS.nama}</p>
            <h1>
              Pertemuan<span className="heading-dot">.</span>
            </h1>
            <p className="lede">
              Pilih pertemuan untuk mengisi presensi atau mengunduh BAP.
            </p>
          </div>
          <span className="page-counter">
            <strong>{String(dikunci).padStart(2, "0")}</strong>
            <span>dari {reguler.length} terkunci</span>
          </span>
        </div>
        <div className="meeting-tools">
          <p className="muted">
            Gabungkan BAP beberapa pertemuan untuk menghemat kertas.
          </p>
          <button className="button button--outline" onClick={onPrint}>
            Siapkan cetak <span aria-hidden="true">↗</span>
          </button>
        </div>
        {!network.online && (
          <Notice kind="warning">
            Memakai data yang tersimpan di perangkat. Presensi bisa diisi;
            mengunci dan membuat BAP membutuhkan koneksi.
          </Notice>
        )}
        {recommended && (
          <section className="featured-meeting" aria-label="Pertemuan pilihan">
            <div className="featured-number" aria-hidden="true">
              {String(recommended.nomor).padStart(2, "0")}
            </div>
            <div className="featured-content">
              <div className="featured-top">
                <span className="eyebrow">
                  {recommended.tanggal === today
                    ? "Pertemuan hari ini"
                    : recommended.tanggal > today
                      ? "Pertemuan berikutnya"
                      : "Pertemuan terakhir yang belum dikunci"}
                </span>
                <span
                  className={`session-badge ${recommended.status === "KUNCI" ? "session-badge--locked" : ""}`}
                >
                  {status(recommended)}
                </span>
              </div>
              <h2>{hariTanggal(recommended.tanggal).replace(" / ", ", ")}</h2>
              <p>
                Ruang {recommended.tempat} · {data.peserta.length} mahasiswa
              </p>
              <button
                className="button button--primary"
                onClick={() => onPilih(recommended)}
              >
                {recommended.status === "KUNCI"
                  ? "Lihat presensi & BAP"
                  : "Buka presensi"}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </section>
        )}
        <section className="meeting-directory" aria-label="Daftar pertemuan">
          <div className="section-heading">
            <h2>Daftar pertemuan</h2>
            <span className="muted">
              {data.pertemuan.length} pertemuan semester ini
            </span>
          </div>
          <div className="meeting-filters" aria-label="Filter pertemuan">
            {[
              ["semua", "Semua"],
              ["terbuka", "Belum dikunci"],
              ["terkunci", "Terkunci"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`filter-button${filter === value ? " is-active" : ""}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="meeting-list">
            {displayed.map((p) => {
              const exam = p.tipe !== "REGULER";
              return (
                <button
                  key={p.id}
                  className={`meeting-row${exam ? " meeting-row--exam" : ""}${p.tanggal === today ? " meeting-row--today" : ""}`}
                  disabled={exam}
                  onClick={() => onPilih(p)}
                >
                  <span className="meeting-number">
                    {String(p.nomor).padStart(2, "0")}
                  </span>
                  <span className="meeting-copy">
                    <strong>
                      {exam
                        ? p.tipe === "UTS"
                          ? "Ujian tengah semester"
                          : "Ujian akhir semester"
                        : `Pertemuan ${p.nomor}`}
                      {p.tanggal === today && (
                        <span className="today-label">Hari ini</span>
                      )}
                    </strong>
                    <span>
                      {hariTanggal(p.tanggal).replace(" / ", ", ")}
                      <span className="meeting-place"> · {p.tempat}</span>
                    </span>
                  </span>
                  <span
                    className={`session-badge${p.status === "KUNCI" && !exam ? " session-badge--locked" : ""}`}
                  >
                    {exam ? "Tidak ada BAP" : status(p)}
                  </span>
                  {!exam && (
                    <span className="meeting-arrow" aria-hidden="true">
                      ↗
                    </span>
                  )}
                </button>
              );
            })}
            {displayed.length === 0 && (
              <div className="empty-state">
                <h3>
                  {filter === "terkunci"
                    ? "Belum ada pertemuan terkunci"
                    : "Semua pertemuan sudah dikunci"}
                </h3>
                <p>Gunakan filter Semua untuk melihat seluruh pertemuan.</p>
                <button
                  className="button button--outline"
                  onClick={() => setFilter("semua")}
                >
                  Lihat semua pertemuan
                </button>
              </div>
            )}
          </div>
        </section>
        <footer className="page-footnote">
          <span>
            {data.peserta.length} mahasiswa · {reguler.length} pertemuan reguler
          </span>
          <span>UTS dan UAS tidak memiliki BAP.</span>
        </footer>
      </main>
    </>
  );
}
