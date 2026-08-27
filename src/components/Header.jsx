/* One compact bar. Everything here is chrome, not data, so it earns as little
   vertical space as it can get away with: no standfirst, no eyebrow, and the
   run stats set inline rather than stacked. The matrix is what people came for
   and it should be on screen without scrolling. */

export default function Header({ bundle, countryCount, indicatorCount, actions }) {
  return (
    <header
      style={{
        background: "var(--blue-raven)",
        color: "var(--white)",
        padding: "10px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 20, flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {/* Mark: the normalization idea itself — one circle, part filled. */}
        <svg width="30" height="30" viewBox="0 0 52 52" aria-hidden="true" style={{ flexShrink: 0 }}>
          <defs>
            <clipPath id="hdr-clip"><rect x="0" y="8" width="52" height="18" /></clipPath>
          </defs>
          <circle cx="26" cy="26" r="21" fill="none" stroke="var(--blue-ice)" strokeWidth="3" />
          <circle cx="26" cy="26" r="21" fill="var(--blue-ice)" clipPath="url(#hdr-clip)" />
          <line x1="5" y1="26" x2="47" y2="26" stroke="var(--blue-ice)" strokeWidth="2.5" />
        </svg>
        <h1 style={{ fontSize: "23px", lineHeight: 1.1, margin: 0, whiteSpace: "nowrap" }}>
          Many metrics, one view
        </h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
        <dl style={{ display: "flex", gap: 18, margin: 0, alignItems: "baseline" }}>
          <Stat k="Countries" v={countryCount} />
          <Stat k="Indicators" v={indicatorCount} />
          <Stat k="Through" v={bundle.yearSpan[1]} />
        </dl>
        {actions}
      </div>
    </header>
  );
}

/* Label and figure on one line — stacked, these four cost 40px of height for
   twelve characters of information. */
function Stat({ k, v }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
      <dt style={{ fontSize: "13px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--raven-2)" }}>{k}</dt>
      <dd className="tabular" style={{ margin: 0, fontSize: "17px", fontWeight: 500, color: "var(--blue-ice)" }}>{v}</dd>
    </div>
  );
}
