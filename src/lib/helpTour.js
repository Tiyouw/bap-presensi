import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { helpTopic, saveTourProgress } from "./helpContent.js";
import { beginHelpLayer, restoreHelpFocus } from "./helpActivity.js";

// Stable anchors describe UI intent, independent of CSS, translated labels or IDs.
const target = (name) => document.querySelector(`[data-tour="${name}"]`);
const visible = (e) =>
  e?.isConnected &&
  e.getClientRects().length &&
  getComputedStyle(e).visibility !== "hidden";
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function descriptions(id, context) {
  if (id === "class")
    return [
      [
        "class-tabs",
        "navigation",
        "Pilih bagian kelas",
        "Tab yang tersedia mengikuti aksesmu. Tur tidak memindahkan tab atau mengubah data.",
      ],
      [
        "tab-mahasiswa",
        "roster",
        "Daftar mahasiswa",
        "Daftar aktif dan impor dikelola dari sini sesuai izin. Data historis tetap terpisah.",
      ],
      [
        "tab-jadwal",
        "schedule",
        "Jadwal pertemuan",
        "Periksa tanggal dan jenis; buka koreksi sesi bila fitur revisi dan izinmu tersedia.",
      ],
      [
        "tab-template",
        "template",
        "Template BAP",
        "Preview dan versi terbit dikelola dari sini sesuai izin.",
      ],
      [
        "tab-pengaturan",
        "identity",
        "Identitas dan akses",
        "Pengaturan memuat bagian yang dapat kamu kelola di kelas ini.",
      ],
      [
        "page-help",
        "navigation",
        "Bantuan kapan saja",
        "Ikon (?) di header membuka panduan halaman. Pilih Tunjukkan caranya di panel bantuan untuk menjalankan ulang tur.",
      ],
    ];
  if (id === "attendance")
    return [
      [
        "attendance-heading",
        "attendance",
        "Periksa sesi",
        "Pastikan nomor dan tanggal benar sebelum mencatat. Tur hanya menjelaskan layar.",
      ],
      ["attendance-mode", "statuses", "Pilih status", null],
      [
        "attendance-filter",
        "attendance",
        "Cari dan filter",
        "Gunakan nama/NIM atau golongan. Simpan tetap mencakup seluruh sesi, bukan hanya hasil filter.",
      ],
      [
        "attendance-list",
        "calling",
        "Periksa mahasiswa",
        "Tandai mahasiswa pada daftar atau gunakan Mode Panggil; tur tidak memilih status.",
      ],
      ["attendance-save", "lock", "Periksa dan simpan", null],
      ["attendance-documents", "documents", "Dokumen dan versi", null],
    ];
  return [
    ["correction-date", "date", "Tanggal pelaksanaan", null],
    ["correction-snapshot", "snapshot", "Pilih data yang ikut berubah", null],
    [
      "correction-reason",
      "correction",
      "Catatan perubahan",
      "Tulis alasan yang membantu pengguna lain memahami revisi. Tur tidak mengisi atau menyimpan alasan.",
    ],
    [
      "correction-preview",
      "correction",
      "Periksa dampak",
      "Tekan Periksa perubahan sendiri setelah edit selesai. Setelah preview, tombol Simpan revisi tersedia; periksa dampak sebelum menyetujuinya.",
    ],
    [
      "correction-save",
      "correction",
      "Simpan revisi",
      "Tombol ini menerbitkan revisi yang sudah diperiksa. Tur tidak menekan tombol atau membuat revisi.",
    ],
    [
      "correction-history",
      "history",
      "Riwayat dan dokumen",
      "Revisi dan file lama tetap ada. Sesudah menyimpan sendiri, buat Word/PDF baru dari versi yang berlaku.",
    ],
  ];
}
const REQUIRED = {
  class: ["class-tabs", "page-help"],
  attendance: ["attendance-heading", "attendance-list", "attendance-save"],
  correction: ["correction-date", "correction-preview", "correction-history"],
};
async function waitForTargets(id, signal) {
  const ready = () => REQUIRED[id]?.every((name) => visible(target(name)));
  if (signal?.aborted) return false;
  if (ready()) return true;
  return new Promise((resolve) => {
    let observer, timer;
    const finish = (value) => {
        observer?.disconnect();
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        resolve(value);
      },
      abort = () => finish(false);
    observer = new MutationObserver(() => {
      if (ready()) finish(true);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    timer = setTimeout(() => finish(false), 2500);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function runHelpTour({
  id,
  context,
  anchor,
  signal,
  onNotice,
  onEnd,
}) {
  const ready = await waitForTargets(id, signal);
  if (!ready) {
    if (!signal?.aborted)
      onNotice(
        "Elemen tur belum tersedia pada tampilan ini. Buka Bantuan halaman ini untuk membaca langkahnya, atau coba lagi setelah data siap.",
      );
    onEnd();
    return { stop() {}, isActive: () => false };
  }

  let instance,
    ended = false,
    complete = false,
    observer,
    sizing,
    step = 0;
  const namespace = import.meta.env.VITE_CONVEX_URL || "local",
    scrolls = [{ element: window, x: window.scrollX, y: window.scrollY }];
  for (const e of document.querySelectorAll(".modal,.ws-main,.mg-main"))
    if (e.scrollHeight > e.clientHeight)
      scrolls.push({ element: e, x: e.scrollLeft, y: e.scrollTop });
  const items = descriptions(id, context).filter(
    ([name, topic]) => visible(target(name)) && helpTopic(topic, context),
  );
  if (items.length < 2) {
    onNotice(
      "Elemen tur belum tersedia pada tampilan ini. Buka Bantuan halaman ini untuk membaca langkahnya, atau coba lagi setelah data siap.",
    );
    onEnd();
    return { stop() {}, isActive: () => false };
  }
  const endLayer = beginHelpLayer();
  const save = (status) => {
    let storage;
    try {
      storage = localStorage;
    } catch {}
    if (!saveTourProgress(storage, namespace, context.userId, id, status, step))
      onNotice(
        "Status panduan belum tersimpan di perangkat. Tur tetap dapat dipakai; tidak ada data akademik yang berubah.",
      );
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    observer?.disconnect();
    sizing?.disconnect();
    window.removeEventListener("keydown", keys, true);
    window.removeEventListener("keyup", keyUp, true);
    endLayer();
    save(complete ? "completed" : "skipped");
    onEnd();
    for (const s of scrolls)
      s.element.scrollTo({ left: s.x, top: s.y, behavior: "instant" });
    requestAnimationFrame(() => restoreHelpFocus(anchor));
  };
  const stop = (reason) => {
    if (ended) return;
    instance?.destroy();
    finish();
    if (reason === "missing")
      onNotice(
        "Tampilan berubah sehingga langkah tur dihentikan. Draf tetap ada; buka panduan atau mulai ulang pada tampilan terbaru.",
      );
  };
  const keys = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      stop("escape");
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const nodes = [
          ...document.querySelectorAll(".bap-help-tour button:not(:disabled)"),
        ].filter(visible),
        index = nodes.indexOf(document.activeElement);
      nodes[
        index < 0
          ? e.shiftKey
            ? nodes.length - 1
            : 0
          : (index + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length
      ]?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (instance.hasNextStep()) instance.moveNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (instance.hasPreviousStep()) instance.movePrevious();
    }
    e.stopPropagation();
  };
  const keyUp = (e) => e.stopPropagation();
  instance = driver({
    animate: false,
    smoothScroll: false,
    allowKeyboardControl: false,
    disableActiveInteraction: true,
    overlayClickBehavior: "none",
    allowClose: true,
    showProgress: true,
    progressText: "Langkah {{current}} dari {{total}}",
    nextBtnText: "Lanjut",
    prevBtnText: "Kembali",
    doneBtnText: "Selesai",
    closeBtnLabel: "Lewati dan tutup tur",
    popoverClass: "bap-help-tour",
    steps: items.map(([name, topic, title, description]) => ({
      element: () => target(name),
      popover: {
        title,
        description: escape(description || helpTopic(topic, context).summary),
        side: "bottom",
        align: "start",
      },
    })),
    onHighlighted: (element, _, options) => {
      step = options.index || 0;
      save("started");
      if (!visible(element)) stop("missing");
    },
    onPopoverRender: (popover) => {
      sizing?.disconnect();
      sizing = new ResizeObserver(() => {
        if (!ended) instance.refresh();
      });
      sizing.observe(popover.wrapper);
      const active = target(items[step]?.[0]);
      if (active) sizing.observe(active);
      popover.wrapper.setAttribute("aria-modal", "true");
      const host = target(items[step]?.[0])?.closest('[role="dialog"]');
      if (host) host.appendChild(popover.wrapper);
      requestAnimationFrame(() => {
        if (!ended) {
          popover.closeButton.focus({ preventScroll: true });
          instance.refresh();
        }
      });
    },
    onDoneClick: () => {
      complete = true;
      instance.destroy();
    },
    onDestroyed: finish,
  });
  window.addEventListener("keydown", keys, true);
  window.addEventListener("keyup", keyUp, true);
  observer = new MutationObserver(() => {
    if (!ended && !visible(instance.getActiveElement())) stop("missing");
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "class", "style"],
  });
  onNotice("");
  save("started");
  try {
    instance.drive();
  } catch {
    stop("error");
    onNotice(
      "Tur belum dapat dibuka pada tampilan ini. Gunakan Bantuan halaman ini; pekerjaanmu tetap ada.",
    );
  }
  return { stop, isActive: () => !ended && instance.isActive() };
}
