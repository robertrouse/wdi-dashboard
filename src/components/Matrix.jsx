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

function perfWord(perf, ind, scale, value) {
  if (perf === PERF.NONE) return "No recent data";
  if (perf === PERF.NEUTRAL) return "No favorable direction — shown for context";

  /* A band metric is off target on BOTH sides, so 0.1% and 3.2% inflation score
     the same and draw the same cerise glyph. That is correct — deflation and
     overheating are both misses — but "clearly worse than the target" alone
     leaves the reader to work out which way, and two rows moving in opposite
     directions both turning red looks like a bug until you do. Name the side. */
  if (ind.direction === "band" && ind.targetBand && value != null) {
    const [lo, hi] = ind.targetBand;
    const band = `${lo}–${hi}${ind.suffix ? " " + ind.suffix : ""}`;
    if (value >= lo && value <= hi) return `On target · within ${band}`;
    return value < lo ? `Below the ${band} target band` : `Above the ${band} target band`;
  }

  const bm = scale?.benchmarkKind === "target" ? "the target" : "the peer median";
  return perf === PERF.STRONG ? `Clearly better than ${bm}`
       : perf === PERF.MID ? `Close to ${bm}`
       : `Clearly worse than ${bm}`;
}

export default function Matrix({
  rows, indicators, focus, scales, bundle, onSelectRow, selectedRow, onFocusMetric,
}) {
  const glyphInds = indicators;
  const regionView = rows.some((r) => r.kind === "region");
  const peerNoun = regionView ? "regions" : "countries";

  /* A hairline where the category changes — Economy, People, Health & Education
     and so on. The glossary already orders the metrics by group, so the blocks
     are contiguous and this only makes visible a structure that was already
     there. No labels: at 44px a column is too narrow to name a category, and
     the group is already the first line of every header's hover card. */
  const startsGroup = (i) => i > 0 && glyphInds[i].group !== glyphInds[i - 1].group;
  const GROUP_RULE = "1px solid var(--cool-grey)";

  return (
    <div style={{ paddingBottom: 8 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left", minWidth: 210, paddingLeft: 4 }}>
              {regionView ? "Region" : "Country"}
            </th>
            <th style={{ ...th, textAlign: "right", minWidth: 138 }}>
              <Tooltip content={<IndicatorCard ind={focus} extra={<BenchmarkLine ind={focus} scale={scales[focus.id]} peers={peerNoun} />} />}>
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
            <th style={{ ...th, textAlign: "right", minWidth: 148 }}>Change</th>
            <th style={{ ...th, textAlign: "left", minWidth: 178, paddingLeft: 18 }}>
              {bundle.yearSpan[0]}–{bundle.yearSpan[1]} trend
            </th>
            {glyphInds.map((ind, gi) => {
              const isFocus = ind.id === focus.id;
              return (
                <th
                  key={ind.id}
                  onClick={() => onFocusMetric?.(ind.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFocusMetric?.(ind.id); }
                  }}
                  tabIndex={onFocusMetric && !isFocus ? 0 : undefined}
                  role={onFocusMetric && !isFocus ? "button" : undefined}
                  aria-label={onFocusMetric && !isFocus ? `Focus on ${ind.label}` : undefined}
                  title={onFocusMetric && !isFocus ? `Show ${ind.label} in the value, change and trend columns` : undefined}
                  style={{
                    ...th, width: 44, padding: "0 3px 10px", height: 118, verticalAlign: "bottom",
                    cursor: onFocusMetric && !isFocus ? "pointer" : "default",
                    // Opaque, and never `undefined` — an undefined value here
                    // deletes the sticky header's background from the spread
                    // above and the rows scroll straight through it. The focus
                    // tint is rgba(70,85,228,.07) pre-composited on the page
                    // background, since a translucent tint would do the same.
                    background: isFocus ? "#E8EFFD" : "var(--background)",
                    // A border on a sticky cell does not travel with it under
                    // border-collapse, so the group rule is a shadow here and a
                    // real border on the body cells below.
                    boxShadow: startsGroup(gi)
                      ? "inset 1px 0 0 var(--cool-grey), inset 0 -2px 0 var(--blue-raven)"
                      : th.boxShadow,
                  }}
                >
                  <Tooltip
                    cursor={onFocusMetric && !isFocus ? "pointer" : "help"}
                    content={
                      <IndicatorCard
                        ind={ind}
                        extra={
                          <>
                            <BenchmarkLine ind={ind} scale={scales[ind.id]} peers={peerNoun} />
                            {!isFocus && (
                              <div style={{ fontSize: "14.5px", fontWeight: 500, color: "var(--blue-maven)", marginBottom: 6 }}>
                                Click to make this the focus metric
                              </div>
                            )}
                          </>
                        }
                      />
                    }
                  >
                    <span
                      style={{
                        writingMode: "vertical-rl", transform: "rotate(180deg)",
                        fontSize: "13.5px", fontWeight: isFocus ? 600 : 400,
                        letterSpacing: "0.02em", whiteSpace: "nowrap",
                        color: isFocus ? "var(--blue-maven)" : "var(--ink-soft)",
                        maxHeight: 104, overflow: "hidden",
                      }}
                    >
                      {ind.short ?? ind.label}
                    </span>
                  </Tooltip>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
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
                  // Framed top and bottom, so it reads as the head of a section
                  // now that there is no separate heading row above it.
                  borderTop: isAgg && i > 0 ? "1.5px solid var(--cool-grey)" : undefined,
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
                  {/* The focus metric gets the same hover card as every other
                      metric in the row. It used to carry only a native title
                      attribute, so the most prominent number on the page was
                      the one place the benchmark was not reachable. */}
                  <Tooltip
                    width={300}
                    content={
                      <RowMetricCard
                        ind={focus} row={row} rec={rec} sc={sc}
                        scale={scales[focus.id]} bundle={bundle}
                      />
                    }
                  >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 9 }}>
                    <span className="tabular"
                          style={{ fontSize: "var(--t-value)", fontWeight: 500, color: rec ? "var(--ink)" : "var(--neutral-grey)" }}>
                      {formatValue(rec?.v, focus)}
                    </span>
                    <KpiGlyph perf={sc.perf} deviation={sc.deviation} size={28} />
                  </div>
                  </Tooltip>
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
                  />
                </td>

                {glyphInds.map((ind, gi) => {
                  const r2 = row.get(ind.id);
                  const s2 = score(r2, ind, scales[ind.id]);
                  return (
                    <td key={ind.id} style={{ ...td, textAlign: "center", padding: "9px 3px",
                                              borderLeft: startsGroup(gi) ? GROUP_RULE : undefined }}>
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

/* Sticky, so the fifteen rotated metric labels are still there after a page of
   countries — they are the only thing identifying the glyph columns, and since
   they became clickable they are a control as well as a label.

   The rule under the header is a box-shadow rather than a border: with
   border-collapse:collapse a border on a sticky cell is owned by the collapsed
   grid and does not travel with it, so it paints at the row's original position
   and the header floats over the rows with nothing under it. */
const th = {
  padding: "0 8px 12px", fontSize: "14px", fontWeight: 600,
  letterSpacing: "0.03em", color: "var(--ink)", verticalAlign: "bottom",
  position: "sticky", top: 0, zIndex: 3,
  background: "var(--background)",
  boxShadow: "inset 0 -2px 0 var(--blue-raven)",
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
        {perfWord(sc.perf, ind, scale, rec?.v)}
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

/* What a column's glyphs are actually measured against.
   Worth stating on the header because it is the one number that explains every
   mark in the column, and until now it was only reachable by hovering an
   individual cell. */
function BenchmarkLine({ ind, scale, peers }) {
  if (!scale || scale.benchmark == null) return null;
  const isTarget = scale.benchmarkKind === "target";
  return (
    <div style={{ fontSize: "15px", color: "var(--ink-soft)", marginBottom: 8 }}>
      {isTarget ? "Target" : "Peer median"}{" "}
      <span className="tabular" style={{ fontWeight: 600, color: "var(--ink)" }}>
        {formatValue(scale.benchmark, ind)}
      </span>
      {!isTarget && (
        // Named, not "rows": the aggregate rows are on screen too and are
        // deliberately not in this count.
        <span style={{ color: "var(--warm-grey)" }}>
          {" "}· across {scale.n} {peers}
        </span>
      )}
    </div>
  );
}
