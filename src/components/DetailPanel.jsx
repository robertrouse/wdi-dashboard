import KpiGlyph from "./KpiGlyph.jsx";
import Sparkline from "./Sparkline.jsx";
import DeltaArrow from "./DeltaArrow.jsx";
import { formatValue, splitValue, clamp } from "../lib/format.js";
import { score, delta, trendSlope, referenceFor, PERF } from "../lib/kpi.js";

/* --------------------------------------------------------------------------
   Country detail.

   The BBOD dashboard's detail pane, one level down: pick a row and every
   indicator for that entity is laid out by topic, in full — the number in its
   own units, where it sits against the peer set, the direction of travel, and
   the definition and caveats in running text rather than buried in a hover.

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
    <section
      style={{
        background: "var(--white)", borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)", border: "1px solid var(--rule)",
        marginTop: 30, overflow: "hidden",
      }}
    >
      <header
        style={{
          background: "var(--blue-raven)", color: "var(--white)",
          padding: "20px 28px", display: "flex", alignItems: "baseline",
          justifyContent: "space-between", gap: 20, flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: "var(--blue-ice)" }}>
            {row.kind === "region" ? "Region detail · official World Bank aggregate" : "Country detail"}
          </div>
          <h2 style={{ fontSize: "var(--t-sub)", lineHeight: 1.15, marginTop: 2 }}>{row.label}</h2>
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

      <div style={{ padding: "4px 28px 30px" }}>
        {groups.map((g) => (
          <div key={g.name}>
            <div
              className="eyebrow"
              style={{ color: "var(--blue-maven)", padding: "24px 0 8px", borderBottom: "1px solid var(--rule)" }}
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
                    gridTemplateColumns: "minmax(180px,1fr) 186px 120px 186px minmax(250px,1.6fr)",
                    gap: 18, alignItems: "center",
                    padding: "16px 0", borderBottom: "1px solid var(--rule)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "17.5px", fontWeight: 500, lineHeight: 1.25 }}>{ind.label}</div>
                    <div style={{ fontSize: "13.5px", color: "var(--warm-grey)" }}>
                      {scale?.benchmark != null
                        ? `${scale.benchmarkKind} ${formatValue(scale.benchmark, ind)}`
                        : "no benchmark"}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
                    <div style={{ textAlign: "right", minWidth: 0 }}>
                      <div className="tabular"
                           style={{ fontSize: "22px", fontWeight: 500, whiteSpace: "nowrap",
                                    color: rec ? "var(--ink)" : "var(--neutral-grey)" }}>
                        {splitValue(rec?.v, ind).num}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--warm-grey)", whiteSpace: "nowrap" }}>
                        {splitValue(rec?.v, ind).unit}
                        {splitValue(rec?.v, ind).unit && rec ? " · " : ""}
                        {rec ? rec.y : "—"}
                      </div>
                    </div>
                    <KpiGlyph perf={sc.perf} deviation={sc.deviation} size={30} />
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
                      width={175} height={44} showDots
                      color={PERF_COLOR[sc.perf]}
                      dotColor={dl.favorable === false ? "var(--red-cerise)" : dl.favorable === true ? "var(--blue-maven)" : "var(--warm-grey)"}
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

                  <div style={{ fontSize: "15px", lineHeight: 1.45, color: "var(--ink-soft)" }}>
                    {clamp(ind.definition, 210)}
                    <div style={{ marginTop: 6, fontSize: "14px", color: "var(--warm-grey)" }}>
                      <span style={{ color: "var(--red-cerise)", fontWeight: 500 }}>Caveat · </span>
                      {clamp(ind.caveat, 170)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
