import ActionMark from "./ActionMark.jsx";

/* One compact bar. Everything here is chrome, not data, so it earns as little
   vertical space as it can get away with: title, mark, and the one control
   that has to be reachable from anywhere. The run stats that used to sit here
   (countries / indicators / latest year) are gone — the count of countries is
   already in the filter drawer, and the data vintage is in the method note
   under the table, so on the bar they were costing height to repeat things
   stated better elsewhere. */

export default function Header({ actions }) {
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
      <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
        {/* White on Blue Raven is the treatment the brand book shows for the
            pictogram (p.14); eyes take the background so the tentacle lines
            behind them stay masked. */}
        <ActionMark size={34} eyeFill="var(--blue-raven)" title="Action" />
        <h1 style={{ fontSize: "23px", lineHeight: 1.1, margin: 0 }}>
          World Development Indicators
        </h1>
      </div>
      {actions}
    </header>
  );
}
