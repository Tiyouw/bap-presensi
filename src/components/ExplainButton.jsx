import { confirmAction, noticeDialog } from "../lib/appDialog.js";

// Keep unavailable actions reachable so keyboard, touch and pointer users get the same reason.
export default function ExplainButton({ unavailable, reason, resolveLabel, onResolve, onClick, children, type = "button", ...props }) {
  return <button {...props} type={type} aria-disabled={Boolean(unavailable)} onClick={async e => {
    if (!unavailable) {
      // Navigation may reuse this DOM button for the next step's submit action.
      // Consume the original click before a route render changes its form owner.
      e.preventDefault();
      if (type === "submit") e.currentTarget.form?.requestSubmit();
      else onClick?.(e);
      return;
    }
    e.preventDefault();
    const message = reason || "Tunggu sampai proses saat ini selesai, lalu coba lagi.";
    if (onResolve) {
      if (await confirmAction(message, { title: "Langkah ini belum siap", confirmLabel: resolveLabel || "Lihat yang perlu dilengkapi", danger: false }))
        requestAnimationFrame(onResolve);
    } else void noticeDialog(message, { title: "Langkah ini belum siap" });
  }}>{children}</button>;
}
