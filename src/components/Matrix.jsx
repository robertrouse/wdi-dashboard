import { Fragment } from "react";
import KpiGlyph from "./KpiGlyph.jsx";
import Value from "./Value.jsx";
import Sparkline from "./Sparkline.jsx";
import DeltaArrow from "./DeltaArrow.jsx";
import Tooltip, { IndicatorCard } from "./Tooltip.jsx";
import { formatValue, unitGap } from "../lib/format.js";
import { delta, referenceFor, benchmarkFor, scoreRow, shareOfWorld, PERF } from "../lib/kpi.js";

/* --------------------------------------------------------------------------
   The main view: countries (or regions) down the side, metrics across the top.

   Reading order is deliberate. The eye lands on the focus metric block —
   value, change, trend — which answers "how is this one doing?" in native
   units. The glyph matrix to its right answers "and everything else?" in a
   single normalized visual language. Neither could do the other's job.
   -------------------------------------------------------------------------- */

/* The focus glyph and the gap beside it. Named because the year line has to
   reserve exactly this much on its right to stay under the number. */
const GLYPH_SIZE = 28;
const GLYPH_GAP = 9;

/* Number and year form one block, and that BLOCK is what sits centred in the
   row — equal air above and below it. Centring the number's own line instead
   and letting the year hang beneath was measurably precise and looked wrong:
   the caption is part of the thing, so leaving it out of the balance tipped
   the cell.

   The gap between them is tight on purpose. Kanit's line box for a 22px figure
   is 33px, eleven of those below the digits, so most of what read as a gap was
   the number's own leading rather than any margin. */
const YEAR_SIZE = 13;
const YEAR_LEAD = 1.05;   // half of a 1.2 leading sat above the digits
const YEAR_GAP = -3;      // closes the slack under the number's line box

/* The value's own line box, mirrored by the Change column so the two figures
   share a baseline and their captions share another. Must track --t-value and
   Value's default lineHeight. */
const VALUE_SIZE = 22;
const VALUE_LEAD = 1.1;
const VALUE_LINE = VALUE_SIZE * VALUE_LEAD;

const PERF_COLOR = {
  [PERF.STRONG]: "var(--blue-maven)",
  [PERF.MID]: "var(--blaze)",
  [PERF.WEAK]: "var(--red-cerise)",
  [PERF.NEUTRAL]: "var(--warm-grey)",
  [PERF.NONE]: "var(--neutral-grey)",
};

function perfWord(perf, ind, bm, value, { share, isWorld } = {}) {
  if (perf === PERF.NONE) return "No recent data";
  if (perf === PERF.NEUTRAL) {
    if (share != null) return `${(share * 100).toFixed(1)}% of the world total — a share, not a verdict`;
    // The World has a favourable direction like anything else; what it does not
    // have is anything above it to be measured against.
    if (isWorld) return "The benchmark itself — nothing sits above it";
    return "No favorable direction — shown for context";
  }

  /* A band metric is off target on BOTH sides, so 0.1% and 3.2% inflation score
     the same and draw the same cerise glyph. That is correct — deflation and
     overheating are both misses — but "clearly worse than the target" alone
     leaves the reader to work out which way, and two rows moving in opposite
     directions both turning red looks like a bug until you do. Name the side. */
  if (ind.direction === "band" && ind.targetBand && value != null) {
    const [lo, hi] = ind.targetBand;
    const band = `${lo}–${hi}${ind.suffix ? unitGap(ind.suffix) + ind.suffix : ""}`;
    if (value >= lo && value <= hi) return `On target · within ${band}`;
    return value < lo ? `Below the ${band} target band` : `Above the ${band} target band`;
  }

  const against = bm?.kind === "world" ? "the World"
                : bm?.kind === "target" ? "the target"
                : "the peer median";
  return perf === PERF.STRONG ? `Clearly better than ${against}`
       : perf === PERF.MID ? `Close to ${against}`
       : `Clearly worse than ${against}`;
}

export default function Matrix({
  rows, indicators, focus, scales, bundle, onSelectRow, selectedRow, onFocusMetric,
}) {
  const glyphInds = indicators;
  const regionView = rows.some((r) => r.kind === "region");

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
            <th style={{ ...th, textAlign: "right", minWidth: 178 }}>
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
                        extra={!isFocus && (
                          <div style={{ fontSize: "14.5px", fontWeight: 500, color: "var(--blue-maven)", marginBottom: 6 }}>
                            Click to make this the focus metric
                          </div>
                        )}
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
            const bmFocus = benchmarkFor(bundle, row, focus, scales[focus.id]);
            const sc = scoreRow(rec, focus, scales[focus.id], bmFocus);
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
                        ind={focus} row={row} rec={rec} sc={sc} bm={bmFocus}
                        scale={scales[focus.id]} bundle={bundle}
                      />
                    }
                  >
                  {/* Number at value size, unit one step down, the pair kept on
                      a single line. "110.7 per 1,000" set entirely at 22px is
                      ~170px of text and wrapped inside a 138px column, which
                      broke the number away from its unit — the one thing this
                      column exists to keep together. */}
                  {/* The year belongs under the NUMBER, not under the glyph.
                      With the two stacked in their own block the glyph can be
                      centred against them, so its centreline and the number's
                      sit on the same axis instead of the glyph riding high
                      above a caption that was never about it. Same arrangement
                      the detail modal already uses. */}
                  {/* The glyph sits on the NUMBER's line, not on the number
                      plus its year — centring it on the whole stack pushed it
                      below the figure it belongs to. The year then needs the
                      glyph's own width out of its right margin to stay under
                      the number rather than under the circle. */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end",
                                gap: GLYPH_GAP, whiteSpace: "nowrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <Value v={rec?.v} ind={focus} />
                      {rec && (
                        <div style={{ fontSize: `${YEAR_SIZE}px`, lineHeight: YEAR_LEAD,
                                      marginTop: YEAR_GAP,
                                      color: stale ? "var(--blaze)" : "var(--warm-grey)" }}>
                          {rec.y}{stale ? " · older reading" : ""}
                        </div>
                      )}
                    </div>
                    <KpiGlyph perf={sc.perf} deviation={sc.deviation} size={GLYPH_SIZE} />
                  </div>
                  </Tooltip>
                </td>

                <td style={{ ...td, textAlign: "right" }}>
                  {/* Built to the same block as the value cell so the two read
                      as one line: the figure sits in a band the height of the
                      glyph, and its "vs" caption gets the year's own size,
                      leading and negative gap. Both blocks then come out the
                      same height, so centring each in its row leaves the
                      figures on one axis and the captions on another. */}
                  <div>
                    {/* A line box, not a flex band. Centring the delta inside a
                        fixed-height flex row aligned its BOX to the band's
                        middle, which left its baseline 1.5px off the value's;
                        an ordinary line box with the same leading seats both
                        figures on the same baseline instead. */}
                    <div style={{ lineHeight: VALUE_LEAD, fontSize: `${VALUE_SIZE}px` }}>
                      <DeltaArrow d={dl} ind={focus} />
                    </div>
                    {dl.from && (
                      <div style={{ fontSize: `${YEAR_SIZE}px`, lineHeight: YEAR_LEAD,
                                    marginTop: YEAR_GAP, color: "var(--warm-grey)" }}>
                        vs {dl.from}
                      </div>
                    )}
                  </div>
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
                  const bm2 = benchmarkFor(bundle, row, ind, scales[ind.id]);
                  const s2 = scoreRow(r2, ind, scales[ind.id], bm2);
                  return (
                    <td key={ind.id} style={{ ...td, textAlign: "center", padding: "9px 3px",
                                              borderLeft: startsGroup(gi) ? GROUP_RULE : undefined }}>
                      <Tooltip
                        width={300}
                        content={
                          <RowMetricCard
                            ind={ind} row={row} rec={r2} sc={s2} bm={bm2}
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
function RowMetricCard({ ind, row, rec, sc, bm, scale, bundle }) {
  const dl = delta(rec, ind);
  const t = rec?.t ?? [];
  const share = shareOfWorld(bundle, rec, ind);
  const reference = referenceFor(bundle, row, ind);
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 2 }}>{ind.label}</div>
      <div style={{ fontSize: "17px", fontWeight: 600, lineHeight: 1.2 }}>{row.label}</div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 7 }}>
        <Value v={rec?.v} ind={ind} size="23px" />
        <span style={{ fontSize: "14px", color: "var(--warm-grey)" }}>
          {rec ? rec.y : "no recent reading"}
        </span>
      </div>

      <div style={{ fontSize: "14.5px", marginTop: 3, color: PERF_COLOR[sc.perf] }}>
        {perfWord(sc.perf, ind, bm, rec?.v, { share, isWorld: row.kind === "world" })}
        {bm?.value != null && sc.perf !== PERF.NONE && (
          <span style={{ color: "var(--warm-grey)" }}>
            {" · "}{bm.label} {formatValue(bm.value, ind)}
          </span>
        )}
      </div>

      {t.length > 1 && (
        <div style={{ marginTop: 11, paddingTop: 11, borderTop: "1px solid var(--rule)" }}>
          <Sparkline
            points={t}
            reference={reference}
            ind={ind}
            width={264} height={54} showDots
            color={PERF_COLOR[sc.perf]}
          />
          <div style={{ fontSize: "13px", color: "var(--warm-grey)", marginTop: 3 }}>
            {t[0][0]}–{t[t.length - 1][0]}
            {reference?.kind === "series"
              ? ` · dotted line: ${reference.label}`
              : reference?.kind === "band"
              ? " · shaded strip: the target band"
              : ""}
          </div>
        </div>
      )}
    </div>
  );
}

