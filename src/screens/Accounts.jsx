import { PageHelp, HelpGroup, useHelpScope } from "../components/Help.jsx";
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import { Field, TaskForm, useTask, Feedback } from "../components/Form.jsx";
import { navigate } from "../lib/navigation.js";
import Modal from "../components/Modal.jsx";
import { SkeletonRows } from "../components/Loading.jsx";
import { Notice } from "../components/Layout.jsx";
const roleOptions = [
  { value: "ADMIN", label: "Admin penuh" },
  { value: "PENGELOLA", label: "Pengelola kelas" },
  { value: "OPERATOR", label: "Operator presensi" },
];
export function PasswordForm({
  token,
  user,
  forced = false,
  onLogout,
  targetId,
  onClose,
}) {
  const change = useAction(api.authNode.changePassword),
    task = useTask();
  const [oldPassword, setOld] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  return (
    <TaskForm
      task={task}
      onSubmit={() =>
        task.run(
          async () => {
            if (password !== confirm)
              throw Error("Konfirmasi password belum sama.");
            await change({
              token,
              password,
              oldPassword,
              ...(targetId ? { id: targetId } : {}),
            });
            if (targetId) {
              onClose();
            } else onLogout();
          },
          targetId
            ? "Password direset."
            : "Password diperbarui. Masuk kembali.",
        )
      }
    >
      <p>
        {targetId
          ? "Siapkan password sementara dan sampaikan secara privat. Pengguna wajib menggantinya saat masuk."
          : forced
            ? "Sebelum mulai, ganti password sementara dengan password milikmu. Setelah tersimpan, masuk kembali."
            : "Perubahan password akan mengakhiri semua sesi akun ini."}
      </p>
      {!forced && !targetId && (
        <Field
          label="Password saat ini"
          type="password"
          value={oldPassword}
          onChange={setOld}
          autoComplete="current-password"
          required
        />
      )}
      <Field
        label={targetId ? "Password sementara baru" : "Password baru"}
        type="password"
        value={password}
        onChange={setPassword}
        minLength={12}
        maxLength={128}
        help="Minimal 12 karakter. Boleh memakai frasa yang mudah diingat."
        autoComplete="new-password"
        required
      />
      <Field
        label="Ulangi password baru"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        required
      />
      <button className="button button--primary" disabled={task.busy}>
        Simpan password
      </button>
    </TaskForm>
  );
}
export function Profile({ token, user, onLogout, forced = false }) {
  useHelpScope({userId:user.id,role:user.peran,area:"profil",classId:"",enabled:false,capabilities:[]},30);
  const profile = useMutation(api.accounts.profile),
    revoke = useMutation(api.auth.revokeSession),
    getCodes = useAction(api.authNode.recoveryCodes),
    sessions = useQuery(api.auth.sessions, { token }),
    task = useTask();
  const [nama, setNama] = useState(user.nama),
    [codes, setCodes] = useState(null),
    [confirmCodes, setConfirmCodes] = useState(false);
  if (forced)
    return (
      <main className="mg-page mg-narrow">
        <p className="eyebrow">Akun {user.username}</p>
        <h1>Amankan akunmu.</h1><PageHelp area="profil" tour={false}/>
        <PasswordForm token={token} user={user} forced onLogout={onLogout} />
      </main>
    );
  return (
    <main className="mg-page">
      <p className="eyebrow">Akun & preferensi</p>
      <h1>Pengaturan.</h1><PageHelp area="profil" tour={false}/>
      <div className="mg-settings-grid">
        <section className="mg-panel">
          <h2>Profil</h2>
          <p className="muted">
            {user.username} · {user.peran}
          </p>
          <TaskForm
            task={task}
            onSubmit={() => task.run(() => profile({ token, nama }))}
          >
            <Field
              label="Nama tampilan"
              value={nama}
              onChange={setNama}
              required
            />
            <button className="button button--primary">Simpan profil</button>
          </TaskForm>
        </section>
        <section className="mg-panel">
          <HelpGroup topic="profile"><h2>Ganti password</h2></HelpGroup>
          <PasswordForm token={token} user={user} onLogout={onLogout} />
        </section>
        <section className="mg-panel">
          <h2>Sesi masuk</h2>
          <p className="muted">
            Keluar dari perangkat yang tidak lagi dipakai.
          </p>
          {sessions?.map((s) => (
            <div className="mg-list-row" key={s.id}>
              <span>
                <strong>{s.label}</strong>
                <small>
                  {new Date(s.dibuatPada).toLocaleString("id-ID")}
                  {s.saatIni ? " · Sesi ini" : ""}
                </small>
              </span>
              <button
                className="button button--outline"
                onClick={() =>
                  task
                    .run(async () => {
                      await revoke({ token, id: s.id });
                      if (s.saatIni) onLogout();
                    })
                    .catch(() => {})
                }
              >
                Cabut sesi
              </button>
            </div>
          ))}
        </section>
        {user.peran === "ADMIN" && (
          <section className="mg-panel">
            <HelpGroup topic="recovery"><h2>Pemulihan admin</h2></HelpGroup>
            <p>
              Simpan kode pemulihan secara privat. Setiap kode hanya berlaku
              sekali. Membuat kode baru membatalkan kode lama.
            </p>
            <button
              className="button button--outline"
              onClick={() => setConfirmCodes(true)}
            >
              Buat kode pemulihan baru
            </button>
            {codes && (
              <div className="mg-recovery">
                <p>
                  Salin dan simpan sekarang. Kode tidak ditampilkan lagi setelah
                  halaman ditutup.
                </p>
                <textarea
                  readOnly
                  rows={8}
                  aria-label="Kode pemulihan"
                  value={codes.join("\n")}
                />
                <button
                  className="button button--quiet"
                  onClick={() => setCodes(null)}
                >
                  Sudah disimpan, sembunyikan
                </button>
              </div>
            )}
          </section>
        )}
      </div>
      {confirmCodes && (
        <Modal
          title="Ganti kode pemulihan?"
          onClose={() => setConfirmCodes(false)}
        >
          <p>Kode pemulihan sebelumnya akan dibatalkan.</p>
          <button
            className="button button--primary"
            onClick={() =>
              task
                .run(async () => {
                  setCodes(await getCodes({ token }));
                  setConfirmCodes(false);
                })
                .catch(() => {})
            }
          >
            Ya, buat kode baru
          </button>
          <Feedback task={task} />
        </Modal>
      )}
    </main>
  );
}
export default function Accounts({ token, user, catalog }) {
  const users = useQuery(api.accounts.list, { token }),
    create = useAction(api.authNode.createUser),
    update = useMutation(api.accounts.update),
    task = useTask();
  const [edit, setEdit] = useState(null),
    [reset, setReset] = useState(null);
  if (!users)
    return (
      <main className="mg-page">
        <SkeletonRows title="Memuat akun" />
      </main>
    );
  return (
    <main className="mg-page">
      <div className="mg-page-heading">
        <div>
          <p className="eyebrow">Kendali administrator</p>
          <h1>Akun & akses.</h1><PageHelp area="akun" tour={false}/><HelpGroup topic="accounts"><span>Peran dan penugasan kelas</span></HelpGroup>
          <p>Atur peran dan kelas yang dapat dibuka setiap pengguna.</p>
        </div>
        <button
          className="button button--primary"
          onClick={() =>
            setEdit({
              username: "",
              nama: "",
              peran: "OPERATOR",
              aktif: true,
              kelasIds: [],
            })
          }
        >
          Tambah akun
        </button>
      </div>
      <Feedback task={task} />
      <div className="mg-panel">
        {users.map((u) => (
          <div key={u.id} className="mg-list-row">
            <span>
              <strong>{u.nama}</strong>
              <small>
                {u.username} · {u.peran} · {u.aktif ? "Aktif" : "Nonaktif"}
                {u.wajibGanti ? " · Wajib ganti password" : ""}
              </small>
            </span>
            <div className="mg-inline-actions">
              <button
                className="button button--outline"
                onClick={() => setEdit(u)}
              >
                Atur akses
              </button>
              <button
                className="button button--quiet"
                onClick={() =>
                  u.id === user.id ? navigate("/pengaturan") : setReset(u)
                }
              >
                Reset password
              </button>
            </div>
          </div>
        ))}
      </div>
      <Notice>
        Admin terakhir tetap aktif. Pengelola/operator hanya mendapat akses ke
        kelas yang ditugaskan; kelas yang dibuat pengelola ditambahkan otomatis.
      </Notice>
      {edit && (
        <AccountEditor
          key={edit.id || "new"}
          item={edit}
          catalog={catalog}
          token={token}
          task={task}
          create={create}
          update={update}
          onClose={() => {
            setEdit(null);
            task.clear();
          }}
        />
      )}
      {reset && (
        <Modal
          title={`Reset password ${reset.username}`}
          onClose={() => setReset(null)}
        >
          <PasswordForm
            token={token}
            targetId={reset.id}
            onClose={() => setReset(null)}
            onLogout={() => {}}
          />
        </Modal>
      )}
    </main>
  );
}
function AccountEditor({
  item,
  catalog,
  token,
  task,
  create,
  update,
  onClose,
}) {
  const [form, setForm] = useState(item),
    [password, setPassword] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal
      title={item.id ? "Atur akses akun" : "Tambah akun"}
      onClose={onClose}
      busy={task.busy}
    >
      <TaskForm
        task={task}
        onSubmit={() =>
          task.run(async () => {
            if (item.id)
              await update({
                token,
                id: item.id,
                nama: form.nama,
                peran: form.peran,
                aktif: form.aktif,
                kelasIds: form.kelasIds,
              });
            else
              await create({
                token,
                username: form.username,
                nama: form.nama,
                peran: form.peran,
                password,
                kelasIds: form.kelasIds,
              });
            onClose();
          })
        }
      >
        {!item.id && (
          <Field
            label="Username"
            value={form.username}
            onChange={(v) => set("username", v)}
            pattern="[a-z0-9._-]{3,40}"
            help="3–40 karakter: huruf kecil, angka, titik, garis bawah, atau tanda minus."
            required
          />
        )}
        <Field
          label="Nama"
          value={form.nama}
          onChange={(v) => set("nama", v)}
          required
        />
        <Field
          label="Peran"
          value={form.peran}
          onChange={(v) => set("peran", v)}
          options={roleOptions}
        />
        {item.id ? (
          <label className="mg-check">
            <input
              type="checkbox"
              checked={form.aktif}
              onChange={(e) => set("aktif", e.target.checked)}
            />
            Akun aktif
          </label>
        ) : (
          <Field
            label="Password sementara"
            type="password"
            value={password}
            onChange={setPassword}
            minLength={12}
            autoComplete="new-password"
            required
          />
        )}
        <h3>Kelas ditugaskan</h3>
        {form.peran === "ADMIN" ? (
          <p>Admin mendapat akses semua kelas.</p>
        ) : (
          catalog.kelas.map((c) => (
            <label className="mg-check" key={c.id}>
              <input
                type="checkbox"
                checked={form.kelasIds.includes(c.id)}
                onChange={(e) =>
                  set(
                    "kelasIds",
                    e.target.checked
                      ? [...form.kelasIds, c.id]
                      : form.kelasIds.filter((id) => id !== c.id),
                  )
                }
              />
              {c.matkulKode} · {c.nama} · {c.tahunAkademik}
            </label>
          ))
        )}
        <button className="button button--primary">Simpan akun</button>
      </TaskForm>
    </Modal>
  );
}
