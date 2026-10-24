export default function Pagination({
  total,
  page,
  size,
  onPage,
  onSize,
  label = "daftar",
}) {
  const pages = Math.max(1, Math.ceil(total / size)),
    current = Math.min(page, pages - 1);
  return (
    <nav className="list-pagination" aria-label={`Halaman ${label}`}>
      <p role="status">
        {total
          ? `${current * size + 1}–${Math.min((current + 1) * size, total)} dari ${total}`
          : "0 data"}
      </p>
      <label>
        Per halaman{" "}
        <select
          aria-label={`Jumlah ${label} per halaman`}
          value={size}
          onChange={(e) => {
            onSize(Number(e.target.value));
            onPage(0);
          }}
        >
          {[10, 25, 50].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <div>
        <button
          type="button"
          className="button button--outline"
          disabled={!current}
          onClick={() => onPage(current - 1)}
          aria-label={`Halaman ${label} sebelumnya`}
        >
          ←
        </button>
        <span>
          {current + 1} / {pages}
        </span>
        <button
          type="button"
          className="button button--outline"
          disabled={current >= pages - 1}
          onClick={() => onPage(current + 1)}
          aria-label={`Halaman ${label} berikutnya`}
        >
          →
        </button>
      </div>
    </nav>
  );
}
