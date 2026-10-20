import { useState } from "react";
import Modal from "./Modal.jsx";

const STEPS = [
  {
    title: "Siapkan kelas sekali, lanjutkan kapan saja",
    text: "Buka Tambah kelas untuk mengatur mata kuliah, dosen, semester, dan asdos. Masukkan mahasiswa melalui Excel/CSV atau satu per satu, susun jadwal, lalu preview dan terbitkan template BAP. Aktifkan kelas setelah diperiksa.",
    hint: "Gunakan pencarian di navbar atau ⌘K pada Mac / Ctrl+K pada Windows untuk mencari kelas, mahasiswa, dan fitur.",
    visual: (
      <>
        <strong>Kelas</strong>
        <span>→</span>
        <span>Mahasiswa</span>
        <span>→</span>
        <span>Jadwal & template</span>
      </>
    ),
  },
  {
    title: "Pilih pertemuan yang benar",
    text: "Periksa nomor dan tanggal sebelum membuka presensi. Jadwal mengikuti kelas yang dipilih. Teori, UTS, UAS, dan Libur tidak memakai BAP praktikum.",
    hint: "Belum dikunci berarti presensi masih bisa diubah.",
    visual: (
      <>
        <span className="guide-example-number">03</span>
        <span>
          <strong>Pertemuan 3</strong>
          <small>Periksa tanggal sebelum mulai</small>
        </span>
        <span aria-hidden="true">↗</span>
      </>
    ),
  },
  {
    title: "Cukup tandai yang tidak hadir",
    text: "Semua mahasiswa awalnya Hadir. Pilih Alpha, Sakit, atau Izin pada bagian Tandai sebagai, lalu ketuk nama yang sesuai. Cari nama/NIM atau gunakan filter golongan.",
    hint: "Salah ketuk? Gunakan Urungkan. Tombol ⋯ membuka pilihan status per mahasiswa.",
    visual: (
      <>
        <span className="status-badge HADIR">Hadir</span>
        <span aria-hidden="true">→</span>
        <span className="status-badge ALPHA">Alpha</span>
        <span className="muted">Contoh perubahan status</span>
      </>
    ),
  },
  {
    title: "Periksa, kunci, lalu unduh BAP",
    text: "Tekan Simpan & Kunci, periksa daftar yang tidak hadir, lalu konfirmasi. Setelah BAP siap, unduh dokumennya. Untuk koreksi, buka kunci lalu simpan kembali.",
    hint: "Draf ada di perangkat ini. Menyimpan ke server dan membuat BAP memerlukan internet.",
    visual: (
      <>
        <span>Periksa</span>
        <span aria-hidden="true">→</span>
        <strong>Kunci</strong>
        <span aria-hidden="true">→</span>
        <span>Unduh BAP</span>
      </>
    ),
  },
];

export default function Guide({ firstTime, onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  return (
    <Modal
      title={firstTime ? "Panduan singkat" : "Bantuan presensi"}
      onClose={onClose}
    >
      <p className="modal-description">
        {firstTime
          ? "Panduan sebelum mulai. Bisa dilewati dan dibuka lagi lewat tombol Bantuan (?)."
          : "Baca langkah yang dibutuhkan. Membuka panduan tidak mengubah presensi."}
      </p>
      <nav className="guide-steps" aria-label="Langkah panduan">
        {STEPS.map((item, index) => (
          <button
            key={item.title}
            className={`filter-button${index === step ? " is-active" : ""}`}
            aria-current={index === step ? "step" : undefined}
            aria-label={`Langkah ${index + 1}: ${item.title}`}
            onClick={() => setStep(index)}
          >
            {index + 1}
          </button>
        ))}
      </nav>
      <div className="guide-content" aria-live="polite" aria-atomic="true">
        <p className="eyebrow">
          Langkah {step + 1} dari {STEPS.length}
        </p>
        <h3>{current.title}</h3>
        <div className="guide-example">{current.visual}</div>
        <p>{current.text}</p>
        <p className="guide-hint">{current.hint}</p>
      </div>
      {!firstTime && (
        <details className="guide-print-help">
          <summary>Mencetak dua pertemuan per folio</summary>
          <p>
            Buka Siapkan cetak di halaman pertemuan. Pilih presensi yang sudah
            terkunci, lalu buat preview paket PDF atau unduh paket Word.
            Pertemuan harus dari kelas yang sama. Dua form disusun dari atas ke
            bawah tanpa mengecilkan halaman penuh.
          </p>
          <p>
            Buka di Word dan periksa pratinjau. Gunakan ukuran kertas sesuai
            dokumen, folio 215 × 330 mm, skala 100%, dan 1 halaman per lembar.
            Jangan memilih 2 halaman per lembar lagi. Jika jumlah form ganjil,
            bagian bawah lembar terakhir dibiarkan kosong.
          </p>
          <p>
            Satu form menampung 12 mahasiswa tidak hadir; sisanya memakai form
            lanjutan yang ikut dihitung dalam paket.
          </p>
        </details>
      )}
      <div className="guide-actions">
        <button className="button button--quiet" onClick={onClose}>
          {firstTime ? "Lewati" : "Tutup panduan"}
        </button>
        {step > 0 && (
          <button
            className="button button--outline"
            onClick={() => setStep(step - 1)}
          >
            Kembali
          </button>
        )}
        <button
          className="button button--primary"
          onClick={() =>
            step < STEPS.length - 1 ? setStep(step + 1) : onClose()
          }
        >
          {step < STEPS.length - 1 ? "Lanjut" : "Selesai"}
        </button>
      </div>
      {firstTime && (
        <p className="guide-footnote">
          Setelah ditutup atau dilewati, panduan tidak muncul otomatis lagi di
          browser ini.
        </p>
      )}
    </Modal>
  );
}
