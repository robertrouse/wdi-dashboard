import { useId, useState } from "react";
import { formatValue } from "../lib/format.js";

/* --------------------------------------------------------------------------
   Sparkline.

   Where a sparkline has a reference, it is drawn as a dotted line and the trace
   is coloured by which side of it the row was on in each year. The reference
   and the colours are one decision, not two: the dotted line a reader sees has
   to be the line the colours are measured from, or the chart says something it
   does not mean.

   Which rows get one, and why the others do not:

     · rated metrics  the row's peer aggregate. A country is drawn against its
                      own region, a region against the World. Both are the
                      Bank's published subtotals, and both are TIME SERIES, so a
                      2016 reading is compared with the 2016 benchmark. A flat
                      line at the latest value would invent crossings that never
                      happened.
     · band metrics   the target band itself (inflation's 1-3%), as a shaded
                      strip. "Better" means inside it, so scoring inflation
                      against a regional average would answer a different
                      question.
     · totals         GDP, population, net migration: NO reference. Their
                      aggregate is a sum, so a country sits below it by
                      construction — one possible answer, and forcing that
                      figure into the vertical range flattened the country's own
                      decade to under a pixel in 205 of 212 cases.
     · no direction   urbanisation: NO reference. Nothing is better or worse, so
                      the colours would encode nothing while costing 100 of 217
                      countries most of their vertical range.

   Rows without a reference keep a self-scaled trace in the single performance
   colour they carried before this existed.

   Scaling: where there IS a reference the vertical extent covers the row's own
   values AND the reference, because a reference you cannot see is not a
   reference. The axis is still local to the row either way, so height is never
   comparable between rows — only shape, colour and the crossings are.
   -------------------------------------------------------------------------- */

const FAV_COLOR = {
  better: "var(--blue-maven)",
  worse: "var(--red-cerise)",
  neutral: "var(--warm-grey)",
};

/* Signed favourability of `v` against the reference: >0 good, <0 bad, null when
   the indicator has no favourable direction. Mirrors score() in kpi.js — the
   same inversion that makes falling under-5 mortality read as an improvement. */
function favAt(v, ref, ind) {
  if (!ind || v == null) return null;
  if (ind.direction === "band" && ind.targetBand) {
    const [lo, hi] = ind.targetBand;
    return Math.min(v - lo, hi - v);      // positive inside the band
  }
  if (ind.direction !== "up" && ind.direction !== "down") return null;   // "none": no favourable side
  if (ref == null) return null;
  return ind.direction === "down" ? ref - v : v - ref;
}

/** Reference value at an arbitrary year, linearly interpolated between points. */
function makeRefAt(refPoints) {
  if (!refPoints || refPoints.length === 0) return () => null;
  const s = [...refPoints].sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= s[0][0]) return s[0][1];
    if (x >= s[s.length - 1][0]) return s[s.length - 1][1];
    for (let i = 0; i < s.length - 1; i++) {
      const [x0, y0] = s[i], [x1, y1] = s[i + 1];
      if (x >= x0 && x <= x1) return x1 === x0 ? y0 : y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
    return null;
  };
}

/* Split the trace into single-colour runs. Sub-sampling each segment puts the
   colour change within ~1.5px of the true crossing, which is exact as far as
   the eye is concerned, and it handles the band case (two thresholds, so the
   sign can flip twice in one segment) without special-casing it. */
const SUB = 12;
function colourRuns(points, refAt, ind, hasReference) {
  // No reference to cross, so nothing to encode: keep the single performance
  // colour the row already carries, exactly as before this feature existed.
  if (!hasReference) return [{ cls: null, pts: points }];

  const samples = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [xa, ya] = points[i], [xb, yb] = points[i + 1];
    for (let s = 0; s < SUB; s++) {
      const t = s / SUB;
      samples.push([xa + (xb - xa) * t, ya + (yb - ya) * t]);
    }
  }
  samples.push(points[points.length - 1]);

  const runs = [];
  let cur = null;
  for (const [x, y] of samples) {
    const f = favAt(y, refAt(x), ind);
    const cls = f == null ? "neutral" : f > 0 ? "better" : f < 0 ? "worse" : "neutral";
    if (!cur || cur.cls !== cls) {
      if (cur) cur.pts.push([x, y]);          // share the boundary so the line stays unbroken
      cur = { cls, pts: [[x, y]] };
      runs.push(cur);
    } else {
      cur.pts.push([x, y]);
    }
  }
  return runs;
}

export default function Sparkline({
  points,
  reference = null,          // {kind:"series", points, label} | {kind:"band", band, label}
  ind = null,
  width = 168,
  height = 40,
  color = "var(--warm-grey)",
  showDots = false,
}) {
  const gid = useId();
  const [hover, setHover] = useState(null);

  if (!points || points.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
              stroke="var(--neutral-grey)" strokeWidth="1.5" strokeDasharray="2 4" />
      </svg>
    );
  }

  const pad = 5;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);

  const band = reference?.kind === "band" ? reference.band : null;
  const refPts = reference?.kind === "series" ? reference.points : null;
  const refAt = makeRefAt(refPts);

  // The reference has to be inside the drawn range or it is not visible.
  const refVals = band
    ? band
    : (refPts ?? []).filter(([x]) => x >= x0 && x <= x1).map(([, v]) => v);
  const domain = [...ys, ...refVals];
  const y0 = Math.min(...domain), y1 = Math.max(...domain);
  const spanX = x1 - x0 || 1;
  const spanY = y1 - y0 || Math.abs(y1) || 1;

  const sx = (x) => pad + ((x - x0) / spanX) * (width - pad * 2);
  const sy = (y) => height - pad - ((y - y0) / spanY) * (height - pad * 2);
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ");

  const runs = colourRuns(points, refAt, ind, !!(band || refPts));
  const lastRun = runs[runs.length - 1];
  const endColor = lastRun && lastRun.cls != null ? FAV_COLOR[lastRun.cls] : color;
  const area = `${path(points)} L${sx(x1).toFixed(1)},${height - pad} L${sx(x0).toFixed(1)},${height - pad} Z`;
  const last = points[points.length - 1];

  const refLine = refPts
    ? refPts.filter(([x]) => x >= x0 && x <= x1).sort((a, b) => a[0] - b[0])
    : null;

  // Hover: nearest year to the pointer. Fixed positioning so the readout is not
  // clipped by the matrix's horizontal scroll container.
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - r.left - pad) / (width - pad * 2)) * spanX + x0;
    let bi = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i][0] - rel) < Math.abs(points[bi][0] - rel)) bi = i;
    }
    setHover({ i: bi, left: r.left + sx(points[bi][0]), top: r.top });
  };

  const hp = hover ? points[hover.i] : null;

  /* Years with no reading. The trend window only carries years that HAVE a
     value, so a line drawn from 2015 to 2020 looks continuous while standing
     for a five-year hole — literacy and homicides are survey-based and full of
     them (150 of 2,946 trends here). The World Bank's own per-year footnotes
     are not in either data path we pull from, but a missing year is something
     the bundle can be asked directly, and it is the caveat that actually
     changes how the segment should be read. */
  const gapNote = (() => {
    if (!hp) return null;
    const i = hover.i;
    const spans = [];
    if (i > 0 && points[i][0] - points[i - 1][0] > 1) spans.push([points[i - 1][0] + 1, points[i][0] - 1]);
    if (i < points.length - 1 && points[i + 1][0] - points[i][0] > 1) spans.push([points[i][0] + 1, points[i + 1][0] - 1]);
    if (!spans.length) return null;
    const span = ([a, z]) => (a === z ? `${a}` : `${a}–${z}`);
    return `no reading ${spans.map(span).join(" or ")} — the line is drawn straight across`;
  })();
  const hRef = hp ? (band ? null : refAt(hp[0])) : null;
  const hFav = hp ? favAt(hp[1], hRef, ind) : null;
  const fmt = (v) => (ind ? formatValue(v, ind) : String(v));

  return (
    <>
      <svg
        width={width} height={height}
        role="img"
        aria-label={ind ? `${ind.label}, ${x0} to ${x1}` : "trend"}
        style={{ display: "block", overflow: "visible" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {band && (
          <>
            <rect x={pad} y={Math.min(sy(band[1]), sy(band[0]))}
                  width={width - pad * 2} height={Math.abs(sy(band[0]) - sy(band[1]))}
                  fill="var(--blue-maven)" opacity="0.10" />
            {band.map((b, i) => (
              <line key={i} x1={pad} y1={sy(b)} x2={width - pad} y2={sy(b)}
                    stroke="var(--blue-raven)" strokeWidth="1.25"
                    strokeDasharray="1 3" opacity="0.55" />
            ))}
          </>
        )}

        {refLine && refLine.length > 1 && (
          <path d={path(refLine)} fill="none" stroke="var(--blue-raven)"
                strokeWidth="1.5" strokeDasharray="1 3" opacity="0.6"
                strokeLinecap="round" />
        )}

        <path d={area} fill={`url(#${gid})`} />

        {runs.map((r, i) => (
          <path key={i} d={path(r.pts)} fill="none" stroke={r.cls == null ? color : FAV_COLOR[r.cls]}
                strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {showDots && points.map((p, i) => (
          <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="2.25" fill={color} opacity="0.55" />
        ))}

        {/* The latest reading, in the colour of the segment it ends. It used to
            be coloured by whether the last CHANGE was favourable, which put a
            second meaning on the same palette: a row sitting below its
            benchmark drew a cerise line finishing in a maven dot, and the two
            marks appeared to contradict each other. Direction of change is the
            Change column's job. */}
        <circle cx={sx(last[0])} cy={sy(last[1])} r="4"
                fill={endColor} stroke="var(--white)" strokeWidth="1.75" />

        {hp && (
          <>
            <line x1={sx(hp[0])} y1={pad - 3} x2={sx(hp[0])} y2={height - pad + 3}
                  stroke="var(--blue-raven)" strokeWidth="1" opacity="0.35" />
            <circle cx={sx(hp[0])} cy={sy(hp[1])} r="3.5"
                    fill="var(--white)" stroke="var(--blue-raven)" strokeWidth="2" />
          </>
        )}
      </svg>

      {hp && (
        <div
          role="tooltip"
          style={{
            position: "fixed", left: hover.left, top: hover.top - 12,
            transform: "translate(-50%,-100%)", zIndex: 60, pointerEvents: "none",
            background: "var(--white)", color: "var(--ink)",
            border: "1px solid var(--rule-strong)", borderRadius: "var(--radius)",
            boxShadow: "0 10px 30px rgba(10,16,68,.20)",
            padding: "9px 12px", whiteSpace: "nowrap", textAlign: "left",
          }}
        >
          <div style={{ fontSize: "15px", fontWeight: 600 }}>
            {hp[0]} · {fmt(hp[1])}
          </div>
          {band ? (
            <div style={{ fontSize: "14px", color: "var(--warm-grey)", marginTop: 2 }}>
              target {fmt(band[0])}–{fmt(band[1])} ·{" "}
              <span style={{ color: hFav > 0 ? "var(--blue-maven)" : "var(--red-cerise)", fontWeight: 600 }}>
                {hFav > 0 ? "in band" : "outside"}
              </span>
            </div>
          ) : hRef != null ? (
            <div style={{ fontSize: "14px", color: "var(--warm-grey)", marginTop: 2 }}>
              {reference.label} {fmt(hRef)}
              {hFav != null && (
                <>
                  {" · "}
                  <span style={{ color: hFav > 0 ? "var(--blue-maven)" : "var(--red-cerise)", fontWeight: 600 }}>
                    {hFav > 0 ? "better" : "worse"}
                  </span>
                </>
              )}
            </div>
          ) : null}
          {gapNote && (
            <div style={{ fontSize: "13.5px", color: "var(--blaze)", marginTop: 4,
                          maxWidth: 260, whiteSpace: "normal", lineHeight: 1.3 }}>
              {gapNote}
            </div>
          )}
        </div>
      )}
    </>
  );
}
