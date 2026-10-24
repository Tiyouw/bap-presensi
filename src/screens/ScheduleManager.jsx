import ClassTabHeading from "../components/ClassTabHeading.jsx";
import { parseDate } from "../components/DateField.jsx";
import FileDrop from "../components/FileDrop.jsx";
import { confirmAction } from "../lib/appDialog.js";
import { HelpGroup, DisabledReason } from "../components/Help.jsx";
import {
  removeCompletedDraft,
  discardStoredDraft,
} from "../lib/draftStorage.js";
import {
  draftEnvelope,
  readDraftFile,
  validScheduleDraft,
} from "../lib/draftFile.js";
import { useEffect, useRef, useState } from "react";
import {
  useConvex,
  useMutation,
  useQuery,
  usePaginatedQuery,
} from "convex/react";
import { api } from "../../convex/_generated/api.js";
import { TYPES } from "../../bap-shared/management.js";
import { meetingHadAttendance } from "../../bap-shared/control.js";
import { Field, useTask, Feedback } from "../components/Form.jsx";
import { Notice } from "../components/Layout.jsx";
import { useScopedStore } from "../lib/ScopedStorage.jsx";
import { useDraftLock } from "../lib/useDraftLock.js";
import { useEditorGuard } from "../lib/useEditorGuard.js";
import { navigate, linkClick } from "../lib/navigation.js";
import { hariIni, pesanGalat } from "../lib/presensi.js";
const historic = meetingHadAttendance;
const fresh = (data) => ({
  version: 1,
  base: data.kelas.revision,
  meetings: Object.fromEntries(
    data.pertemuan.filter((p) => !p.cancelled).map((p) => [p.id, p.revision]),
  ),
  selected: [],
  patches: {},
  reason: "",
  includeHistorical: false,
  operationKey: crypto.randomUUID(),
});
const tracked = (d) => ({
  selected: d.selected,
  patches: d.patches,
  reason: d.reason,
  includeHistorical: d.includeHistorical,
});
function readDraft(key, data) {
  try {
    const d = JSON.parse(localStorage.getItem(key) || "null");
    return validScheduleDraft(d) ? d : fresh(data);
  } catch {
    return fresh(data);
  }
}
function exportDraft(d, scope) {
  const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify(draftEnvelope("schedule", scope, null, d), null, 2)],
        { type: "application/json" },
      ),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "draf-jadwal-bap.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ScheduleManager({
  token,
  data,
  manage,
  network = { online: true },
  onStepState,
}) {
  const store = useScopedStore(),
    key = `bap.schedule.${store.scope}`,
    client = useConvex(),
    task = useTask(),
    commit = useMutation(api.scheduleBatches.commitScheduleBatch),
    remove = useMutation(api.meetingCommands.deleteEmptyMeeting),
    processing = useRef(false);
  useEffect(() => () => onStepState?.({busy:false,dirty:false}), [onStepState]);
  const [draft, setDraft] = useState(() => readDraft(key, data)),
    ref = useRef(draft);
  ref.current = draft;
  const [recoveredJob, setRecoveredJob] = useState(null),
    [completedKey, setCompletedKey] = useState(null);
  const [adding, setAdding] = useState(false);
  const recovered = useQuery(
    api.scheduleBatches.jobDetail,
    recoveredJob ? { token, jobId: recoveredJob } : "skip",
  );
  const [preview, setPreview] = useState(null),
    [showCancelled, setShowCancelled] = useState(false),
    [storageError, setStorageError] = useState(false),
    [discardError, setDiscardError] = useState(false);
  const reviewRegion = useRef(null);
  useEffect(() => {
    if (preview) {
      reviewRegion.current?.querySelector("h3")?.focus({preventScroll:true});
      reviewRegion.current?.scrollIntoView({block:"start"});
    }
  }, [preview]);
  const latest = useRef(data);
  latest.current = data;
  const editor = useDraftLock(`${store.scope}:schedule`, () => {
    const d = readDraft(key, latest.current);
    ref.current = d;
    setDraft(d);
  });
  const guard = useEditorGuard(
    tracked(draft),
    true,
    task.busy || adding,
    completedKey === draft.operationKey
      ? "Draf ini sudah memiliki pekerjaan tersimpan. Isi lokal tetap disimpan. Tinggalkan editor?"
      : "Perubahan jadwal belum diterapkan. Draf lokal tetap disimpan jika penyimpanan tersedia. Tinggalkan editor?",
  );
  useEffect(() => {
    guard.markSaved(tracked(fresh(data)));
  }, []);
  useEffect(() => {
    if (
      !draft.selected.length &&
      !Object.keys(draft.patches).length &&
      !draft.reason &&
      draft.base !== data.kelas.revision
    ) {
      const next = {
        ...draft,
        base: data.kelas.revision,
        meetings: fresh(data).meetings,
      };
      ref.current = next;
      setDraft(next);
    }
  }, [data.kelas.revision]);
  const {
    results: jobs,
    status: jobPageStatus,
    loadMore,
  } = usePaginatedQuery(
    api.scheduleBatches.jobsPage,
    { token, kelasId: data.kelas.id },
    { initialNumItems: 10 },
  );
  const clear = (completedKey) => {
    const next = fresh(latest.current);
    ref.current = next;
    setDraft(next);
    setPreview(null);
    guard.markSaved(tracked(next));
    setStorageError(false);
    setDiscardError(
      !(completedKey
        ? removeCompletedDraft(key, completedKey)
        : discardStoredDraft(key, next)),
    );
  };
  useEffect(() => {
    const completed = jobs.find(
      (job) => job.operationKey === ref.current.operationKey,
    );
    if (completed) {
      setCompletedKey(completed.operationKey);
      setRecoveredJob(completed._id);
    }
  }, [jobs]);
  useEffect(() => {
    if (!network.online) return;
    let disposed = false;
    const operationKey = draft.operationKey;
    client
      .query(api.scheduleBatches.findOperation, {
        token,
        kelasId: data.kelas.id,
        operationKey,
      })
      .then((job) => {
        if (!disposed && job && ref.current.operationKey === operationKey) {
          setRecoveredJob(job._id);
          setCompletedKey(operationKey);
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [draft.operationKey, network.online]);
  const update = (fn) => {
    if (!editor.owns() || processing.current) return;
    const next = fn(ref.current);
    ref.current = next;
    setDraft(next);
    setPreview(null);
    task.clear();
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setStorageError(false);
      setDiscardError(false);
    } catch {
      setStorageError(true);
    }
  };
  const canCorrect = data.controls.capabilities.some((c) =>
      [
        "schedule",
        "history",
        "identity",
        "roster",
        "template",
        "lifecycle",
      ].includes(c),
    ),
    canEdit =
      manage && editor.owned && data.controls.capabilities.includes("schedule"),
    stale = draft.base !== data.kelas.revision,
    disabled = !canEdit || task.busy || adding;
  const run = (fn, message) => {
    if (processing.current) return;
    processing.current = true;
    task
      .run(fn, message)
      .catch(() => {})
      .finally(() => (processing.current = false));
  };
  const [continueAfterSave, setContinueAfterSave] = useState(false),
    [finished, setFinished] = useState(false),
    [progress, setProgress] = useState(null);
  const advance = useMutation(api.scheduleBatches.advanceScheduleJob),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    onStepState?.({
      busy: task.busy || adding,
      dirty: draft.selected.length > 0,
    });
  }, [task.busy, adding, draft.selected.length, onStepState]);
  useEffect(() => {
    if (finished && !task.busy && continueAfterSave)
      void navigate(`/kelas/${data.kelas.id}?tab=template`);
  }, [finished, task.busy, continueAfterSave]);
  const selected = draft.selected
    .map((id) => data.pertemuan.find((p) => p.id === id))
    .filter(Boolean);
  const invalidDates = selected.some(p => !parseDate(draft.patches[p.id]?.tanggal ?? p.tanggal));

  const previewDates = () =>
    run(async () => {
      const args = {
          token,
          kelasId: data.kelas.id,
          expectedClassRevision: draft.base,
          includeHistorical: draft.includeHistorical,
          reason: draft.reason.trim() || "Penyesuaian tanggal pertemuan",
          items: selected.map((p) => ({
            pertemuanId: p.id,
            expectedRevision: draft.meetings[p.id],
            patch: draft.patches[p.id] || {},
          })),
        },
        result = await client.query(
          api.scheduleBatches.previewScheduleBatch,
          args,
        );
      setPreview({ args, result, operationKey: draft.operationKey });
    }, "Periksa tanggal sebelum menyimpan.");
  const changeDate = (p, tanggal) =>
    update((d) => {
      const patches = { ...d.patches },
        selected = d.selected.filter((id) => id !== p.id);
      if (tanggal !== p.tanggal) {
        patches[p.id] = { ...patches[p.id], tanggal };
        selected.push(p.id);
      } else delete patches[p.id];
      return { ...d, patches, selected };
    });
  return (
    <section className="control-schedule">
      <ClassTabHeading
        title="Jadwal pertemuan"
        description="Tambahkan pertemuan, lalu isi tanggalnya. Setelah jadwal siap, lanjutkan ke Template BAP."
      />
      <form
        id="setup-schedule"
        onSubmit={(e) => {
          e.preventDefault();
          if (!selected.length) {
            void navigate(`/kelas/${data.kelas.id}?tab=template`);
            return;
          }
          setContinueAfterSave(true);
          previewDates();
        }}
      />
      <Feedback task={task} />
      <DisabledReason>
        {!manage
          ? "Akunmu belum memiliki izin jadwal pada kelas ini. Hubungi Pengelola."
          : null}
      </DisabledReason>
      {task.busy && (
        <div className="operation-progress" role="status">
          <progress
            aria-label="Proses jadwal"
            max={progress?.total || 1}
            value={progress?.applied}
          />
          <span>
            {progress
              ? `Menyimpan tanggal · ${progress.applied}/${progress.total} sesi`
              : "Memproses jadwal…"}
          </span>
        </div>
      )}
      {!network.online && (
        <Notice kind="warning">
          Offline. Draf jadwal dapat disunting; pemeriksaan dan penyimpanan
          memerlukan koneksi.
        </Notice>
      )}
      {editor.ready && !editor.owned && (
        <Notice kind="warning">
          Editor jadwal sedang dipakai tab lain atau browser belum mendukung
          penguncian. Halaman ini hanya membaca.
        </Notice>
      )}
      {storageError && (
        <Notice kind="warning">
          Draf belum tersimpan di perangkat. Unduh sebelum menutup halaman.
          <button
            className="button button--outline"
            onClick={() => exportDraft(draft, store.scope)}
          >
            Unduh draf jadwal
          </button>
        </Notice>
      )}
      {discardError && (
        <Notice kind="warning">
          Draf tersimpan belum berhasil dihapus. Coba Buang draf lagi sebelum
          menutup; perangkat dapat memuat draf lama jika penghapusan masih
          gagal.
        </Notice>
      )}
      {completedKey === draft.operationKey && (
        <Notice kind="warning">
          Draf ini sudah memiliki pengerjaan tersimpan. Isinya tetap
          dipertahankan agar perubahan baru tidak hilang. Lihat status
          pekerjaan, buang draf, atau gunakan isinya sebagai perubahan baru.
          <button
            className="button button--outline"
            disabled={disabled || !network.online}
            onClick={async () => {
              if (
                await confirmAction(
                  "Gunakan isi draf ini untuk perubahan baru? Periksa selisih dengan jadwal aktif sebelum menyimpan.",
                  {
                    title: "Gunakan sebagai perubahan baru?",
                    confirmLabel: "Gunakan draf",
                    danger: false,
                  },
                )
              )
                update((d) => ({
                  ...d,
                  base: data.kelas.revision,
                  meetings: fresh(data).meetings,
                  selected: d.selected.filter((id) =>
                    data.pertemuan.some((p) => p.id === id && !p.cancelled),
                  ),
                  operationKey: crypto.randomUUID(),
                }));
            }}
          >
            Pakai isi draf sebagai perubahan baru
          </button>
        </Notice>
      )}
      {stale && completedKey !== draft.operationKey && (
        <Notice kind="warning">
          Data kelas berubah. Perubahan tanggalmu tetap ada; periksa lagi dengan
          versi terbaru.
          <button
            className="button button--outline"
            disabled={disabled || !network.online}
            onClick={() =>
              update((d) => ({
                ...d,
                base: data.kelas.revision,
                meetings: fresh(data).meetings,
                selected: d.selected.filter((id) =>
                  data.pertemuan.some((p) => p.id === id && !p.cancelled),
                ),
                operationKey: crypto.randomUUID(),
              }))
            }
          >
            Periksa dengan versi jadwal terbaru
          </button>
        </Notice>
      )}

      <AddMeeting
        token={token}
        data={data}
        enabled={canEdit && network.online && !task.busy}
        onBusy={setAdding}
      />
      {!data.pertemuan.length && (
        <p className="muted">
          Belum ada pertemuan. Isi tanggal di atas dan simpan untuk menambahkan
          pertemuan pertama.
        </p>
      )}
      {data.pertemuan.length > 0 && (
        <div className="mg-panel">
          <div className="mg-section-heading">
            <h3>Daftar pertemuan</h3>
            <label className="mg-check">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
              />
              <span>Sertakan sesi dibatalkan</span>
            </label>
          </div>
          <div>
            {data.pertemuan
              .filter((p) => showCancelled || !p.cancelled)
              .map((p) => (
                <article className="control-schedule-row" key={p.id}>
                  <div>
                    <strong>Pertemuan {p.nomor}</strong>
                    <p className="muted">
                      {p.tipe === "REGULER" ? "Praktikum" : p.tipe} · {p.tempat}
                      <br />
                      {p.cancelled
                        ? "Dibatalkan"
                        : historic(p)
                          ? `Riwayat revisi ${p.revision}`
                          : "Belum ada presensi"}
                    </p>
                  </div>
                  <Field
                    label={`Tanggal pertemuan ${p.nomor}`}
                    form="setup-schedule"
                    type="date"
                    value={draft.patches[p.id]?.tanggal ?? p.tanggal}
                    required
                    disabled={disabled || p.cancelled || historic(p)}
                    onChange={(tanggal) => changeDate(p, tanggal)}
                  />
                  <div className="mg-inline-actions">
                    {canCorrect && (
                      <a
                        className="button button--outline"
                        href={`/kelas/${data.kelas.id}?tab=jadwal&correct=${p.id}`}
                        onClick={(e) =>
                          linkClick(
                            e,
                            `/kelas/${data.kelas.id}?tab=jadwal&correct=${p.id}`,
                          )
                        }
                      >
                        {p.cancelled
                          ? "Pulihkan / lihat riwayat"
                          : "Edit rincian " + p.nomor}
                      </a>
                    )}
                    {p.revision === 0 &&
                      p.status === "TERBUKA" &&
                      !p.cancelled && (
                        <button
                          type="button"
                          className="button button--quiet"
                          disabled={disabled || !network.online}
                          onClick={async () => {
                            if (
                              !(await confirmAction(
                                `Hapus pertemuan kosong ${p.nomor}? Sesi dengan riwayat hanya dapat dibatalkan.`,
                                {
                                  title: "Hapus sesi kosong?",
                                  confirmLabel: "Hapus sesi kosong",
                                  danger: true,
                                },
                              ))
                            )
                              return;
                            run(
                              async () =>
                                remove({
                                  token,
                                  kelasId: data.kelas.id,
                                  pertemuanId: p.id,
                                  expectedMeetingRevision: p.revision,
                                  expectedClassRevision: data.kelas.revision,
                                  operationKey: crypto.randomUUID(),
                                }),
                              "Pertemuan kosong dihapus.",
                            );
                          }}
                        >
                          Hapus sesi kosong {p.nomor}
                        </button>
                      )}
                  </div>
                </article>
              ))}
          </div>
          {selected.length > 0 && (
            <div className="schedule-save">
              <p>{selected.length} tanggal belum disimpan.</p>
              <Field
                label="Catatan perubahan tanggal (opsional)"
                maxLength="240"
                value={draft.reason}
                onChange={(reason) => update((d) => ({ ...d, reason }))}
              />
              <button
                type="button"
                className="button button--primary"
                disabled={
                  disabled ||
                    invalidDates ||
                  !network.online ||
                  stale ||
                  completedKey === draft.operationKey
                }
                onClick={() => {
                  setContinueAfterSave(false);
                  previewDates();
                }}
              >
                Periksa perubahan tanggal
              </button>
            </div>
          )}
        </div>
      )}
      {preview && (
        <section ref={reviewRegion} className="mg-panel" aria-label="Tinjau perubahan tanggal" style={{scrollMarginTop:80}}>
          <h3 tabIndex={-1}>{preview.result.count} sesi akan berubah</h3>
          <BatchDiff items={preview.result.items} />
          {preview.result.warnings.map((w) => (
            <Notice kind="warning" key={w}>
              {w}
            </Notice>
          ))}
          <p>
            Periksa tanggal sebelum dan sesudah. Riwayat presensi tetap
            disimpan.
          </p>
          <button
            type="button"
            className="button button--primary"
            disabled={
              disabled ||
              stale ||
              completedKey === draft.operationKey ||
              !network.online
            }
            onClick={() =>
              run(async () => {
                let result = await commit({
                  ...preview.args,
                  previewHash: preview.result.previewHash,
                  operationKey: preview.operationKey,
                });
                const jobId = result.jobId;
                setRecoveredJob(jobId);
                setProgress({
                  applied: result.applied,
                  total: preview.result.count,
                });
                while (
                  alive.current &&
                  ["PENDING", "RUNNING"].includes(result.status)
                ) {
                  result = await advance({ token, jobId });
                  setProgress({
                    applied: result.applied,
                    total: result.count || preview.result.count,
                  });
                }
                if (result.status !== "DONE")
                  throw Error(
                    "Sebagian tanggal perlu ditinjau. Buka status penyimpanan di bagian Pemulihan perubahan.",
                  );
                clear(preview.operationKey);
                setFinished(true);
                setProgress(null);
              }, "Tanggal pertemuan tersimpan.")
            }
          >
            Simpan perubahan {preview.result.count} sesi
          </button>
        </section>
      )}
      <details className="mg-panel schedule-recovery">
        <summary>Pemulihan perubahan tersimpan</summary>
        <p className="muted">
          Lewati bagian ini saat pertama kali membuat kelas. File draf hanya
          tersedia jika sebelumnya kamu mengunduh draf jadwal dari aplikasi ini.
        </p>
        <FileDrop
          label="Pulihkan draf jadwal dari file"
          accept=".json"
          disabled={disabled || !network.online}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            run(async () => {
              const d = await readDraftFile(
                  file,
                  "schedule",
                  store.scope,
                  null,
                ),
                job = await client.query(api.scheduleBatches.findOperation, {
                  token,
                  kelasId: data.kelas.id,
                  operationKey: d.operationKey,
                });
              if (job) {
                setRecoveredJob(job._id);
                task.clear();
                setPreview(null);
                return;
              }
              if (
                !(await confirmAction(
                  "Muat file menggantikan draf jadwal pada editor ini? Unduh draf sekarang terlebih dahulu bila masih diperlukan.",
                  {
                    title: "Ganti draf jadwal?",
                    confirmLabel: "Muat draf file",
                    danger: true,
                  },
                ))
              )
                return;
              if (!editor.owns())
                throw Error("Editor sedang dipakai tab lain.");
              ref.current = d;
              setDraft(d);
              setPreview(null);
              try {
                localStorage.setItem(key, JSON.stringify(d));
                setStorageError(false);
              } catch {
                setStorageError(true);
              }
            }, "Draf diperiksa. Jika sudah diterapkan, lihat pengerjaan yang dipulihkan.");
          }}
        />
        <div className="mg-inline-actions">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => exportDraft(draft, store.scope)}
          >
            Unduh draf jadwal
          </button>
          <button
            type="button"
            className="button button--quiet"
            disabled={disabled}
            onClick={async () => {
              if (
                editor.owns() &&
                !processing.current &&
                (await confirmAction(
                  "Buang draf jadwal di perangkat ini? Jadwal yang berlaku dan pekerjaan tersimpan tidak berubah.",
                  {
                    title: "Buang draf lokal?",
                    confirmLabel: "Buang draf",
                    danger: true,
                  },
                ))
              ) {
                if (!editor.owns() || processing.current) return;
                clear();
                task.clear();
              }
            }}
          >
            Buang draf jadwal
          </button>
        </div>
        {recovered && !jobs.some((j) => j._id === recoveredJob) && (
          <ScheduleJob
            token={token}
            job={recovered.job || recovered}
            online={network.online}
            enabled={canEdit}
          />
        )}
        <h3>Status penyimpanan & pemulihan</h3>
        <p className="muted">
          Jika penyimpanan terputus, lanjutkan pekerjaan yang sama di sini.
        </p>
        {jobs.map((job) => (
          <ScheduleJob
            key={job._id}
            token={token}
            job={job}
            online={network.online}
            enabled={canEdit}
          />
        ))}
        {!jobs.length && <p>Belum ada pekerjaan tersimpan.</p>}
        {jobPageStatus === "CanLoadMore" && (
          <button
            type="button"
            className="button button--outline"
            onClick={() => loadMore(10)}
          >
            Muat pekerjaan sebelumnya
          </button>
        )}
      </details>
    </section>
  );
}

function BatchDiff({items}){return <div className="control-table"><table><thead><tr><th>Sesi</th><th>Sebelum</th><th>Sesudah</th></tr></thead><tbody>{items.map((i,n)=><tr key={i.pertemuanId||i.id||n}><td>{i.before.nomor}</td><td>{i.before.tanggal} · {i.before.tempat}</td><td>{i.after?.tanggal||i.patch.tanggal||i.before.tanggal} · {i.after?.tempat||i.patch.tempat||i.before.tempat}{i.skip?(i.unavailable?' · dilewati setelah review':' · sudah sesuai'):i.unavailable?' · tidak tersedia, pilih lewati':''}</td></tr>)}</tbody></table></div>}
function AddMeeting({ token, data, enabled, onBusy }) {
  const [form, setForm] = useState({
      nomor: Math.max(0, ...data.pertemuan.map((p) => p.nomor)) + 1,
      tanggal: "",
      tempat: data.kelas.tempat,
      tipe: "REGULER",
    }),
    task = useTask(),
    add = useMutation(api.meetingCommands.addMeeting),
    key = useRef(crypto.randomUUID()),
    pending = useRef(null);
  useEffect(() => {
    onBusy?.(task.busy);
  }, [task.busy, onBusy]);
  const guard = useEditorGuard(form, true, task.busy),
    set = (field, value) => {
      pending.current = null;
      key.current = crypto.randomUUID();
      setForm((f) => ({ ...f, [field]: value }));
    };
  return (
    <details
      className="mg-panel"
      open={data.pertemuan.length === 0 ? true : undefined}
    >
      <summary>Tambahkan satu pertemuan</summary>
      <Feedback task={task} />
      {task.busy && (
        <div className="operation-progress" role="status">
          <progress aria-label="Penyimpanan pertemuan" />
          <span>Menyimpan pertemuan…</span>
        </div>
      )}
      <fieldset disabled={!enabled || task.busy}>
        <div className="mg-form-grid">
          <Field
            label="Nomor pertemuan baru"
            type="number"
            min="1"
            max="1000"
            value={form.nomor}
            onChange={(v) => set("nomor", Number(v))}
          />
          <Field
            label="Tanggal pertemuan baru"
            type="date"
            value={form.tanggal}
            onChange={(v) => set("tanggal", v)}
          />
          <Field
            label="Ruang pertemuan baru"
            value={form.tempat}
            onChange={(v) => set("tempat", v)}
          />
          <Field
            label="Jenis pertemuan baru"
            value={form.tipe}
            options={TYPES.map((v) => ({
              value: v,
              label: v === "REGULER" ? "Praktikum" : v,
            }))}
            onChange={(v) => set("tipe", v)}
          />
        </div>
        <button
          className="button button--outline"
          disabled={!parseDate(form.tanggal)}
          onClick={() =>
            task
              .run(async () => {
                pending.current ||= {
                  token,
                  kelasId: data.kelas.id,
                  expectedClassRevision: data.kelas.revision,
                  operationKey: key.current,
                  data: form,
                };
                await add(pending.current);
                pending.current = null;
                guard.markSaved();
                key.current = crypto.randomUUID();
                const next = { ...form, nomor: form.nomor + 1, tanggal: "" };
                setForm(next);
                guard.markSaved(next);
              }, "Pertemuan ditambahkan.")
              .catch(() => {})
          }
        >
          Simpan pertemuan baru
        </button>
      </fieldset>
    </details>
  );
}
function ScheduleJob({token,job,online,enabled}){
 const client=useConvex(),advance=useMutation(api.scheduleBatches.advanceScheduleJob),resume=useMutation(api.scheduleBatches.resumeScheduleJob),undo=useMutation(api.scheduleBatches.commitUndoJob),cancel=useMutation(api.scheduleBatches.cancelScheduleJob),task=useTask(),stop=useRef(false),running=useRef(false);
 const [review,setReview]=useState(null),[reason,setReason]=useState('Penyesuaian jadwal praktikum'),[expanded,setExpanded]=useState(false);
 const detail=useQuery(api.scheduleBatches.jobDetail,expanded?{token,jobId:job._id}:'skip');
 useEffect(()=>()=>{stop.current=true},[]);
 const drive=async()=>{stop.current=false;let result;do{result=await advance({token,jobId:job._id});}while(!stop.current&&(result.status==='RUNNING'||result.status==='PENDING'));return result;};
 const run=(fn,message)=>{if(running.current)return;running.current=true;task.run(fn,message).catch(()=>{}).finally(()=>running.current=false)};
 const refreshResume=async(skipIds)=>setReview({kind:'resume',skipIds,result:await client.query(api.scheduleBatches.previewResumeJob,{token,jobId:job._id,skipIds})});
 const labels={PENDING:'Belum dimulai',RUNNING:'Sedang diproses',DONE:'Selesai',NEEDS_REVIEW:'Periksa konflik',CANCELLED:'Sisa pekerjaan dihentikan'};
 return <article className="control-job"><div className="mg-list-row"><span><strong>{labels[job.status]||job.status} · {job.applied}/{job.count} sesi diterapkan</strong><small>{job.reason} · {new Date(job.createdAt).toLocaleString('id-ID')}{job.skipped?` · ${job.skipped} sesi sudah sesuai`:''}</small></span><button className="button button--quiet" onClick={()=>setExpanded(v=>!v)}>{expanded?'Tutup detail':'Lihat detail'}</button></div><Feedback task={task}/>
   <div className="mg-inline-actions">{['PENDING','RUNNING'].includes(job.status)&&<button className="button button--outline" disabled={!enabled||!online||task.busy} onClick={()=>run(drive,'Status pengerjaan diperbarui.')}>Lanjutkan pengerjaan</button>}{task.busy&&<button className="button button--quiet" onClick={()=>stop.current=true}>Tunda setelah sesi ini</button>}{job.status==='NEEDS_REVIEW'&&<button className="button button--outline" disabled={!enabled||!online||task.busy} onClick={()=>run(async()=>setReview({kind:'resume',result:await client.query(api.scheduleBatches.previewResumeJob,{token,jobId:job._id})}),'Sisa pekerjaan siap diperiksa.')}>Periksa ulang sisa pekerjaan</button>}</div>
   {expanded&&<><Field label="Catatan tindakan" value={reason} maxLength="240" onChange={v=>{setReason(v);setReview(null)}}/>{detail?.items.map(i=><p key={i._id} className="muted">Pertemuan {i.before.nomor} · {({APPLIED:'Diterapkan',PENDING:'Menunggu',CONFLICT:'Perlu diperiksa',CANCELLED:'Dihentikan',SKIPPED:'Sudah sesuai'})[i.status]||i.status}{i.undoRevision?` · dipulihkan pada revisi ${i.undoRevision}`:''}{i.error?` · ${pesanGalat({data:i.error})}`:''}</p>)}<div className="mg-inline-actions">{job.applied>0&&<button className="button button--outline" disabled={!enabled||!online||task.busy} onClick={()=>run(async()=>setReview({kind:'undo',reason,operationKey:crypto.randomUUID(),result:await client.query(api.scheduleBatches.previewUndoJob,{token,jobId:job._id,reason})}),'Preview pemulihan siap.')}>Periksa pemulihan hasil batch</button>}{!['DONE','CANCELLED'].includes(job.status)&&<button className="button button--quiet" disabled={!enabled||!online||task.busy} onClick={()=>setReview({kind:'cancel',reason})}>Hentikan sisa pekerjaan</button>}</div></>}
   {review&&<section className="control-job-review"><h4>{review.kind==='resume'?'Periksa pekerjaan yang tersisa':review.kind==='undo'?'Pulihkan sebagai revisi baru':'Hentikan yang belum diterapkan'}</h4>{review.kind==='cancel'?<p>{job.applied} sesi yang sudah diterapkan tetap disimpan. Hanya sisa pekerjaan yang dihentikan.</p>:<BatchDiff items={review.result.items||review.result.remaining}/>} {review.kind==='undo'&&review.result.conflicts.length>0&&<Notice kind="warning">{review.result.conflicts.length} sesi sudah berubah lagi dan tidak ikut dipulihkan. Hanya {review.result.eligibleIds.length} sesi pada preview ini yang akan diubah.</Notice>}<ResumeSkipChoices review={review} busy={task.busy} onChange={ids=>run(()=>refreshResume(ids),'Preview sisa pekerjaan diperbarui.')}/><button className="button button--primary" disabled={!enabled||!online||task.busy||review.kind==='resume'&&review.result.remaining.some(i=>i.unavailable&&!i.skip)} onClick={()=>run(async()=>{if(review.kind==='resume'){await resume({token,jobId:job._id,previewHash:review.result.previewHash,skipIds:review.skipIds||[]});setReview(null);await drive();}else if(review.kind==='undo'){await undo({token,jobId:job._id,reason:review.reason,selectedIds:review.result.eligibleIds,previewHash:review.result.previewHash,operationKey:review.operationKey});setReview(null);}else{await cancel({token,jobId:job._id,reason:review.reason});setReview(null);}},'Tindakan pekerjaan tersimpan.')}>Konfirmasi {review.kind==='resume'?'lanjutkan':review.kind==='undo'?'pemulihan':'penghentian'}</button></section>}
 </article>;
}

function ResumeSkipChoices({review,busy,onChange}){if(review.kind!=='resume')return null;const unavailable=review.result.remaining.filter(i=>i.unavailable);if(!unavailable.length)return null;return <div><p>Pilih sesi yang tidak lagi tersedia untuk dilewati. Sesi lain tetap dapat dilanjutkan.</p>{unavailable.map(i=><label className="mg-check" key={i.pertemuanId}><input type="checkbox" checked={Boolean(review.skipIds?.includes(i.pertemuanId))} disabled={busy} onChange={e=>onChange(e.target.checked?[...(review.skipIds||[]),i.pertemuanId]:(review.skipIds||[]).filter(id=>id!==i.pertemuanId))}/><span>Lewati pertemuan {i.before.nomor} yang dibatalkan/dihapus</span></label>)}</div>;}
