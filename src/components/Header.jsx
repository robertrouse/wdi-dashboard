export default function Header({ bundle, countryCount, indicatorCount }) {
  return (
    <header
      style={{
        background: "var(--blue-raven)",
        color: "var(--white)",
        padding: "26px 34px 24px",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 28, flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {/* Mark: the normalization idea itself — one circle, part filled. */}
        <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" style={{ flexShrink: 0 }}>
          <defs>
            <clipPath id="hdr-clip"><rect x="0" y="8" width="52" height="18" /></clipPath>
          </defs>
          <circle cx="26" cy="26" r="21" fill="none" stroke="var(--blue-ice)" strokeWidth="3" />
          <circle cx="26" cy="26" r="21" fill="var(--blue-ice)" clipPath="url(#hdr-clip)" />
          <line x1="5" y1="26" x2="47" y2="26" stroke="var(--blue-ice)" strokeWidth="2.5" />
        </svg>
        <div>
          <div className="eyebrow" style={{ color: "var(--blue-ice)" }}>
            World Development Indicators
          </div>
          <h1 style={{ fontSize: "var(--t-head)", lineHeight: 1.05, margin: "2px 0 0" }}>
            Many metrics, one view
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: "17px", fontWeight: 300, color: "var(--cool-grey)", maxWidth: 620, lineHeight: 1.4 }}>
            Fifteen indicators measured in dollars, percentages, years, rates and
            raw counts — read side by side without a shared axis.
          </p>
        </div>
      </div>

      <dl style={{ display: "flex", gap: 30, margin: 0 }}>
        <Stat k="Countries" v={countryCount} />
        <Stat k="Indicators" v={indicatorCount} />
        <Stat k="Data through" v={bundle.yearSpan[1]} />
        <Stat k="Built" v={bundle.generated} />
      </dl>
    </header>
  );
}

function Stat({ k, v }) {
  return (
    <div>
      <dt className="eyebrow" style={{ color: "var(--raven-2)" }}>{k}</dt>
      <dd className="tabular" style={{ margin: 0, fontSize: "24px", fontWeight: 500, color: "var(--blue-ice)" }}>{v}</dd>
    </div>
  );
}
