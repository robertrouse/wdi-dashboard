import { Fragment } from "react";
import KpiGlyph from "./KpiGlyph.jsx";
import Sparkline from "./Sparkline.jsx";
import DeltaArrow from "./DeltaArrow.jsx";
import Tooltip, { IndicatorCard } from "./Tooltip.jsx";
import { formatValue } from "../lib/format.js";
import { score, delta, referenceFor, PERF } from "../lib/kpi.js";

/* --------------------------------------------------------------------------
   The main view: countries (or regions) down the side, metrics across the top.

   Reading order is deliberate. The eye lands on the focus metric block —
   value, change, trend — which answers "how is this one doing?" in native
   units. The glyph matrix to its right answers "and everything else?" in a
   single normalized visual language. Neither could do the other's job.
   -------------------------------------------------------------------------- */

const PERF_COLOR = {
  [PERF.STRONG]: "var(--blue-maven)",
  [PERF.MID]: "var(--blaze)",
  [PERF.WEAK]: "var(--red-cerise)",
  [PERF.NEUTRAL]: "var(--warm-grey)",
  [PERF.NONE]: "var(--neutral-grey)",
};

function perfWord(perf, ind, scale) {
  if (perf === PERF.NONE) return "No recent data";
  if (perf === PERF.NEUTRAL) return "No favorable direction — shown for context";
  const bm = scale?.benchmarkKind === "target" ? "the target" : "the peer median";
  return perf === PERF.STRONG ? `Clearly better than ${bm}`
       : perf === PERF.MID ? `Close to ${bm}`
       : `Clearly worse than ${bm}`;
}

export default function Matrix({
  rows, indicators, focus, scales, bundle, onSelectRow, selectedRow,
}) {
  const glyphInds = indicators;
  const regionView = rows.some((r) => r.kind === "region");

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--blue-raven)" }}>
            <th style={{ ...th, textAlign: "left", minWidth: 210, paddingLeft: 4 }}>
              {regionView ? "Region" : "Country"}
            </th>
            <th style={{ ...th, textAlign: "right", minWidth: 138 }}>
              <Tooltip content={<IndicatorCard ind={focus} />}>
                <span style={{ borderBottom: "1.5px dotted var(--blue-maven)" }}>
                  {focus.label}
                </span>
              </Tooltip>
              {/* Said once here rather than repeated on all seven rows. Which
                  method the Bank uses changes with the metric — a sum for
                  population, a weighted average for life expectancy — and that
                  it changes is part of the point. */}
              {regionView && focus.aggShort && (
                <span style={{ display: "block", fontSize: "13px", fontWeight: 400,
                               letterSpacing: 0, color: "var(--warm-grey)", marginTop: 3 }}>
                  regional aggregate · {focus.aggShort}
                </span>
              )}
            </th>
            <th style={{ ...th, textAlign: "right", minWidth: 104 }}>Change</th>
            <th style={{ ...th, textAlign: "left", minWidth: 178, paddingLeft: 18 }}>
              {bundle.yearSpan[0]}–{bundle.yearSpan[1]} trend
            </th>
            {glyphInds.map((ind) => (
              <th key={ind.id} style={{ ...th, width: 44, padding: "0 3px 10px", height: 118, verticalAlign: "bottom" }}>
                <Tooltip content={<IndicatorCard ind={ind} />}>
                  <span
                    style={{
                      writingMode: "vertical-rl", transform: "rotate(180deg)",
                      fontSize: "13.5px", fontWeight: ind.id === focus.id ? 600 : 400,
                      letterSpacing: "0.02em", whiteSpace: "nowrap",
                      color: ind.id === focus.id ? "var(--blue-maven)" : "var(--ink-soft)",
                      maxHeight: 104, overflow: "hidden",
                    }}
                  >
                    {ind.short ?? ind.label}
                  </span>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.kind === "groupHeader") {
              return (
                <tr key={`g-${row.label}`}>
                  <td colSpan={4 + glyphInds.length}
                      style={{
                        padding: "22px 4px 7px", fontSize: "13px", fontWeight: 600,
                        letterSpacing: "0.14em", textTransform: "uppercase",
                        color: "var(--blue-maven)",
                        borderBottom: "1px solid var(--rule)",
                      }}>
                    {row.label}
                    <span style={{ fontWeight: 300, letterSpacing: 0, textTransform: "none", color: "var(--warm-grey)", marginLeft: 10 }}>
                      {row.count} {row.count === 1 ? "country" : "countries"}
                    </span>
                  </td>
                </tr>
              );
            }

            const rec = row.get(focus.id);
            const sc = score(rec, focus, scales[focus.id]);
            const dl = delta(rec, focus);
            const isSel = selectedRow === row.id;
            const stale = rec && rec.y < bundle.yearSpan[1] - 1;
            // The published subtotal heading a section — set apart from the
            // members below it, because it is a different kind of number and
            // must not read as one more country in the list.
            const isAgg = row.kind === "aggregate" || row.kind === "world";

            return (
              <tr
                key={row.id}
                onClick={() => onSelectRow?.(row)}
                style={{
                  borderBottom: isAgg ? "1.5px solid var(--cool-grey)" : "1px solid var(--rule)",
                  background: isSel ? "var(--surface-alt)"
                            : isAgg ? "rgba(216,233,244,.42)"
                            : i % 2 ? "transparent" : "rgba(255,255,255,.55)",
                  cursor: onSelectRow ? "pointer" : "default",
                }}
              >
                <td style={{ ...td, paddingLeft: 4 }}>
                  <span style={{ fontSize: "17.5px", fontWeight: isSel || isAgg ? 600 : 400,
                                 color: isAgg ? "var(--blue-raven)" : undefined }}>{row.label}</span>
                  {row.sub && (
                    <span style={{ display: "block", fontSize: "13.5px", color: "var(--warm-grey)", lineHeight: 1.2 }}>
                      {row.sub}
                    </span>
                  )}
                </td>

                <td style={{ ...td, textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 9 }}>
                    <span className="tabular"
                          style={{ fontSize: "var(--t-value)", fontWeight: 500, color: rec ? "var(--ink)" : "var(--neutral-grey)" }}>
                      {formatValue(rec?.v, focus)}
                    </span>
                    <KpiGlyph perf={sc.perf} deviation={sc.deviation} size={28}
                              title={perfWord(sc.perf, focus, scales[focus.id])} />
                  </div>
                  {rec && (
                    <span style={{ fontSize: "13px", color: stale ? "var(--blaze)" : "var(--warm-grey)", display: "block", marginTop: 1 }}>
                      {rec.y}{stale ? " · older reading" : ""}
                    </span>
                  )}
                </td>

                <td style={{ ...td, textAlign: "right" }}>
                  <DeltaArrow d={dl} ind={focus} />
                  {dl.from && (
                    <span style={{ display: "block", fontSize: "13px", color: "var(--warm-grey)" }}>
                      vs {dl.from}
                    </span>
                  )}
                </td>

                <td style={{ ...td, paddingLeft: 18 }}>
                  <Sparkline
                    points={rec?.t}
                    reference={referenceFor(bundle, row, focus)}
                    ind={focus}
                    color={PERF_COLOR[sc.perf === PERF.NONE ? PERF.NONE : sc.perf]}
                    dotColor={dl.favorable === false ? "var(--red-cerise)" : dl.favorable === true ? "var(--blue-maven)" : "var(--warm-grey)"}
                  />
                </td>

                {glyphInds.map((ind) => {
                  const r2 = row.get(ind.id);
                  const s2 = score(r2, ind, scales[ind.id]);
                  return (
                    <td key={ind.id} style={{ ...td, textAlign: "center", padding: "9px 3px" }}>
                      <Tooltip
                        width={300}
                        content={
                          <RowMetricCard
                            ind={ind} row={row} rec={r2} sc={s2}
                            scale={scales[ind.id]} bundle={bundle}
                          />
                        }
                      >
                        <KpiGlyph perf={s2.perf} deviation={s2.deviation} size={26} />
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th = {
  padding: "0 8px 12px", fontSize: "14px", fontWeight: 600,
  letterSpacing: "0.03em", color: "var(--ink)", verticalAlign: "bottom",
};
const td = { padding: "11px 8px", verticalAlign: "middle" };

/* The hover card on a data-row glyph.
   Deliberately NOT the indicator card. Hovering a COLUMN HEADER asks "what is
   this metric, and how should I read it?" — definition and caveats. Hovering a
   glyph in a ROW asks "how is this one doing?", and the honest answer is that
   row's number and the shape of its decade, not a paragraph the reader has
   already read fifteen times on the way down the table. */
function RowMetricCard({ ind, row, rec, sc, scale, bundle }) {
  const dl = delta(rec, ind);
  const t = rec?.t ?? [];
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 2 }}>{ind.label}</div>
      <div style={{ fontSize: "17px", fontWeight: 600, lineHeight: 1.2 }}>{row.label}</div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 7 }}>
        <span className="tabular" style={{ fontSize: "23px", fontWeight: 500,
              color: rec ? "var(--ink)" : "var(--neutral-grey)" }}>
          {formatValue(rec?.v, ind)}
        </span>
        <span style={{ fontSize: "14px", color: "var(--warm-grey)" }}>
          {rec ? rec.y : "no recent reading"}
        </span>
      </div>

      <div style={{ fontSize: "14.5px", marginTop: 3, color: PERF_COLOR[sc.perf] }}>
        {perfWord(sc.perf, ind, scale)}
        {scale?.benchmark != null && sc.perf !== PERF.NONE && (
          <span style={{ color: "var(--warm-grey)" }}>
            {" · "}{scale.benchmarkKind} {formatValue(scale.benchmark, ind)}
          </span>
        )}
      </div>

      {t.length > 1 && (
        <div style={{ marginTop: 11, paddingTop: 11, borderTop: "1px solid var(--rule)" }}>
          <Sparkline
            points={t}
            reference={referenceFor(bundle, row, ind)}
            ind={ind}
            width={264} height={54} showDots
            color={PERF_COLOR[sc.perf]}
            dotColor={dl.favorable === false ? "var(--red-cerise)"
                    : dl.favorable === true ? "var(--blue-maven)" : "var(--warm-grey)"}
          />
          <div style={{ fontSize: "13px", color: "var(--warm-grey)", marginTop: 3 }}>
            {t[0][0]}–{t[t.length - 1][0]}
            {ind.aggShort && row.kind !== "region" ? ` · dotted line: ${ind.aggShort} for the region` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
