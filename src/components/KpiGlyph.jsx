import { PERF } from "../lib/kpi.js";

/* --------------------------------------------------------------------------
   The performance glyph.

   A circle whose filled portion sits above or below the horizontal midline.
   Fill above the line = better than the benchmark; below = worse. How much of
   the circle is filled encodes how far from the benchmark, on the normalized
   0-1 scale — so a $29T GDP and a 2.1% inflation rate produce glyphs that can
   be compared directly, which raw numbers never could.

   Colour carries the same information redundantly (never colour alone), and
   the midline itself is drawn so "at the benchmark" is legible as a state
   rather than as an absence.
   -------------------------------------------------------------------------- */

const FILL = {
  [PERF.STRONG]:  "var(--blue-maven)",
  [PERF.MID]:     "var(--blaze)",
  [PERF.WEAK]:    "var(--red-cerise)",
  [PERF.NEUTRAL]: "var(--warm-grey)",
  [PERF.NONE]:    "transparent",
};

export default function KpiGlyph({ perf, deviation = 0, size = 30, title }) {
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;

  if (perf === PERF.NONE) {
    return (
      <svg width={size} height={size} role="img" aria-label={title || "no data"}>
        {title && <title>{title}</title>}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--neutral-grey)" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={size * 0.36} fontWeight="500" fill="var(--warm-grey)">NA</text>
      </svg>
    );
  }

  // Neutral indicators (population, urbanisation) get a plain dot: there is no
  // "good" direction to encode, and pretending otherwise would mislead.
  if (perf === PERF.NEUTRAL) {
    return (
      <svg width={size} height={size} role="img" aria-label={title || "no target"}>
        {title && <title>{title}</title>}
        <circle cx={cx} cy={cy} r={r} fill="var(--cool-grey)" stroke="var(--warm-grey)" strokeWidth="1.25" />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="var(--warm-grey)" strokeWidth="1.25" />
      </svg>
    );
  }

  const mag = Math.min(1, Math.abs(deviation));
  const h = mag * r;                       // height of the filled segment
  const above = deviation >= 0;
  const clipId = `clip-${perf}-${Math.round(deviation * 1000)}-${size}`;

  return (
    <svg width={size} height={size} role="img" aria-label={title || perf}>
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={above ? cy - h : cy} width={size} height={h} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="var(--white)" stroke={FILL[perf]} strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r} fill={FILL[perf]} clipPath={`url(#${clipId})`} />
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={FILL[perf]} strokeWidth="1.5" opacity="0.85" />
    </svg>
  );
}
