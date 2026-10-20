import { useEffect, useRef, useState } from "react";
import { SkeletonRows } from "./Loading.jsx";
import { Notice } from "./Layout.jsx";

/** Render the actual PDF bytes, including in browsers without an embedded PDF plugin. */
export default function PdfPreview({ url, title = "Preview PDF" }) {
  const host = useRef(),
    canvas = useRef(),
    previousRender = useRef(Promise.resolve());
  const [document, setDocument] = useState(null),
    [page, setPage] = useState(1),
    [draft, setDraft] = useState("1"),
    [width, setWidth] = useState(0),
    [zoom, setZoom] = useState(1),
    [ready, setReady] = useState(false),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let stopped = false,
      task;
    setDocument(null);
    setReady(false);
    setError("");
    setPage(1);
    setDraft("1");
    setText("");
    (async () => {
      const [lib, worker] = await Promise.all([
        import("pdfjs-dist/legacy/build/pdf.mjs"),
        import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
      ]);
      if (stopped) return;
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      task = lib.getDocument({
        url,
        isEvalSupported: false,
        stopAtErrors: true,
      });
      const pdf = await task.promise;
      if (stopped) {
        await pdf.destroy();
        return;
      }
      setDocument(pdf);
    })().catch(() => {
      if (!stopped)
        setError(
          "Preview PDF belum dapat ditampilkan. Coba lagi atau unduh berkasnya.",
        );
    });
    return () => {
      stopped = true;
      task?.destroy().catch(() => {});
    };
  }, [url, retry]);
  useEffect(() => {
    if (!document || !width) return;
    let stopped = false,
      task;
    setReady(false);
    setError("");
    (async () => {
      // Finish a cancelled render before reusing the same canvas on resize/page changes.
      await previousRender.current.catch(() => {});
      const sheet = await document.getPage(page);
      if (stopped) return;
      const natural = sheet.getViewport({ scale: 1 }),
        viewport = sheet.getViewport({ scale: (width / natural.width) * zoom }),
        density = Math.min(window.devicePixelRatio || 1, 2),
        target = canvas.current;
      target.width = Math.ceil(viewport.width * density);
      target.height = Math.ceil(viewport.height * density);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      task = sheet.render({
        canvas: target,
        viewport,
        transform: density === 1 ? undefined : [density, 0, 0, density, 0, 0],
        background: "rgb(255,255,255)",
      });
      previousRender.current = task.promise;
      const [, content] = await Promise.all([
        task.promise,
        sheet.getTextContent(),
      ]);
      if (stopped) return;
      setText(content.items.map((item) => item.str || "").join(" "));
      setReady(true);
    })().catch((e) => {
      if (!stopped && e.name !== "RenderingCancelledException")
        setError(
          "Halaman PDF belum dapat dirender. Coba lagi atau unduh berkasnya.",
        );
    });
    return () => {
      stopped = true;
      task?.cancel();
    };
  }, [document, page, width, zoom]);
  const go = (value) => {
    const next = Math.max(
      1,
      Math.min(document?.numPages || 1, Math.trunc(Number(value) || 1)),
    );
    setPage(next);
    setDraft(String(next));
  };
  return (
    <section
      className="mg-pdf-viewer"
      aria-label={title}
      aria-busy={!ready && !error}
    >
      {document && (
        <div className="mg-pdf-controls">
          <label className="mg-pdf-zoom">
            <span className="sr-only">Pembesaran PDF</span>
            <select
              aria-label="Pembesaran PDF"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              <option value="1">Pas lebar</option>
              <option value="1.5">Perbesar 1,5×</option>
              <option value="2">Perbesar 2×</option>
            </select>
          </label>
          <button
            type="button"
            className="button button--outline"
            disabled={page <= 1}
            onClick={() => go(page - 1)}
          >
            ← Sebelumnya
          </button>
          <label className="mg-pdf-page">
            <span>Halaman</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={document.numPages}
              aria-label="Halaman PDF"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => go(draft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  go(draft);
                }
              }}
            />
            <span>/ {document.numPages}</span>
          </label>
          <button
            type="button"
            className="button button--outline"
            disabled={page >= document.numPages}
            onClick={() => go(page + 1)}
          >
            Berikutnya →
          </button>
        </div>
      )}
      {error ? (
        <Notice kind="error">
          {error}
          <button
            type="button"
            className="button button--outline"
            onClick={() => setRetry((r) => r + 1)}
          >
            Coba preview lagi
          </button>
        </Notice>
      ) : (
        !ready && <SkeletonRows title="Merender halaman PDF" rows={3} />
      )}
      <div ref={host} className="mg-pdf-canvas-host">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${title}, halaman ${page} dari ${document?.numPages || "…"}`}
          data-rendered={ready ? "true" : "false"}
          hidden={!ready || Boolean(error)}
        />
      </div>
      {ready && (
        <details className="mg-pdf-text">
          <summary>Teks halaman untuk pembaca layar</summary>
          <p>{text}</p>
        </details>
      )}
    </section>
  );
}
