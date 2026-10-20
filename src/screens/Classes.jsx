import PdfPreview from "../components/PdfPreview.jsx";
import ClassTabHeading from "../components/ClassTabHeading.jsx";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import { navigate, linkClick } from "../lib/navigation.js";
import { Field, TaskForm, useTask, Feedback } from "../components/Form.jsx";
import { Notice } from "../components/Layout.jsx";
import Modal from "../components/Modal.jsx";
import { matches } from "../../bap-shared/management.js";
import {
  ClassForm,
  Participants,
  Schedule,
  TemplateEditor,
} from "./ClassManagement.jsx";
import Pertemuan from "./Pertemuan.jsx";
import { authenticatedDocument, unduhDokumen } from "../lib/presensi.js";
import { SkeletonRows } from "../components/Loading.jsx";
export function ClassCard({ item, onCopy, manage }) {
  return (
    <article className="mg-class-card">
      <div className="mg-card-top">
        <span className="eyebrow">{item.matkulKode}</span>
        <span className="session-badge">
          {item.arsip ? "Arsip" : item.draft ? "Draf kelas" : "Aktif"}
        </span>
      </div>
      <h3>
        <a
          href={`/kelas/${item.id}`}
          onClick={(e) => linkClick(e, `/kelas/${item.id}`)}
        >
          {item.matkulNama}
        </a>
      </h3>
      <p>{item.nama}</p>
      <p className="muted">
        {item.semester} {item.tahunAkademik} · {item.dosen}
      </p>
      <div className="mg-card-counts">
        <span>
          <strong>{item.jumlahPeserta}</strong> mahasiswa
        </span>
        <span>
          <strong>
            {item.jumlahTerkunci}/{item.jumlahPraktikum}
          </strong>{" "}
          terkunci
        </span>
      </div>
      <div className="mg-card-actions">
        <button
          className="button button--primary"
          onClick={() =>
            navigate(`/kelas/${item.id}${item.draft ? "?tab=mahasiswa" : ""}`)
          }
        >
          {item.draft ? "Lanjutkan persiapan" : "Buka kelas"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
        {manage && (
          <button className="button button--quiet" onClick={() => onCopy(item)}>
            Salin kelas
          </button>
        )}
      </div>
    </article>
  );
}
export function ClassList({ catalog, user, home = false }) {
  const [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false);
  const manage = user.peran !== "OPERATOR",
    classes = catalog.kelas.filter(
      (c) =>
        (archived || !c.arsip) &&
        matches(
          `${c.nama} ${c.matkulNama} ${c.matkulKode} ${c.semester} ${c.tahunAkademik}`,
          query,
        ),
    ),
    upcoming = catalog.kelas
      .filter((c) => !c.arsip && !c.draft && c.berikutnya)
      .sort((a, b) => a.berikutnya.localeCompare(b.berikutnya))
      .slice(0, 3);
  return (
    <main className="mg-page">
      <div className="mg-page-heading">
        <div>
          <p className="eyebrow">
            {home
              ? `Ruang kerja ${user.nama}`
              : "Semester berganti, arsip tetap terjaga"}
          </p>
          <h1>{home ? "Siap untuk kelas berikutnya." : "Matkul & kelas."}</h1>
          <p className="lede">
            {home
              ? "Pilih kelas untuk mencatat presensi atau melanjutkan persiapan."
              : "Mahasiswa, jadwal, dosen, dan BAP tersimpan terpisah untuk setiap kelas."}
          </p>
        </div>
        {manage && (
          <button
            className="button button--primary"
            onClick={() => navigate("/kelas/baru")}
          >
            Tambah kelas <span aria-hidden="true">+</span>
          </button>
        )}
      </div>
      {home && upcoming.length > 0 && (
        <section className="mg-upcoming">
          <h2>Praktikum yang belum selesai</h2>
          {upcoming.map((c) => (
            <button
              className="mg-upcoming-row"
              key={c.id}
              onClick={() => navigate(`/kelas/${c.id}`)}
            >
              <span className="mg-date">
                {new Date(c.berikutnya + "T00:00:00").toLocaleDateString(
                  "id-ID",
                  { day: "numeric", month: "short" },
                )}
              </span>
              <span>
                <strong>{c.matkulNama}</strong>
                <small>
                  {c.nama} · {c.tempat}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </section>
      )}
      <div className="mg-section-heading">
        <h2>{home ? "Kelasmu" : "Daftar kelas"}</h2>
        <span className="muted">{classes.length} kelas</span>
      </div>
      <div className="mg-filter-line">
        <Field
          label="Cari matkul atau kelas"
          type="search"
          value={query}
          onChange={setQuery}
        />
        <label className="mg-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Tampilkan arsip
        </label>
      </div>
      <div className="mg-class-grid">
        {classes.map((c) => (
          <ClassCard
            key={c.id}
            item={c}
            manage={manage}
            onCopy={(item) => navigate(`/kelas/baru?copy=${item.id}`)}
          />
        ))}
      </div>
      {!classes.length && (
        <div className="empty-state">
          <h2>
            {query ? "Tidak ada kelas yang cocok" : "Belum ada kelas aktif"}
          </h2>
          <p>
            {manage
              ? "Buat kelas baru untuk mulai menyiapkan mahasiswa, jadwal, dan template."
              : "Minta admin menugaskan kelas pada akunmu."}
          </p>
        </div>
      )}
    </main>
  );
}
export function NewClass({ token, user, catalog, path }) {
  const copy = catalog.kelas.find(
    (c) => c.id === new URLSearchParams(path.split("?")[1]).get("copy"),
  );
  return (
    <main className="mg-page mg-form-page">
      <p className="eyebrow">Persiapan kelas · langkah 1 dari 5</p>
      <h1>{copy ? "Salin untuk semester baru." : "Kelas baru."}</h1>
      <p className="lede">
        Atur identitas terlebih dahulu. Kamu bisa melanjutkan persiapan kapan
        saja.
      </p>
      <ClassForm
        key={copy?.id || "new"}
        token={token}
        catalog={catalog}
        copy={copy}
      />
    </main>
  );
}
export function ClassWorkspace({
  token,
  user,
  catalog,
  data,
  network,
  path,
  onPrint,
  onHelp,
}) {
  const c = data.kelas,
    params = new URLSearchParams(path.split("?")[1]),
    tab = params.get("tab") || "pertemuan",
    manage = user.peran !== "OPERATOR",
    task = useTask(),
    activate = useMutation(api.kelola.activate),
    archive = useMutation(api.kelola.archive),
    [confirm, setConfirm] = useState(null);
  const tabs = [
    ["pertemuan", "Pertemuan"],
    ["mahasiswa", "Mahasiswa"],
    ...(manage
      ? [
          ["jadwal", "Jadwal"],
          ["template", "Template BAP"],
          ["pengaturan", "Pengaturan"],
        ]
      : []),
    ["riwayat", "Riwayat"],
  ];
  const checks = [
    Boolean(c.dosen && c.dosen !== "Belum diatur"),
    data.peserta.some((p) => p.aktif !== false),
    data.pertemuan.some((p) => p.tipe === "REGULER"),
    c.templateVersion > 0,
  ];
  return (
    <>
      <div className="mg-class-head">
        <p className="eyebrow">
          {c.matkulKode} · {c.semester} {c.tahunAkademik}
        </p>
        <div className="mg-section-heading">
          <div>
            <h1>{c.matkulNama}</h1>
            <p>
              {c.nama} · {c.dosen}
            </p>
          </div>
          <span className="session-badge">
            {c.arsip ? "Arsip" : c.draft ? "Draf kelas" : "Kelas aktif"}
          </span>
        </div>
        <nav className="mg-class-tabs" aria-label="Bagian kelas">
          {tabs.map(([id, label]) => (
            <a
              href={`/kelas/${c.id}?tab=${id}`}
              key={id}
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "is-active" : ""}
              onClick={(e) => linkClick(e, `/kelas/${c.id}?tab=${id}`)}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
      <div className="mg-class-body">
        {c.arsip && (
          <Notice kind="warning">
            Kelas diarsipkan. Data dan dokumen dapat dibaca; pengubahan
            dinonaktifkan.
            {manage && (
              <button
                className="button button--outline"
                onClick={() => setConfirm("restore")}
              >
                Pulihkan kelas
              </button>
            )}
          </Notice>
        )}
        {c.draft && (
          <section className="mg-setup">
            <div>
              <p className="eyebrow">Lanjutkan persiapan kelas</p>
              <h2>{checks.filter(Boolean).length} dari 4 bagian siap</h2>
              <p>
                Identitas → Mahasiswa → Jadwal → Template → Periksa & aktifkan
              </p>
            </div>
            <button
              className="button button--primary"
              disabled={!manage || !checks.every(Boolean)}
              onClick={() => setConfirm("activate")}
            >
              Periksa & aktifkan
            </button>
          </section>
        )}
        <Feedback task={task} />
        {tab === "pertemuan" ? (
          <Pertemuan
            data={{
              ...data,
              peserta: data.peserta.filter((p) => p.aktif !== false),
            }}
            network={network}
            onPilih={(p) => navigate(`/kelas/${c.id}/pertemuan/${p.id}`)}
            onHelp={onHelp}
            onPrint={() => onPrint(c.id)}
            freshData={data}
          />
        ) : tab === "mahasiswa" ? (
          <Participants
            token={token}
            user={user}
            data={data}
            openImport={params.has("import")}
          />
        ) : tab === "jadwal" && manage ? (
          <Schedule key={c.id} token={token} data={data} manage={!c.arsip} />
        ) : tab === "template" && manage ? (
          <TemplateEditor token={token} data={data} manage={!c.arsip} />
        ) : tab === "pengaturan" && manage ? (
          <>
            <ClassTabHeading
              title="Identitas kelas"
              description="Atur identitas kelas, dosen pengampu, asisten, dan ruang bawaan."
            />
            <fieldset disabled={c.arsip}>
              <ClassForm
                key={c.id}
                token={token}
                catalog={catalog}
                existing={c}
              />
              <CourseSettings token={token} data={data} />
            </fieldset>
            <div className="mg-panel">
              <h3>Arsip kelas</h3>
              <p>
                Arsip menjaga semua presensi dan dokumen. Kelas tetap dapat
                dicari dengan opsi Sertakan arsip.
              </p>
              <button
                className="button button--outline"
                onClick={() => setConfirm(c.arsip ? "restore" : "archive")}
              >
                {c.arsip ? "Pulihkan kelas" : "Arsipkan kelas"}
              </button>
            </div>
          </>
        ) : tab === "riwayat" ? (
          <section>
            <ClassTabHeading
              title="Riwayat aktivitas kelas"
              description="Lihat aktivitas dan riwayat impor untuk kelas ini."
            />
            <div className="mg-panel">
              {data.audit.map((e) => (
                <div className="mg-list-row" key={e.id}>
                  <span>
                    <strong>{e.jenis.replaceAll("_", " ")}</strong>
                    <small>
                      {e.ringkas} · {new Date(e.pada).toLocaleString("id-ID")}
                    </small>
                  </span>
                </div>
              ))}
              {!data.audit.length && <p>Belum ada aktivitas.</p>}
            </div>
            <h3>Riwayat impor</h3>
            {data.impor.map((i) => (
              <p key={i.id}>
                {i.source} · {i.jumlah} baris ·{" "}
                {new Date(i.pada).toLocaleString("id-ID")}
              </p>
            ))}
          </section>
        ) : (
          <Notice kind="warning">
            Bagian ini tidak tersedia untuk akses akunmu.
          </Notice>
        )}
      </div>
      {confirm && (
        <Modal
          title={
            confirm === "activate"
              ? "Aktifkan kelas?"
              : confirm === "archive"
                ? "Arsipkan kelas?"
                : "Pulihkan kelas?"
          }
          onClose={() => setConfirm(null)}
          busy={task.busy}
        >
          <p>
            {confirm === "activate"
              ? `${c.matkulNama} · ${c.nama}. ${data.peserta.filter((p) => p.aktif !== false).length} mahasiswa aktif dan ${data.pertemuan.filter((p) => p.tipe === "REGULER").length} sesi praktikum. Periksa identitas, tanggal, dan preview BAP sebelum melanjutkan.`
              : confirm === "archive"
                ? "Presensi, mahasiswa, dan template tidak dapat diubah selama diarsipkan. Dokumen tetap tersedia."
                : "Kelas dapat digunakan dan diubah kembali."}
          </p>
          <Feedback task={task} />
          <button
            className="button button--primary"
            onClick={() =>
              task
                .run(async () => {
                  if (confirm === "activate")
                    await activate({ token, kelasId: c.id });
                  else
                    await archive({
                      token,
                      kelasId: c.id,
                      arsip: confirm === "archive",
                    });
                  setConfirm(null);
                })
                .catch(() => {})
            }
          >
            Ya,{" "}
            {confirm === "activate"
              ? "aktifkan"
              : confirm === "archive"
                ? "arsipkan"
                : "pulihkan"}
          </button>
        </Modal>
      )}
    </>
  );
}
function CourseSettings({ token, data }) {
  const [nama, setNama] = useState(data.kelas.matkulNama),
    [kode, setKode] = useState(data.kelas.matkulKode),
    save = useMutation(api.kelola.saveCourse),
    task = useTask();
  return (
    <section className="mg-panel">
      <h3>Mata kuliah induk</h3>
      <p className="muted">
        Nama dan kode ini digunakan kelas-kelas pada matkul yang sama. Snapshot
        arsip tetap utuh.
      </p>
      <TaskForm
        task={task}
        onSubmit={() =>
          task.run(() => save({ token, id: data.kelas.matkulId, nama, kode }))
        }
      >
        <div className="mg-form-grid">
          <Field
            label="Nama mata kuliah"
            value={nama}
            onChange={setNama}
            required
          />
          <Field
            label="Kode mata kuliah"
            value={kode}
            onChange={setKode}
            maxLength={30}
            required
          />
        </div>
        <button className="button button--outline">Simpan mata kuliah</button>
      </TaskForm>
    </section>
  );
}
export function Documents({ token, catalog, onPrint, kelasId: initial }) {
  const [kelasId, setClass] = useState(initial || catalog.kelas[0]?.id || ""),
    [preview, setPreview] = useState(null),
    task = useTask(),
    docs = useQuery(api.bap.history, kelasId ? { token, kelasId } : "skip");
  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  return (
    <main className="mg-page">
      <div className="mg-page-heading">
        <div>
          <p className="eyebrow">Dokumen & revisi tersimpan</p>
          <h1>Arsip BAP.</h1>
          <p>Word untuk penyuntingan, PDF untuk pratinjau dan cetak.</p>
        </div>
        {kelasId && (
          <button
            className="button button--primary"
            onClick={() => onPrint(kelasId)}
          >
            Siapkan cetak
          </button>
        )}
      </div>
      <Field
        label="Kelas"
        value={kelasId}
        onChange={setClass}
        options={catalog.kelas.map((c) => ({
          value: c.id,
          label: `${c.matkulKode} · ${c.nama} · ${c.semester} ${c.tahunAkademik}${c.arsip ? " · Arsip" : ""}`,
        }))}
      />
      <Feedback task={task} />
      {!kelasId ? (
        <div className="empty-state">
          <h2>Belum ada kelas</h2>
          <p>Dokumen akan muncul setelah kelas dan presensi disiapkan.</p>
        </div>
      ) : !docs ? (
        <SkeletonRows title="Memuat arsip BAP" />
      ) : (
        <div className="mg-panel">
          {docs.map((d) => (
            <div className="mg-list-row" key={d.id}>
              <span>
                <strong>
                  Pertemuan {d.nomor} · {d.format.toUpperCase()} · revisi{" "}
                  {d.revision}
                </strong>
                <small>
                  {d.tanggal} · Template{" "}
                  {/-v(\d+)/.exec(String(d.templateVersion))?.[1]
                    ? `v${/-v(\d+)/.exec(String(d.templateVersion))[1]}`
                    : "lama"}
                </small>
              </span>
              <div className="mg-inline-actions">
                {d.format === "pdf" && (
                  <button
                    className="button button--outline"
                    onClick={() =>
                      task
                        .run(async () => {
                          const r = await authenticatedDocument(d.url);
                          if (!r.ok) throw Error("Dokumen tidak dapat dibuka.");
                          setPreview({
                            url: URL.createObjectURL(await r.blob()),
                          });
                        }, "Preview siap.")
                        .catch(() => {})
                    }
                  >
                    Preview PDF
                  </button>
                )}
                <button
                  className="button button--outline"
                  onClick={() =>
                    task
                      .run(
                        () =>
                          unduhDokumen(
                            d.url,
                            `BAP_P${d.nomor}_r${d.revision}.${d.format}`,
                          ),
                        "Dokumen diunduh.",
                      )
                      .catch(() => {})
                  }
                >
                  Unduh {d.format.toUpperCase()}
                </button>
              </div>
            </div>
          ))}
          {!docs.length && (
            <div className="empty-state">
              <h2>Belum ada dokumen</h2>
              <p>
                Simpan dan kunci presensi, lalu buat BAP dari halaman pertemuan.
              </p>
            </div>
          )}
        </div>
      )}
      {preview && (
        <Modal title="Preview PDF BAP" onClose={() => setPreview(null)} wide>
          <PdfPreview title="Dokumen PDF BAP" url={preview.url} />
          <a
            className="button button--outline"
            href={preview.url}
            download="BAP.pdf"
          >
            Unduh PDF
          </a>
        </Modal>
      )}
    </main>
  );
}
