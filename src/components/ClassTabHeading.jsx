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
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="mg-tab-actions">{actions}</div>}
    </header>
  );
}
