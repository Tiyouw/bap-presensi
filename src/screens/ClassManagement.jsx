import PdfPreview from "../components/PdfPreview.jsx";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useAction } from "convex/react";
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
import { navigate } from "../lib/navigation.js";
import { readRosterFile, suggestMapping } from "../lib/importRoster.js";
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
export function ClassForm({ token, catalog, existing, copy, onClose }) {
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
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <TaskForm
      task={task}
      className="mg-class-form"
      onSubmit={() =>
        task.run(
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
            if (existing) {
              setBaseRevision((r) => r + 1);
              onClose?.();
            } else navigate(`/kelas/${id}?tab=mahasiswa`);
          },
          existing ? "Pengaturan kelas tersimpan." : "Kelas draf dibuat.",
        )
      }
    >
      {existing && (
        <RevisionNotice
          base={baseRevision}
          current={existing.revision}
          onReload={() => {
            setForm({ ...defaults, ...existing });
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
      {!existing && !matkulId && (
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
      <button className="button button--primary">
        {existing ? "Simpan pengaturan" : "Simpan & lanjutkan"}
      </button>
    </TaskForm>
  );
}
export function Participants({ token, user, data, openImport = false }) {
  const [query, setQuery] = useState(""),
    [showInactive, setInactive] = useState(false),
    [edit, setEdit] = useState(null),
    [importing, setImporting] = useState(openImport),
    [limit, setLimit] = useState(50);
  const manage = user.peran !== "OPERATOR" && !data.kelas.arsip,
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
      <div className="mg-section-heading">
        <div>
          <h2>Mahasiswa</h2>
          <p className="muted">
            {data.peserta.filter((p) => p.aktif !== false).length} aktif · NIM
            unik dalam kelas ini
          </p>
        </div>
        {manage && (
          <div className="mg-inline-actions">
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
          </div>
        )}
      </div>
      <Feedback task={task} />
      <div className="mg-filter-line">
        <Field
          label="Cari nama atau NIM"
          type="search"
          value={query}
          onChange={(v) => {
            setQuery(v);
            setLimit(50);
          }}
        />
        <label className="mg-check">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setInactive(e.target.checked)}
          />
          Tampilkan nonaktif
        </label>
      </div>
      <div className="mg-panel mg-roster-list">
        {rows.slice(0, limit).map((p) => (
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
        {rows.length > limit && (
          <button
            className="button button--quiet"
            onClick={() => setLimit((l) => l + 50)}
          >
            Tampilkan 50 berikutnya
          </button>
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
          onClose={() => setImporting(false)}
        />
      )}
    </section>
  );
}
function ParticipantEditor({ edit, task, onClose, onSave }) {
  const [form, setForm] = useState(edit);
  return (
    <Modal
      title={edit.id ? "Ubah mahasiswa" : "Tambah mahasiswa"}
      onClose={onClose}
      busy={task.busy}
    >
      <TaskForm
        task={task}
        onSubmit={() =>
          task.run(() =>
            onSave({
              nim: form.nim,
              nama: form.nama,
              golongan: form.golongan,
              aktif: form.aktif,
            }),
          )
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
  const mappingKey = `bap.mapping.${user.id}.${data.kelas.id}`;
  const choose = (index, list = sheets) => {
    setSheet(String(index));
    const s = list[+index];
    let map = suggestMapping(s.headers);
    try {
      const old = JSON.parse(localStorage.getItem(mappingKey));
      if (old?.headers === JSON.stringify(s.headers)) map = old.mapping;
    } catch {}
    setMapping(map);
  };
  return (
    <Modal title="Impor mahasiswa" onClose={onClose} wide busy={task.busy}>
      <Feedback task={task} />
      <p>
        Unggah .xlsx atau .csv, cocokkan kolom, lalu periksa sebelum memasukkan
        data. NIM diperlakukan sebagai teks.
      </p>
      <label className="mg-field">
        <span>File mahasiswa (maksimum 5 MB)</span>
        <input
          type="file"
          accept=".xlsx,.csv"
          disabled={task.busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              task
                .run(async () => {
                  const list = await readRosterFile(file);
                  if (!list.length || !list[0].headers.length)
                    throw Error("File kosong atau tidak memiliki header.");
                  setSheets(list);
                  setSource(file.name);
                  choose(0, list);
                }, "File dibaca. Periksa pemetaan kolom.")
                .catch(() => {});
          }}
        />
      </label>
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
                onChange={(v) => setMapping((m) => ({ ...m, [k]: v }))}
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
                <strong>{preview.length} baris</strong> · {errors.length}{" "}
                bermasalah · {updates.length} akan diperbarui
              </p>
              <label className="mg-check">
                <input
                  type="checkbox"
                  checked={errorsOnly}
                  onChange={(e) => setErrorsOnly(e.target.checked)}
                />
                Tampilkan hanya baris bermasalah
              </label>
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
                    {(errorsOnly ? errors : preview).slice(0, 100).map((r) => (
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
                Preview menampilkan hingga 100 baris; seluruh {preview.length}{" "}
                baris divalidasi. Batas impor 2000 baris.
              </p>
              {updates.length > 0 && (
                <label className="mg-check">
                  <input
                    type="checkbox"
                    checked={allowUpdate}
                    onChange={(e) => setAllow(e.target.checked)}
                  />
                  Saya setuju memperbarui nama/golongan mahasiswa yang ditandai
                  Perbarui.
                </label>
              )}
              <button
                className="button button--primary"
                disabled={
                  task.busy ||
                  errors.length > 0 ||
                  preview.length > 2000 ||
                  (updates.length > 0 && !allowUpdate)
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
                      onClose();
                    }, "Impor selesai.")
                    .catch(() => {})
                }
              >
                Konfirmasi impor {preview.length} mahasiswa
              </button>
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
export function Schedule({ token, data, manage }) {
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
    if (saved) {
      setRows(
        data.pertemuan.map((p) => ({
          id: p.id,
          nomor: p.nomor,
          tanggal: p.tanggal,
          tempat: p.tempat,
          tipe: p.tipe,
        })),
      );
      setSaved(false);
    }
  }, [data.pertemuan, saved]);
  const save = useMutation(api.kelola.saveSchedule),
    task = useTask(),
    lockedIds = new Set(
      data.pertemuan.filter((p) => p.revision > 0).map((p) => p.id),
    );
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
      <h2>Jadwal pertemuan</h2>
      <RevisionNotice
        base={baseRevision}
        current={data.kelas.revision}
        onReload={() => {
          setBaseRevision(data.kelas.revision);
          setSaved(true);
          task.clear();
        }}
      />
      <p className="muted">
        Jenis dan tanggal mengikuti kelas ini. Praktikum pada minggu 1
        diperbolehkan bila dipilih.
      </p>
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
                  setSaved(true);
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
export function TemplateEditor({ token, data, manage }) {
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
  const setConfig = (value) => {
    setRawConfig(value);
    setPreview(null);
  };
  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const saveConfig = async (publish) => {
    const result = await save({
      token,
      kelasId: data.kelas.id,
      config,
      publish,
      baseRevision,
    });
    setBaseRevision((r) => r + 1);
    return result;
  };
  return (
    <section>
      <div className="mg-section-heading">
        <div>
          <h2>Template BAP</h2>
          <RevisionNotice
            base={baseRevision}
            current={data.kelas.revision}
            onReload={() => {
              setConfig({ ...DEFAULT_TEMPLATE, ...data.kelas.templateDraft });
              setBaseRevision(data.kelas.revision);
              setPreview(null);
              task.clear();
            }}
          />
          <p className="muted">
            Versi terbit {data.kelas.templateVersion}. Perubahan berlaku pada
            sesi berikutnya.
          </p>
        </div>
      </div>
      <Feedback task={task} />
      <div className="mg-template-grid">
        <div>
          <fieldset disabled={!manage || task.busy} className="mg-panel">
            <h3>Kop & identitas dokumen</h3>
            <button
              className="button button--outline"
              onClick={() => setConfig({ ...DEFAULT_TEMPLATE })}
            >
              Gunakan format resmi
            </button>
            <p className="muted">
              Mengembalikan isi editor ke kop DOCX asli. Simpan sebagai draf dan
              periksa preview sebelum menerbitkan.
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
            <label className="mg-field">
              <span>Logo PNG/JPEG (maksimum 350 KB)</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    task
                      .run(async () => {
                        if (file.size > 350000)
                          throw Error("Logo maksimum 350 KB.");
                        const value = await new Promise((resolve, reject) => {
                          const r = new FileReader();
                          r.onload = () => resolve(r.result);
                          r.onerror = reject;
                          r.readAsDataURL(file);
                        });
                        setConfig((c) => ({ ...c, logo: value }));
                      }, "Logo dipilih. Simpan dan periksa preview.")
                      .catch(() => {});
                }}
              />
            </label>
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
              Dosen, asdos, program studi, dan semester diambil dari Pengaturan
              kelas. Format tabel resmi tetap dipertahankan.
            </p>
            <div className="mg-inline-actions">
              <button
                className="button button--outline"
                onClick={() =>
                  task
                    .run(() => saveConfig(false), "Draf template tersimpan.")
                    .catch(() => {})
                }
              >
                Simpan draf
              </button>
              <button
                className="button button--outline"
                onClick={() =>
                  task
                    .run(async () => {
                      await saveConfig(false);
                      const p = await makePreview({
                        token,
                        kelasId: data.kelas.id,
                      });
                      setPreview({
                        url: URL.createObjectURL(
                          new Blob(
                            [
                              Uint8Array.from(atob(p.base64), (c) =>
                                c.charCodeAt(0),
                              ),
                            ],
                            { type: "application/pdf" },
                          ),
                        ),
                        pages: p.pageCount,
                      });
                    }, "Preview siap.")
                    .catch(() => {})
                }
              >
                Simpan & preview PDF
              </button>
              <button
                className="button button--primary"
                onClick={() => setConfirm(true)}
              >
                Terbitkan versi baru
              </button>
            </div>
          </fieldset>
          <div className="mg-panel">
            <h3>Riwayat versi</h3>
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
                    onClick={() => setConfig({ ...DEFAULT_TEMPLATE, ...t.config })}
                  >
                    Salin ke editor
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mg-pdf-preview mg-panel">
          {preview ? (
            <>
              <h3>Preview dokumen · {preview.pages} halaman</h3>
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
            <div className="empty-state">
              <h3>Periksa hasil sebelum terbit.</h3>
              <p>
                Simpan & preview untuk melihat PDF dari generator yang sama
                dengan unduhan. Preview menggunakan nama contoh.
              </p>
              <p>Folio 215 × 330 mm · 12 slot per form</p>
            </div>
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
              task
                .run(async () => {
                  await saveConfig(true);
                  setConfirm(false);
                }, "Template diterbitkan.")
                .catch(() => {})
            }
          >
            Ya, terbitkan
          </button>
        </Modal>
      )}
    </section>
  );
}
