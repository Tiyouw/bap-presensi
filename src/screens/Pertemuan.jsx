import { hariTanggal } from "../lib/store.js";

export default function Pertemuan({ data, online, onPilih, onKeluar }) {
  if (!data) {
    return (
      <div className="wrap">
        <div className="card">
          <p className="muted">Memuat data… Kalau macet, sambungkan internet sekali untuk cache awal.</p>
        </div>
      </div>
    );
  }

  const reguler = data.pertemuan.filter((p) => p.tipe === "REGULER");

  return (
    <>
      <div className="topbar">
        <h1>Pilih pertemuan</h1>
        <button onClick={onKeluar}>Keluar</button>
      </div>
      <div className="wrap">
        {!online && (
          <div className="alert">
            Offline — memakai data terakhir. Presensi tetap bisa diisi, tapi menyimpan butuh internet.
          </div>
        )}
        <p className="muted">
          {data.peserta.length} mahasiswa · {reguler.length} pertemuan · cache{" "}
          {new Date(data.diambilPada).toLocaleString("id-ID")}
        </p>
        <div className="list">
          {reguler.map((p) => (
            <button
              key={p.id}
              className="item"
              style={{ width: "100%", background: "none", border: 0, textAlign: "left" }}
              onClick={() => onPilih(p)}
            >
              <span className="gol">{p.nomor}</span>
              <span className="nm">
                {hariTanggal(p.tanggal)}
                <br />
                <span className="muted">{p.tempat}</span>
              </span>
              <span className={`chip ${p.status === "KUNCI" ? "HADIR" : "IZIN"}`}>
                {p.status === "KUNCI" ? "Terkunci" : "Terbuka"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
