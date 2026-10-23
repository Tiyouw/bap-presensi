import { useState } from "react";
import { HELP_AREAS, helpTopics, helpTopic } from "../lib/helpContent.js";

export default function Guide({
  context,
  initialArea,
  initialTopic,
  onClose,
  onTour,
  tourAvailable,
}) {
  const [area, setArea] = useState(initialArea || ""),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(initialTopic || "");
  const topic = selected && helpTopic(selected, context),
    topics = helpTopics(context, query ? "" : area, query),
    areas = Object.entries(HELP_AREAS).filter(
      ([id]) => helpTopics(context, id).length,
    );
  return (
    <>
      <header className="help-panel-header">
        <div>
          <p className="eyebrow">BAP · panduan sesuai akses</p>
          <h2 id="help-panel-title">Bantuan & panduan</h2>
        </div>
        <button
          type="button"
          className="button button--quiet"
          onClick={onClose}
        >
          Tutup bantuan
        </button>
      </header>
      <p>
        Membaca panduan tidak mengubah presensi atau draf.{" "}
        {context.online === false &&
          "Offline: keadaan data dan izin dapat tertinggal dari server."}
      </p>
      {tourAvailable && (
        <button
          type="button"
          className="button button--outline"
          onClick={onTour}
        >
          Tunjukkan caranya di halaman ini
        </button>
      )}
      <label className="help-search-label" htmlFor="help-topic-search">
        Cari penjelasan fitur
      </label>
      <input
        id="help-topic-search"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected("");
        }}
        placeholder="Contoh: tanggal, draf, cetak…"
      />
      <label className="help-search-label" htmlFor="help-area">
        Topik halaman
      </label>
      <select
        id="help-area"
        value={area}
        onChange={(e) => {
          setArea(e.target.value);
          setSelected("");
          setQuery("");
        }}
      >
        <option value="">Semua panduan yang tersedia</option>
        {areas.map(([id, title]) => (
          <option key={id} value={id}>
            {title}
          </option>
        ))}
      </select>
      {topic ? (
        <article className="help-article">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setSelected("")}
          >
            ← Daftar topik
          </button>
          <h3>{topic.title}</h3>
          <p className="help-summary">{topic.summary}</p>
          {topic.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </article>
      ) : (
        <div className="help-topic-list" aria-live="polite">
          <p className="muted">
            {topics.length} penjelasan
            {query ? " · hasil dari seluruh panduan yang dapat diakses" : ""}
          </p>
          {topics.map((t) => (
            <button
              type="button"
              key={t.id}
              className="help-topic-item"
              onClick={() => setSelected(t.id)}
            >
              <strong>{t.title}</strong>
              <span>{t.summary}</span>
              <span className="sr-only">Buka penjelasan</span>
            </button>
          ))}
          {!topics.length && (
            <p>
              Tidak ada penjelasan yang cocok. Coba kata lain atau pilih Semua
              panduan yang tersedia.
            </p>
          )}
        </div>
      )}
      <p className="help-footnote">
        Panduan menyesuaikan fitur dan akses kelas saat ini. Data server tetap
        menentukan izin setiap tindakan.{" "}
        <a
          href={`${import.meta.env.BASE_URL}third-party-notices.txt`}
          target="_blank"
          rel="noopener"
        >
          Lisensi komponen
        </a>
      </p>
    </>
  );
}
