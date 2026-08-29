import KpiGlyph from "./KpiGlyph.jsx";
import Sparkline from "./Sparkline.jsx";
import DeltaArrow from "./DeltaArrow.jsx";
import { formatValue, splitValue } from "../lib/format.js";
import { score, delta, trendSlope, referenceFor, PERF } from "../lib/kpi.js";

/* --------------------------------------------------------------------------
   Country detail.

   The BBOD dashboard's detail pane, one level down: pick a row and every
   indicator for that entity is laid out by topic — the number in its own units,
   where it sits against the peer set, the direction of travel, and the shape of
   its decade.

   Definitions and caveats deliberately do NOT appear here. Fifteen paragraphs
   of standing text pushed the numbers off the screen and repeated, on every
   row, something the reader only needs once. They live on the column-header
   hover in the matrix, which is where the question "what is this metric?" is
   actually asked.

   This is where the "different units" problem is at its most acute: fifteen
   metrics, eight unit types, one column of numbers. What makes it legible is
   that the *shape* column is normalized while the *number* column never is.
   -------------------------------------------------------------------------- */

const PERF_COLOR = {
  [PERF.STRONG]: "var(--blue-maven)",
  [PERF.MID]: "var(--blaze)",
  [PERF.WEAK]: "var(--red-cerise)",
  [PERF.NEUTRAL]: "var(--warm-grey)",
  [PERF.NONE]: "var(--neutral-grey)",
};

export default function DetailPanel({ row, indicators, scales, bundle, onClose }) {
  if (!row) return null;

  const groups = [];
  for (const ind of indicators) {
    let g = groups.find((x) => x.name === ind.group);
    if (!g) groups.push((g = { name: ind.group, items: [] }));
    g.items.push(ind);
  }

  return (
    /* A modal rather than a panel below the matrix: the detail view answers
       "tell me everything about this row", and making the reader scroll past
       the table to find it — then scroll back to pick another row — turned a
       lookup into a journey. Backdrop click and Escape both dismiss. */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${row.label} detail`}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(10,16,68,.42)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
    <section
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "var(--white)", borderRadius: "var(--radius)",
        boxShadow: "0 24px 70px rgba(10,16,68,.34)", border: "1px solid var(--rule)",
        width: "min(860px, 100%)", maxHeight: "88vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      <header
        style={{
          background: "var(--blue-raven)", color: "var(--white)",
          padding: "13px 24px", display: "flex", alignItems: "baseline",
          justifyContent: "space-between", gap: 20, flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: "var(--blue-ice)" }}>
            {row.kind === "world" ? "World detail · official World Bank aggregate"
             : row.kind === "region" || row.kind === "aggregate" ? "Region detail · official World Bank aggregate"
             : "Country detail"}
          </div>
          <h2 style={{ fontSize: "24px", lineHeight: 1.1, marginTop: 1 }}>{row.label}</h2>
          {row.sub && <div style={{ fontSize: "16px", color: "var(--raven-2)", marginTop: 2 }}>{row.sub}</div>}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent", color: "var(--blue-ice)",
            border: "1.5px solid var(--blue-ice)", borderRadius: 8,
            padding: "8px 16px", fontSize: "15px", cursor: "pointer",
          }}
        >
          Close detail
        </button>
      </header>

      <div style={{ padding: "2px 24px 20px", overflowY: "auto" }}>
        {groups.map((g) => (
          <div key={g.name}>
            <div
              className="eyebrow"
              style={{ color: "var(--blue-maven)", padding: "14px 0 5px", borderBottom: "1px solid var(--rule)" }}
            >
              {g.name}
            </div>
            {g.items.map((ind) => {
              const rec = row.get(ind.id);
              const sc = score(rec, ind, scales[ind.id]);
              const dl = delta(rec, ind);
              const slope = trendSlope(rec);
              const scale = scales[ind.id];

              return (
                <div
                  key={ind.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(150px,1fr) 168px 148px 190px",
                    gap: 16, alignItems: "center",
                    padding: "9px 0", borderBottom: "1px solid var(--rule)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 500, lineHeight: 1.2 }}>{ind.label}</div>
                    <div style={{ fontSize: "13.5px", color: "var(--warm-grey)" }}>
                      {scale?.benchmark != null
                        ? `${scale.benchmarkKind} ${formatValue(scale.benchmark, ind)}`
                        : "no benchmark"}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
                    <div style={{ textAlign: "right", minWidth: 0 }}>
                      <div className="tabular"
                           style={{ fontSize: "19px", fontWeight: 500, whiteSpace: "nowrap",
                                    color: rec ? "var(--ink)" : "var(--neutral-grey)" }}>
                        {splitValue(rec?.v, ind).num}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--warm-grey)", whiteSpace: "nowrap" }}>
                        {splitValue(rec?.v, ind).unit}
                        {splitValue(rec?.v, ind).unit && rec ? " · " : ""}
                        {rec ? rec.y : "—"}
                      </div>
                    </div>
                    <KpiGlyph perf={sc.perf} deviation={sc.deviation} size={26} />
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <DeltaArrow d={dl} ind={ind} />
                    {dl.from && <div style={{ fontSize: "13px", color: "var(--warm-grey)" }}>vs {dl.from}</div>}
                  </div>

                  <div>
                    <Sparkline
                      points={rec?.t}
                      reference={referenceFor(bundle, row, ind)}
                      ind={ind}
                      width={182} height={38} showDots
                      color={PERF_COLOR[sc.perf]}
                    />
                    {slope != null && (
                      <div style={{ fontSize: "13px", color: "var(--warm-grey)", marginTop: 2 }}>
                        {(() => {
                          // A rate's trend belongs in points per year; a level's
                          // belongs in percent per year. Mixing them is how a
                          // "growth rate falling 5%" gets misread as a recession.
                          const useAbs = ind.suffix === "%" || ind.scale !== "compact";
                          const n = useAbs ? slope.perYear : slope.pctPerYear;
                          if (n == null) return null;
                          const unit = useAbs ? (ind.suffix === "%" ? " pts/yr" : ` ${ind.suffix || ""}/yr`) : "%/yr";
                          const digits = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2;
                          return `${n >= 0 ? "+" : "−"}${ind.prefix ?? ""}${Math.abs(n).toFixed(digits)}${unit} trend`;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
    </div>
  );
}
