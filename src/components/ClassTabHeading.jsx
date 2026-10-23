import { HelpButton } from "./Help.jsx";
const TOPICS={"Mahasiswa":"roster","Jadwal pertemuan":"schedule","Template BAP":"template","Identitas kelas":"identity","Riwayat aktivitas kelas":"history"};
export default function ClassTabHeading({
  title,
  description,
  actions,
  children,
  className = "",
}) {
  return (
    <header className={`mg-tab-heading ${className}`}>
      <div className="mg-tab-heading-copy">
        <div className="help-group"><h2>{title}</h2><HelpButton topic={TOPICS[title]}/></div>
        {description && <p className="muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="mg-tab-actions">{actions}</div>}
    </header>
  );
}
