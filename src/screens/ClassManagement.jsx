import FileDrop from "../components/FileDrop.jsx";
import { HelpButton } from "../components/Help.jsx";
import PdfPreview from "../components/PdfPreview.jsx";
import Pagination from "../components/Pagination.jsx";
import ClassTabHeading from "../components/ClassTabHeading.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import {
  DEFAULT_TEMPLATE,
  TYPES,
  previewRoster,
  weeklySchedule,
  matches,
} from "../../bap-shared/management.js";
import {
  Field,
  TaskForm,
  useTask,
  Feedback,
  RevisionNotice,
} from "../components/Form.jsx";
import Modal from "../components/Modal.jsx";
import { Notice } from "../components/Layout.jsx";
import { navigate, waitForNavigationIdle } from "../lib/navigation.js";
import { rememberCreatedClass } from "../lib/createdClass.js";
import { showAppToast } from "../lib/appDialog.js";
import { useEditorGuard } from "../lib/useEditorGuard.js";
import { readRosterFile, suggestMapping } from "../lib/importRoster.js";
import ScheduleManager from "./ScheduleManager.jsx";
const defaults = {
  nama: "",
  matkulNama: "",
  matkulKode: "",
  semester: "GASAL",
  tahunAkademik: "2026/2027",
  tingkat: "3",
  prodi: "Destinasi Pariwisata",
  dosen: "",
  dosenId: "",
  asdos: "Marchaenta",
  asdosId: "",
  tempat: "F6",
};
const classFields = [
  ["nama", "Nama kelas"],
  ["semester", "Semester"],
  ["tahunAkademik", "Tahun akademik"],
  ["tingkat", "Tingkat / semester mahasiswa"],
  ["prodi", "Program studi"],
  ["dosen", "Dosen pengampu"],
  ["dosenId", "NIP / NIDN dosen (opsional)"],
  ["asdos", "Asisten dosen"],
  ["asdosId", "Identitas asdos (opsional)"],
  ["tempat", "Ruang bawaan"],
];
export function ClassForm({
  token,
  catalog,
  existing,
  copy,
  onClose,
  scopeCourse = false,
  onSaved,
  onBusy,
}) {
  const source = existing || copy,
    [form, setForm] = useState({
      ...defaults,
      ...source,
      ...(!existing ? { nama: copy ? `${copy.nama} — baru` : "" } : {}),
    }),
    [matkulId, setMatkul] = useState(source?.matkulId || ""),
    [copyRoster, setCopyRoster] = useState(false),
    [baseRevision, setBaseRevision] = useState(existing?.revision);
  const save = useMutation(api.kelola.saveClass),
    task = useTask();
  const guard = useEditorGuard({ form, matkulId, copyRoster }, true, task.busy);
  const [createdId, setCreatedId] = useState(null),
    [redirectFailed, setRedirectFailed] = useState(false);
  const creating = useRef(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  useEffect(() => {
    onBusy?.(task.busy);
  }, [task.busy, onBusy]);
  useEffect(() => () => onBusy?.(false), [onBusy]);
  useEffect(() => {
    if (settingsSaved && !task.busy) {
      setSettingsSaved(false);
      onSaved?.();
    }
  }, [settingsSaved, task.busy]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const openCreated = async (id) => {
    await waitForNavigationIdle();
    if (!mounted.current) return;
    const opened = await navigate(`/kelas/${id}?tab=mahasiswa`);
    if (opened)
      showAppToast(
        "Kelas draf berhasil dibuat. Tambahkan atau periksa mahasiswa.",
      );
    else if (mounted.current) setRedirectFailed(true);
  };
  useEffect(() => {
    if (createdId && !task.busy) void openCreated(createdId);
  }, [createdId, task.busy]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <TaskForm
      task={task}
      id={existing ? "setup-identity" : undefined}
      className="mg-class-form"
      onSubmit={() => {
        if (creating.current || createdId) return Promise.resolve();
        creating.current = true;
        return task
          .run(
            async () => {
              const data = Object.fromEntries(
                Object.keys(defaults).map((k) => [k, form[k] ?? defaults[k]]),
              );
              if (matkulId) data.matkulId = matkulId;
              const id = await save({
                token,
                data,
                ...(existing ? { kelasId: existing.id, baseRevision } : {}),
                ...(copy ? { copyId: copy.id, copyRoster } : {}),
              });
              if (!mounted.current) return;
              guard.markSaved();
              if (existing) {
                setBaseRevision((r) => r + 1);
                onClose?.();
                setSettingsSaved(true);
              } else {
                rememberCreatedClass(id);
                setCreatedId(id);
              }
            },
            existing ? "Pengaturan kelas tersimpan." : "Kelas draf dibuat.",
          )
          .finally(() => {
            creating.current = false;
          });
      }}
    >
      {redirectFailed && (
        <Notice>
          Kelas sudah tersimpan. Lanjutkan menggunakan kelas yang sama.
          <button
            type="button"
            className="button button--primary"
            onClick={() => openCreated(createdId)}
          >
            Buka Mahasiswa
          </button>
        </Notice>
      )}
      {existing && (
        <RevisionNotice
          base={baseRevision}
          current={existing.revision}
          onReload={() => {
            setForm({ ...defaults, ...existing });
            guard.markSaved({
              form: { ...defaults, ...existing },
              matkulId,
              copyRoster,
            });
            setBaseRevision(existing.revision);
            task.clear();
          }}
        />
      )}
      {!existing && (
        <Field
          label="Mata kuliah"
          value={matkulId}
          onChange={setMatkul}
          options={[
            { value: "", label: "+ Buat mata kuliah baru" },
            ...catalog.matkul.map((m) => ({
              value: m.id,
              label: `${m.kode} · ${m.nama}`,
            })),
          ]}
        />
      )}
      {(scopeCourse || (!existing && !matkulId)) && (
        <div className="mg-form-grid">
          <Field
            label="Nama mata kuliah"
            value={form.matkulNama}
            onChange={(v) => set("matkulNama", v)}
            required
          />
          <Field
            label="Kode mata kuliah"
            value={form.matkulKode}
            onChange={(v) => set("matkulKode", v)}
            maxLength={30}
            required
          />
        </div>
      )}
      <div className="mg-form-grid">
        {classFields.map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={form[key]}
            onChange={(v) => set(key, v)}
            required={!key.endsWith("Id")}
            options={
              key === "semester" ? ["GASAL", "GENAP", "PENDEK"] : undefined
            }
          />
        ))}
      </div>
      {copy && (
        <label className="mg-check">
          <input
            type="checkbox"
            checked={copyRoster}
            onChange={(e) => setCopyRoster(e.target.checked)}
          />
          Salin juga mahasiswa aktif dari kelas sumber
        </label>
      )}
      <p className="muted">
        {existing
          ? "Identitas baru berlaku pada sesi berikutnya. Sesi yang pernah dikunci mempertahankan snapshot-nya."
          : "Kelas disimpan sebagai draf. Berikutnya masukkan mahasiswa, siapkan jadwal, periksa template, lalu aktifkan."}
      </p>
      <button className="button button--primary" disabled={Boolean(createdId)}>
        {existing
          ? "Simpan pengaturan"
          : createdId
            ? "Kelas sudah tersimpan"
            : task.busy
              ? "Menyimpan…"
              : "Simpan & lanjut ke Mahasiswa →"}
      </button>
    </TaskForm>
  );
}
export function Participants({ token, user, data, openImport = false }) {
  const [query, setQuery] = useState(""),
    [showInactive, setInactive] = useState(false),
    [edit, setEdit] = useState(null),
    [importing, setImporting] = useState(openImport),
    [page, setPage] = useState(0),
    [pageSize, setPageSize] = useState(10);
  const manage =
      (data.controls?.enabled
        ? data.controls.capabilities.includes("roster")
        : user.peran !== "OPERATOR") && !data.kelas.arsip,
    save = useMutation(api.kelola.saveParticipant),
    task = useTask();
  const rows = data.peserta.filter(
    (p) =>
      (showInactive || p.aktif !== false) &&
      matches(`${p.nama} ${p.nim} ${p.golongan}`, query),
  );
  useEffect(() => {
    if (openImport && manage) setImporting(true);
  }, [openImport, manage]);
  const target = new URLSearchParams(window.location.search).get("person");
  useEffect(() => {
    if (target) {
      const p = data.peserta.find((p) => p.id === target);
      if (p) setQuery(p.nim);
    }
  }, [target]);
  return (
    <section>
      <ClassTabHeading
        title="Mahasiswa"
        description={`${data.peserta.filter((p) => p.aktif !== false).length} aktif · NIM unik dalam kelas ini`}
        actions={
          manage && (
            <>
              <button
                className="button button--outline"
                onClick={() => setImporting(true)}
              >
                Impor Excel / CSV
              </button>
              <button
                className="button button--primary"
                onClick={() =>
                  setEdit({
                    nim: "",
                    nama: "",
                    golongan: "A",
                    aktif: true,
                    _baseRevision: data.kelas.revision,
                  })
                }
              >
                Tambah mahasiswa
              </button>
            </>
          )
        }
      />
      <Feedback task={task} />
      <div className="mg-filter-line">
        <Field
          label="Cari nama atau NIM"
          type="search"
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(0);
          }}
        />
        <label className="mg-check">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => {
              setInactive(e.target.checked);
              setPage(0);
            }}
          />
          Tampilkan nonaktif
        </label>
      </div>
      {data.peserta.length > 0 && (
        <Pagination
          total={rows.length}
          page={page}
          size={pageSize}
          onPage={setPage}
          onSize={setPageSize}
          label="mahasiswa"
        />
      )}
      <div className="mg-panel mg-roster-list">
        {rows
          .slice(
            Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1)) *
              pageSize,
            (Math.min(
              page,
              Math.max(0, Math.ceil(rows.length / pageSize) - 1),
            ) +
              1) *
              pageSize,
          )
          .map((p) => (
            <div className="mg-list-row" key={p.id}>
              <span>
                <strong>{p.nama}</strong>
                <small>
                  {p.nim} · Gol. {p.golongan}
                  {p.aktif === false ? " · Nonaktif" : ""}
                </small>
              </span>
              {manage && (
                <button
                  className="button button--outline"
                  onClick={() =>
                    setEdit({ ...p, _baseRevision: data.kelas.revision })
                  }
                >
                  Ubah
                </button>
              )}
            </div>
          ))}
        {!rows.length && (
          <div className="empty-state">
            <h3>{query ? "Tidak ada hasil" : "Belum ada mahasiswa"}</h3>
            <p>
              {query
                ? "Coba nama atau NIM lain."
                : "Impor daftar Excel/CSV atau tambahkan mahasiswa satu per satu."}
            </p>
          </div>
        )}
      </div>
      {edit && (
        <ParticipantEditor
          key={edit.id || "new"}
          edit={edit}
          task={task}
          onClose={() => {
            setEdit(null);
            task.clear();
          }}
          onSave={async (row) => {
            await save({
              token,
              kelasId: data.kelas.id,
              ...(edit.id ? { id: edit.id } : {}),
              data: row,
              baseRevision: edit._baseRevision,
            });
            setEdit(null);
          }}
        />
      )}
      {importing && manage && (
        <ImportDialog
          token={token}
          user={user}
          data={data}
          onClose={() => {
            setImporting(false);
            setPage(0);
          }}
        />
      )}
    </section>
  );
}
function ParticipantEditor({ edit, task, onClose, onSave }) {
  const [form, setForm] = useState(edit);
  const guard = useEditorGuard(form, true, task.busy);
  return (
    <Modal
      title={edit.id ? "Ubah mahasiswa" : "Tambah mahasiswa"}
      onClose={async () => {
        if (await guard.canDiscard()) onClose();
      }}
      busy={task.busy}
    >
      <TaskForm
        task={task}
        onSubmit={() =>
          task.run(async () => {
            await onSave({
              nim: form.nim,
              nama: form.nama,
              golongan: form.golongan,
              aktif: form.aktif,
            });
            guard.markSaved();
          })
        }
      >
        {[
          ["nim", "NIM"],
          ["nama", "Nama mahasiswa"],
          ["golongan", "Golongan"],
        ].map(([k, label]) => (
          <Field
            key={k}
            label={label}
            value={form[k]}
            onChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
            required
          />
        ))}
        <label className="mg-check">
          <input
            type="checkbox"
            checked={form.aktif !== false}
            onChange={(e) =>
              setForm((f) => ({ ...f, aktif: e.target.checked }))
            }
          />
          Mahasiswa aktif
        </label>
        <p className="muted">
          Sesi yang sudah dikunci tetap memakai identitas dan daftar peserta
          saat penguncian.
        </p>
        <button className="button button--primary">Simpan mahasiswa</button>
      </TaskForm>
    </Modal>
  );
}
export function ImportDialog({ token, user, data, onClose }) {
  const [baseRevision] = useState(data.kelas.revision);
  const [sheets, setSheets] = useState([]),
    [sheetIndex, setSheet] = useState("0"),
    [mapping, setMapping] = useState({ nim: "", nama: "", golongan: "" }),
    [source, setSource] = useState(""),
    [allowUpdate, setAllow] = useState(false),
    [updateNims, setUpdateNims] = useState([]),
    [reactivateNims, setReactivateNims] = useState([]),
    [errorsOnly, setErrorsOnly] = useState(false),
    task = useTask(),
    commit = useMutation(api.kelola.importRoster);
  const sheet = sheets[+sheetIndex],
    preview = useMemo(
      () =>
        sheet && mapping.nim !== "" && mapping.nama !== ""
          ? previewRoster(sheet.rows, mapping, data.peserta)
          : [],
      [sheet, mapping, data.peserta],
    ),
    errors = preview.filter((r) => r.error),
    updates = preview.filter((r) => r.action === "Perbarui");
  const [previewPage, setPreviewPage] = useState(0),
    [previewSize, setPreviewSize] = useState(10);
  const filteredPreview = errorsOnly ? errors : preview,
    pageIndex = Math.min(
      previewPage,
      Math.max(0, Math.ceil(filteredPreview.length / previewSize) - 1),
    ),
    visibleRows = filteredPreview.slice(
      pageIndex * previewSize,
      (pageIndex + 1) * previewSize,
    );
  useEffect(
    () => setPreviewPage(0),
    [errorsOnly, mapping.nim, mapping.nama, mapping.golongan],
  );
  const mappingKey = `bap.mapping.${user.id}.${data.kelas.id}`;
  const choose = (index, list = sheets) => {
    setSheet(String(index));
    setPreviewPage(0);
    setAllow(false);
    setUpdateNims([]);
    setReactivateNims([]);
    const s = list[+index];
    let map = suggestMapping(s.headers);
    try {
      const old = JSON.parse(localStorage.getItem(mappingKey));
      if (old?.headers === JSON.stringify(s.headers)) map = old.mapping;
    } catch {}
    setMapping(map);
  };
  return (
    <Modal
      title="Impor mahasiswa"
      onClose={onClose}
      wide
      busy={task.busy}
      headerActions={<HelpButton topic="import" />}
    >
      <Feedback task={task} />
      {task.busy && (
        <div className="operation-progress" role="status">
          <progress aria-label="Proses impor mahasiswa" />
          <span>Membaca atau menyimpan daftar mahasiswa…</span>
        </div>
      )}
      <p>
        Seret file .xlsx, .xls atau .csv, cocokkan kolom, lalu periksa sebelum
        memasukkan data. NIM diperlakukan sebagai teks.
      </p>
      <FileDrop
        label="File mahasiswa (maksimum 5 MB)"
        accept=".xlsx,.xls,.csv"
        disabled={task.busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            task
              .run(async () => {
                const list = await readRosterFile(file);
                const first = list.findIndex(
                  (s) => s.headers.length && s.rows.length,
                );
                if (first < 0)
                  throw Error("File kosong atau tidak memiliki header.");
                setSheets(list);
                setSource(file.name);
                choose(first, list);
                setAllow(false);
              }, "File dibaca. Periksa pemetaan kolom.")
              .catch(() => {});
        }}
      />
      {sheet && (
        <>
          <Field
            label="Lembar kerja"
            value={sheetIndex}
            onChange={choose}
            options={sheets.map((s, i) => ({
              value: String(i),
              label: s.name,
            }))}
          />
          <div className="mg-form-grid">
            {[
              ["nim", "Kolom NIM"],
              ["nama", "Kolom nama"],
              ["golongan", "Kolom golongan"],
            ].map(([k, label]) => (
              <Field
                key={k}
                label={label}
                value={mapping[k]}
                onChange={(v) => {
                  setMapping((m) => ({ ...m, [k]: v }));
                  setAllow(false);
                  setUpdateNims([]);
                  setReactivateNims([]);
                }}
                options={[
                  {
                    value: "",
                    label:
                      k === "golongan" ? "Tidak ada → Umum" : "Pilih kolom…",
                  },
                  ...sheet.headers.map((h) => ({
                    value: h.key,
                    label: h.label,
                  })),
                ]}
              />
            ))}
          </div>
          {preview.length > 0 && (
            <>
              <p role="status">
                <strong>
                  {preview.length} baris · {source}
                </strong>{" "}
                · {errors.length} bermasalah · {updates.length} akan diperbarui
              </p>
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={errorsOnly}
                  onChange={(e) => setErrorsOnly(e.target.checked)}
                />
                Tampilkan hanya baris bermasalah
              </label>
              <button
                className="button button--primary"
                disabled={
                  task.busy ||
                  errors.length > 0 ||
                  preview.length > 2000 ||
                  (!data.controls?.enabled &&
                    updates.length > 0 &&
                    !allowUpdate)
                }
                onClick={() =>
                  task
                    .run(async () => {
                      await commit({
                        token,
                        kelasId: data.kelas.id,
                        rows: preview.map(({ nim, nama, golongan }) => ({
                          nim,
                          nama,
                          golongan,
                        })),
                        source,
                        baseRevision,
                        allowUpdate,
                        ...(data.controls?.enabled
                          ? { updateNims, reactivateNims }
                          : {}),
                      });
                      try {
                        localStorage.setItem(
                          mappingKey,
                          JSON.stringify({
                            headers: JSON.stringify(sheet.headers),
                            mapping,
                          }),
                        );
                      } catch {}
                      showAppToast(
                        `${preview.length} mahasiswa diproses. ${data.kelas.draft ? "Berikutnya, siapkan jadwal." : "Daftar mahasiswa diperbarui."}`,
                      );
                      onClose();
                    }, "Impor selesai.")
                    .catch(() => {})
                }
              >
                Konfirmasi impor {preview.length} mahasiswa
              </button>
              <Pagination
                total={filteredPreview.length}
                page={previewPage}
                size={previewSize}
                onPage={setPreviewPage}
                onSize={setPreviewSize}
                label="preview impor"
              />
              <div className="mg-table-scroll">
                <table className="mg-table">
                  <thead>
                    <tr>
                      <th>Baris</th>
                      <th>NIM</th>
                      <th>Nama</th>
                      <th>Gol.</th>
                      <th>Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.nim}</td>
                        <td>{r.nama}</td>
                        <td>{r.golongan}</td>
                        <td className={r.error ? "mg-error-text" : ""}>
                          {r.error || r.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                Seluruh {preview.length} baris divalidasi. Pilihan pembaruan
                tetap tersimpan saat berpindah halaman. Batas impor 2000 baris.
              </p>
              {data.controls?.enabled ? (
                <div className="mg-panel">
                  <h3>Pilih pembaruan peserta</h3>
                  <p>
                    Peserta baru ditambahkan. Identitas yang tidak dipilih dan
                    peserta nonaktif tetap dipertahankan.
                  </p>
                  {updates
                    .filter((r) => visibleRows.some((v) => v.nim === r.nim))
                    .map((r) => (
                      <label className="mg-check" key={r.nim}>
                        <input
                          type="checkbox"
                          checked={updateNims.includes(r.nim)}
                          onChange={(e) =>
                            setUpdateNims((ids) =>
                              e.target.checked
                                ? [...ids, r.nim]
                                : ids.filter((id) => id !== r.nim),
                            )
                          }
                        />
                        <span>
                          Perbarui {r.nim}: {r.nama} · {r.golongan}
                        </span>
                      </label>
                    ))}
                  {visibleRows
                    .filter((r) =>
                      data.peserta.some(
                        (p) =>
                          p.nim.toUpperCase() === r.nim.toUpperCase() &&
                          p.aktif === false,
                      ),
                    )
                    .map((r) => (
                      <label className="mg-check" key={r.nim}>
                        <input
                          type="checkbox"
                          checked={reactivateNims.includes(r.nim)}
                          onChange={(e) =>
                            setReactivateNims((ids) =>
                              e.target.checked
                                ? [...ids, r.nim]
                                : ids.filter((id) => id !== r.nim),
                            )
                          }
                        />
                        <span>Aktifkan kembali {r.nim}</span>
                      </label>
                    ))}
                </div>
              ) : (
                updates.length > 0 && (
                  <label className="mg-check">
                    <input
                      type="checkbox"
                      checked={allowUpdate}
                      onChange={(e) => setAllow(e.target.checked)}
                    />
                    Saya setuju memperbarui nama/golongan mahasiswa yang
                    ditandai Perbarui.
                  </label>
                )
              )}
            </>
          )}
          {!sheet.rows.length && (
            <Notice kind="warning">Tidak ada baris data setelah header.</Notice>
          )}
        </>
      )}
      <p className="modal-help">
        Impor tidak menghapus mahasiswa yang tidak tercantum dalam file.
        Dukungan tautan Google Sheets direncanakan pada tahap berikutnya.
      </p>
    </Modal>
  );
}
export function Schedule(props) {
  return props.data.controls?.enabled ? (
    <ScheduleManager {...props} />
  ) : (
    <LegacySchedule {...props} />
  );
}
function LegacySchedule({ token, data, manage }) {
  const [baseRevision, setBaseRevision] = useState(data.kelas.revision);
  const [rows, setRows] = useState(() =>
      data.pertemuan.map((p) => ({
        id: p.id,
        nomor: p.nomor,
        tanggal: p.tanggal,
        tempat: p.tempat,
        tipe: p.tipe,
      })),
    ),
    [start, setStart] = useState(""),
    [count, setCount] = useState("16"),
    [preset, setPreset] = useState("PPB"),
    [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved && data.kelas.revision >= saved) {
      const next = data.pertemuan.map((p) => ({
        id: p.id,
        nomor: p.nomor,
        tanggal: p.tanggal,
        tempat: p.tempat,
        tipe: p.tipe,
      }));
      setRows(next);
      guard.markSaved(next);
      setSaved(false);
    }
  }, [data.pertemuan, data.kelas.revision, saved]);
  const save = useMutation(api.kelola.saveSchedule),
    task = useTask(),
    lockedIds = new Set(
      data.pertemuan.filter((p) => p.revision > 0).map((p) => p.id),
    );
  const guard = useEditorGuard(rows, manage, task.busy);
  const change = (i, k, v) =>
    setRows((r) => r.map((row, j) => (i === j ? { ...row, [k]: v } : row)));
  const generate = () =>
    task
      .run(async () => {
        const generated = weeklySchedule(
          start,
          Number(count),
          preset,
          data.kelas.tempat,
        );
        if (lockedIds.size)
          throw Error(
            "Jadwal memiliki sesi bersejarah. Tambah atau ubah minggu terbuka satu per satu.",
          );
        setRows(generated);
      }, "Jadwal dibuat sebagai preview. Simpan setelah diperiksa.")
      .catch(() => {});
  return (
    <section>
      <ClassTabHeading
        title="Jadwal pertemuan"
        description="Jenis dan tanggal mengikuti kelas ini. Praktikum pada minggu 1 diperbolehkan bila dipilih."
      />
      <RevisionNotice
        base={baseRevision}
        current={data.kelas.revision}
        onReload={() => {
          setBaseRevision(data.kelas.revision);
          setSaved(data.kelas.revision);
          task.clear();
        }}
      />
      <Feedback task={task} />
      {manage && (
        <div className="mg-panel">
          <h3>Buat jadwal mingguan</h3>
          <div className="mg-form-grid">
            <Field
              label="Tanggal mulai"
              type="date"
              value={start}
              onChange={setStart}
            />
            <Field
              label="Jumlah minggu"
              type="number"
              min="1"
              max="52"
              value={count}
              onChange={setCount}
            />
            <Field
              label="Pola awal"
              value={preset}
              onChange={setPreset}
              options={[
                { value: "PPB", label: "PPB: teori, praktikum, UTS, UAS" },
                { value: "REGULER", label: "Semua minggu praktikum" },
              ]}
            />
          </div>
          <button
            className="button button--outline"
            disabled={task.busy || !start || lockedIds.size > 0}
            onClick={generate}
          >
            Buat preview jadwal
          </button>
          {lockedIds.size > 0 && (
            <p className="muted">
              Sesi yang pernah dikunci dipertahankan. Jadwal otomatis tersedia
              untuk kelas tanpa riwayat presensi.
            </p>
          )}
        </div>
      )}
      <div className="mg-schedule-list">
        {rows.map((r, i) => {
          const locked = lockedIds.has(r.id);
          return (
            <div className="mg-schedule-row" key={r.id || `new-${i}`}>
              <Field
                label="Minggu"
                type="number"
                value={r.nomor}
                onChange={(v) => change(i, "nomor", Number(v))}
                disabled={!manage || locked}
              />
              <Field
                label="Tanggal"
                type="date"
                value={r.tanggal}
                onChange={(v) => change(i, "tanggal", v)}
                disabled={!manage || locked}
              />
              <Field
                label="Jenis"
                value={r.tipe}
                onChange={(v) => change(i, "tipe", v)}
                options={TYPES.map((t) => ({
                  value: t,
                  label: t === "REGULER" ? "Praktikum" : t,
                }))}
                disabled={!manage || locked}
              />
              <Field
                label="Ruang"
                value={r.tempat}
                onChange={(v) => change(i, "tempat", v)}
                disabled={!manage || locked}
              />
              {manage && !locked && (
                <button
                  className="button button--quiet"
                  onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                  aria-label={`Hapus minggu ${r.nomor}`}
                >
                  Hapus
                </button>
              )}
              {locked && <small>Riwayat dipertahankan</small>}
              {data.controls?.enabled && (
                <button
                  className="button button--outline"
                  disabled={!manage}
                  onClick={() =>
                    navigate(
                      `/kelas/${data.kelas.id}?tab=jadwal&correct=${r.id}`,
                    )
                  }
                >
                  Koreksi sesi {r.nomor}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!rows.length && (
        <div className="empty-state">
          <h3>Jadwal belum disiapkan</h3>
          <p>Buat jadwal mingguan atau tambahkan satu pertemuan.</p>
        </div>
      )}
      {manage && (
        <div className="mg-inline-actions">
          <button
            className="button button--outline"
            onClick={() =>
              setRows((r) => [
                ...r,
                {
                  nomor: Math.max(0, ...r.map((p) => p.nomor)) + 1,
                  tanggal: "",
                  tipe: "REGULER",
                  tempat: data.kelas.tempat,
                },
              ])
            }
          >
            Tambah minggu
          </button>
          <button
            className="button button--primary"
            disabled={task.busy || !rows.length}
            onClick={() => setConfirm(true)}
          >
            Periksa & simpan jadwal
          </button>
        </div>
      )}
      {confirm && (
        <Modal
          title="Simpan jadwal ini?"
          onClose={() => setConfirm(false)}
          busy={task.busy}
        >
          <p>
            {rows.length} minggu,{" "}
            {rows.filter((r) => r.tipe === "REGULER").length} praktikum. Periksa
            kembali tanggal dan jenis pertemuan. Sesi dengan riwayat presensi
            tetap dipertahankan.
          </p>
          <Feedback task={task} />
          <button
            className="button button--primary"
            onClick={() =>
              task
                .run(async () => {
                  await save({
                    token,
                    kelasId: data.kelas.id,
                    rows,
                    baseRevision,
                  });
                  setBaseRevision((r) => r + 1);
                  guard.markSaved(rows);
                  setSaved(baseRevision + 1);
                  setConfirm(false);
                }, "Jadwal tersimpan.")
                .catch(() => {})
            }
          >
            Ya, simpan jadwal
          </button>
        </Modal>
      )}
    </section>
  );
}
export function TemplateEditor({ token, data, manage, onStepState }) {
  const [baseRevision, setBaseRevision] = useState(data.kelas.revision);
  const [config, setRawConfig] = useState({
      ...DEFAULT_TEMPLATE,
      ...data.kelas.templateDraft,
    }),
    [preview, setPreview] = useState(null),
    [confirm, setConfirm] = useState(false),
    task = useTask(),
    save = useMutation(api.kelola.saveTemplate),
    makePreview = useAction(api.bapNode.preview);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const historicalConfig = useQuery(
    api.kelola.templateConfig,
    selectedTemplate ? { token, id: selectedTemplate } : "skip",
  );
  const guard = useEditorGuard(config, manage, task.busy);
  const setConfig = (value) => {
    setRawConfig(value);
  };
  useEffect(() => {
    if (historicalConfig && selectedTemplate) {
      setConfig({ ...DEFAULT_TEMPLATE, ...historicalConfig });
      setSelectedTemplate(null);
    }
  }, [historicalConfig, selectedTemplate]);
  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const [previewState, setPreviewState] = useState("loading"),
    [operation, setOperation] = useState("Menyimpan template…"),
    [previewError, setPreviewError] = useState(""),
    [retryPreview, setRetryPreview] = useState(0),
    [continued, setContinued] = useState(false);
  const previewTicket = useRef(0),
    saving = useRef(false);
  const configKey = JSON.stringify(config);
  useEffect(() => () => onStepState?.({busy:false,ready:false}), [onStepState]);
  const savedConfigKey = useRef(configKey);
  const [previewConfigKey, setPreviewConfigKey] = useState("");
  useEffect(() => {
    onStepState?.({
      busy: task.busy,
      ready: previewState === "ready" && previewConfigKey === configKey,
    });
  }, [task.busy, previewState, previewConfigKey, configKey, onStepState]);
  useEffect(() => {
    if (continued && !task.busy)
      void navigate(`/kelas/${data.kelas.id}?tab=review`);
  }, [continued, task.busy]);
  useEffect(() => {
    const ticket = ++previewTicket.current;
    let active = true;
    setPreviewState("loading");
    setPreviewError("");
    const timer = setTimeout(async () => {
      try {
        const p = await makePreview({
          token,
          kelasId: data.kelas.id,
          config: JSON.parse(configKey),
        });
        if (!active || ticket !== previewTicket.current) return;
        const bytes = Uint8Array.from(atob(p.base64), (c) => c.charCodeAt(0));
        setPreview({
          url: URL.createObjectURL(
            new Blob([bytes], { type: "application/pdf" }),
          ),
          pages: p.pageCount,
        });
        setPreviewState("ready");
        setPreviewConfigKey(configKey);
      } catch (e) {
        if (active && ticket === previewTicket.current) {
          setPreviewState("error");
          setPreviewError(
            e?.data?.message ||
              e?.message ||
              "Preview belum dapat dibuat. Periksa isian dan koneksi.",
          );
        }
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    token,
    data.kelas.id,
    data.kelas.revision,
    configKey,
    retryPreview,
    makePreview,
  ]);
  const runSave = (fn, message) => {
    if (saving.current) return;
    setOperation("Menyimpan template…");
    saving.current = true;
    task
      .run(fn, message)
      .catch(() => {})
      .finally(() => {
        saving.current = false;
      });
  };
  const saveConfig = async (publish) => {
    const result = await save({
      token,
      kelasId: data.kelas.id,
      config,
      publish,
      baseRevision,
    });
    setBaseRevision((r) => r + 1);
    guard.markSaved(config);
    savedConfigKey.current = JSON.stringify(config);
    return result;
  };
  return (
    <section>
      {!data.kelas.draft && (
        <ClassTabHeading
          title="Template BAP"
          description={`Versi terbit ${data.kelas.templateVersion}. Perubahan berlaku pada sesi berikutnya.`}
        />
      )}
      <RevisionNotice
        base={baseRevision}
        current={data.kelas.revision}
        onReload={() => {
          setConfig({ ...DEFAULT_TEMPLATE, ...data.kelas.templateDraft });
          guard.markSaved({
            ...DEFAULT_TEMPLATE,
            ...data.kelas.templateDraft,
          });
          savedConfigKey.current = JSON.stringify({ ...DEFAULT_TEMPLATE, ...data.kelas.templateDraft });
          setBaseRevision(data.kelas.revision);
          task.clear();
        }}
      />

      <Feedback task={task} />
      <form
        id="setup-template"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !manage ||
            previewState !== "ready" ||
            previewConfigKey !== configKey
          )
            return;
          runSave(async () => {
            await saveConfig(true);
            setContinued(true);
          }, "Template tersimpan.");
        }}
      />
      {task.busy && (
        <div className="operation-progress" role="status">
          <progress aria-label="Penyimpanan template" />
          <span>{operation}</span>
        </div>
      )}
      <div className="mg-template-grid">
        <div>
          <details
            className="mg-panel template-fields"
            open={!data.kelas.draft}
          >
            <summary>Edit kop & identitas dokumen</summary>
            <fieldset disabled={!manage || task.busy}>
              <button
                className="button button--outline"
                onClick={() => setConfig({ ...DEFAULT_TEMPLATE })}
              >
                Gunakan format resmi
              </button>
              <p className="muted">
                Mengembalikan isi editor ke kop DOCX asli. Simpan sebagai draf
                dan periksa preview sebelum menerbitkan.
              </p>
              {[
                ["institusi", "Institusi / kementerian"],
                ["unit", "Nama institusi"],
                ["jurusan", "Jurusan (opsional)"],
                ["alamat", "Alamat / telepon / faks"],
                ["kontak", "Email / situs (opsional)"],
                ["judul", "Judul form"],
                ["labelDosen", "Label dosen"],
                ["labelAsdos", "Label asdos"],
              ].map(([k, label]) => (
                <Field
                  key={k}
                  label={label}
                  value={config[k]}
                  onChange={(v) => setConfig((c) => ({ ...c, [k]: v }))}
                  maxLength={k === "judul" ? 240 : 180}
                  required={["institusi", "unit", "judul"].includes(k)}
                />
              ))}
              <p className="muted">
                Kosongkan label dosen dan asdos untuk mencetak nama langsung,
                seperti pada form resmi.
              </p>
              <FileDrop
                label="Logo PNG/JPEG (maksimum 350 KB)"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                disabled={task.busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setOperation("Membaca logo…");
                    task
                      .run(async () => {
                        if (file.size > 350000)
                          throw Error("Logo maksimum 350 KB.");
                        const header = new Uint8Array(
                          await file.slice(0, 8).arrayBuffer(),
                        );
                        const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
                            (byte, i) => header[i] === byte,
                          ),
                          jpeg = header[0] === 255 && header[1] === 216;
                        if (!png && !jpeg)
                          throw Error(
                            "Gunakan gambar PNG atau JPEG yang valid.",
                          );
                        const value = await new Promise((resolve, reject) => {
                          const r = new FileReader();
                          r.onload = () => resolve(r.result);
                          r.onerror = reject;
                          r.readAsDataURL(
                            new Blob([file], {
                              type: png ? "image/png" : "image/jpeg",
                            }),
                          );
                        });
                        setConfig((c) => ({ ...c, logo: value }));
                      }, "Logo dipilih. Preview sedang diperbarui.")
                      .catch(() => {});
                  }
                }}
              />
              {config.logo && (
                <div className="mg-logo-preview">
                  <img src={config.logo} alt="Logo yang dipilih" />
                  <button
                    className="button button--quiet"
                    onClick={() => setConfig((c) => ({ ...c, logo: "" }))}
                  >
                    Kembali ke logo resmi
                  </button>
                </div>
              )}
              <p className="muted">
                Dosen, asdos, program studi, dan semester diambil dari
                Pengaturan kelas. Format tabel resmi tetap dipertahankan.
              </p>
              {!data.kelas.draft && (
                <div className="mg-inline-actions">
                  <button
                    type="button"
                    className="button button--outline"
                    onClick={() =>
                      runSave(
                        () => saveConfig(false),
                        "Draf template tersimpan.",
                      )
                    }
                  >
                    {task.busy ? "Menyimpan…" : "Simpan draf"}
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={
                      previewState !== "ready" || previewConfigKey !== configKey
                    }
                    onClick={() => setConfirm(true)}
                  >
                    Terbitkan versi baru
                  </button>
                </div>
              )}
            </fieldset>
          </details>
          <details
            className="mg-panel template-fields"
            open={!data.kelas.draft}
          >
            <summary>Riwayat versi</summary>
            {data.templates.map((t) => (
              <div className="mg-list-row" key={t.id}>
                <span>
                  <strong>Versi {t.version}</strong>
                  <small>
                    {new Date(t.dibuatPada).toLocaleString("id-ID")}
                  </small>
                </span>
                {manage && (
                  <button
                    className="button button--quiet"
                    disabled={task.busy || Boolean(selectedTemplate)}
                    onClick={() =>
                      t.config
                        ? setConfig({ ...DEFAULT_TEMPLATE, ...t.config })
                        : setSelectedTemplate(t.id)
                    }
                  >
                    Salin ke editor
                  </button>
                )}
              </div>
            ))}
          </details>
        </div>
        <div
          className="mg-pdf-preview mg-panel"
          aria-busy={previewState === "loading"}
        >
          <div role="status" className="template-preview-status">
            {previewState === "loading" ? (
              <>
                <progress aria-label="Membuat preview template" />
                <span>
                  {preview
                    ? "Memperbarui preview…"
                    : "Menyiapkan preview template…"}
                </span>
              </>
            ) : previewState === "ready" ? (
              <span>
                {savedConfigKey.current === configKey
                  ? "Preview sesuai template tersimpan"
                  : "Preview terbaru · perubahan belum disimpan"}
              </span>
            ) : (
              <Notice kind="error">
                {previewError}
                <button
                  type="button"
                  className="button button--outline"
                  onClick={() => setRetryPreview((n) => n + 1)}
                >
                  Coba preview lagi
                </button>
              </Notice>
            )}
          </div>
          {preview ? (
            <>
              <h3>Preview dokumen · {preview.pages} halaman</h3>
              <p className="muted">
                Contoh BAP dengan nama contoh dan tanggal pertemuan pertama yang
                belum diisi.
              </p>
              <PdfPreview title="Preview PDF BAP" url={preview.url} />
              <a
                className="button button--outline"
                href={preview.url}
                download="Preview-BAP.pdf"
              >
                Unduh preview PDF
              </a>
            </>
          ) : (
            <p className="muted">
              Preview tampil otomatis tanpa menyimpan. Folio 215 × 330 mm · 12
              slot per form.
            </p>
          )}
        </div>
      </div>
      {confirm && (
        <Modal
          title="Terbitkan template baru?"
          onClose={() => setConfirm(false)}
          busy={task.busy}
        >
          <p>
            Versi {data.kelas.templateVersion + 1} dipakai untuk sesi
            berikutnya. Arsip dan sesi yang pernah dikunci tidak berubah.
          </p>
          <Feedback task={task} />
          <button
            className="button button--primary"
            onClick={() =>
              runSave(async () => {
                await saveConfig(true);
                setConfirm(false);
              }, "Template diterbitkan.")
            }
          >
            Ya, terbitkan
          </button>
        </Modal>
      )}
    </section>
  );
}
