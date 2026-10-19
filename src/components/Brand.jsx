export default function Brand({ large = false }) {
  return (
    <div className={`brand${large ? " brand--large" : ""}`}>
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
        <path d="M40 40H152V64H64V192H176V144H200V216H40Z" />
        <path d="M107.51 120.49L148 160.97L228.49 80.49L211.51 63.51L148 127.03L124.49 103.51Z" />
        <path d="M88 152H128V172H88Z" />
      </svg>
      <span>BAP Praktikum</span>
    </div>
  );
}
