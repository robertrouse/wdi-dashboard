/* ==========================================================================
   The analytical core.

   The problem this dashboard exists to demonstrate: a reader needs to compare
   GDP (tens of trillions of dollars), inflation (a single-digit percent),
   under-5 mortality (a rate per 1,000) and population (billions) in one view.
   No shared axis can carry all four, and no reader can hold four mental scales
   at once.

   The resolution used here — and in the Big Book of Dashboards chapter this is
   modelled on — has four parts:

     1. POSITION IS NORMALIZED, LABELS ARE NATIVE.
        A value's *place* on screen comes from its rank within the visible peer
        set (0-1). The number printed beside it stays in its own units.

     2. FAVORABLE DIRECTION IS METADATA.
        Whether high is good is a property of the indicator, not something the
        reader should have to infer. Homicides down is good; life expectancy up
        is good; population has no direction at all and is drawn neutral.

     3. TARGETS, WHERE THEY EXIST, BEAT BENCHMARKS.
        Most development indicators have no target, so the peer median is the
        benchmark. Inflation does have one (a ~2% band), so it uses it. Both
        produce the same 0-1 score, so the same glyph reads either way.

     4. NO DATA IS A STATE, NOT A ZERO.
        Adult literacy is only measured in survey years. A missing value renders
        as an explicit "no data" mark, never as an empty or bottom-ranked cell.
   ========================================================================== */

export const PERF = {
  STRONG: "strong",  // comfortably better than benchmark
  MID:    "mid",     // near the benchmark
  WEAK:   "weak",    // comfortably worse
  NEUTRAL:"neutral", // indicator has no favorable direction
  NONE:   "none",    // no data
};

/** Percentile rank of v within a sorted numeric array, 0-1. */
function percentileRank(sorted, v) {
  if (!sorted.length) return 0.5;
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < v) lo = mid + 1; else hi = mid;
  }
  let hiIdx = lo;
  while (hiIdx < sorted.length && sorted[hiIdx] === v) hiIdx++;
  const mid = (lo + hiIdx) / 2;
  return sorted.length === 1 ? 0.5 : mid / (sorted.length - 1 || 1);
}

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Build per-indicator scales from the rows actually on screen.
 *
 * Two things follow from taking the *rows* rather than the underlying data:
 *
 *  - Scales are recomputed whenever the filter changes. "Above average" has to
 *    mean above the average of what the reader is looking at, or the
 *    comparison is a lie of omission.
 *
 *  - In region view the comparison set is the seven region medians, not the
 *    twenty-six countries behind them. Scoring a region median against a
 *    country-level distribution would push every region toward the middle and
 *    make the view look flatter than the world is.
 *
 * `rows` is anything with a `get(indicatorId)` method — country rows and
 * region roll-ups both qualify.
 */
export function buildScalesFromRows(rows, indicators) {
  const scales = {};
  for (const ind of indicators) {
    const vals = [];
    for (const row of rows) {
      const rec = row.get?.(ind.id);
      if (rec && rec.v != null) vals.push(rec.v);
    }
    const sorted = [...vals].sort((a, b) => a - b);
    scales[ind.id] = {
      sorted,
      n: sorted.length,
      min: sorted[0] ?? null,
      max: sorted.at(-1) ?? null,
      median: median(sorted),
      benchmark: ind.target != null ? ind.target : median(sorted),
      benchmarkKind: ind.target != null ? "target" : "peer median",
    };
  }
  return scales;
}

/**
 * Score one country/indicator to a 0-1 "goodness" plus a performance band.
 *
 * goodness 0.5 == at the benchmark. Above 0.5 is favorable regardless of
 * whether the underlying metric goes up or down to get there — that inversion
 * is the whole point.
 */
export function score(rec, ind, scale) {
  if (!rec || rec.v == null || !scale || !scale.n) {
    return { perf: PERF.NONE, goodness: null, deviation: 0, rank: null };
  }

  let goodness;
  if (ind.direction === "band" && ind.targetBand) {
    // Distance from an explicit target band, normalized by the band's own width.
    const [lo, hi] = ind.targetBand;
    const width = Math.max(hi - lo, 1e-9);
    const outside = rec.v < lo ? lo - rec.v : rec.v > hi ? rec.v - hi : 0;
    // Inside the band scores 1.0; outside, goodness decays from 0.5 with
    // distance measured in band-widths, so 2% and 3% both read as "on target"
    // while 9% and 40% are both clearly off it.
    goodness = outside === 0 ? 1 : 0.5 * Math.exp(-outside / (width * 2));
  } else {
    const p = percentileRank(scale.sorted, rec.v);
    goodness = ind.direction === "down" ? 1 - p : p;
  }

  const rank = ind.direction === "band" ? null : percentileRank(scale.sorted, rec.v);
  const deviation = (goodness - 0.5) * 2; // -1 … +1, signed distance from benchmark

  let perf;
  if (ind.direction === "none") perf = PERF.NEUTRAL;
  else if (goodness >= 0.62) perf = PERF.STRONG;
  else if (goodness >= 0.38) perf = PERF.MID;
  else perf = PERF.WEAK;

  return { perf, goodness, deviation, rank };
}

/**
 * Direction and favorability of the most recent change.
 * A rise in homicides and a rise in life expectancy are both "up"; only one is
 * good, and the arrow is coloured accordingly.
 */
export function delta(rec, ind) {
  if (!rec || rec.v == null || rec.p == null) {
    return { dir: 0, favorable: null, abs: null, pct: null, from: rec?.py ?? null };
  }
  const abs = rec.v - rec.p;
  const pct = rec.p === 0 ? null : (abs / Math.abs(rec.p)) * 100;
  const dir = abs > 0 ? 1 : abs < 0 ? -1 : 0;

  let favorable = null;
  if (ind.direction === "up") favorable = dir > 0 ? true : dir < 0 ? false : null;
  else if (ind.direction === "down") favorable = dir < 0 ? true : dir > 0 ? false : null;
  else if (ind.direction === "band" && ind.target != null) {
    // Moving toward the target is favorable, whichever side you start on.
    favorable = Math.abs(rec.v - ind.target) < Math.abs(rec.p - ind.target);
  }
  return { dir, favorable, abs, pct, from: rec.py };
}

/**
 * Region roll-up. Aggregating raw values across countries would be wrong for
 * most of these indicators (you cannot average percentages weighted by nothing,
 * and summing life expectancy is meaningless), so the region view reports the
 * MEDIAN of its member countries and says so in the tooltip.
 */
export function rollUpRegion(bundle, countryCodes, ind) {
  const cur = [], prev = [], byYear = new Map();
  let latestYear = null;

  for (const cc of countryCodes) {
    const rec = bundle.series[cc]?.[ind.id];
    if (!rec || rec.v == null) continue;
    cur.push(rec.v);
    if (rec.p != null) prev.push(rec.p);
    if (latestYear == null || rec.y > latestYear) latestYear = rec.y;
    for (const [y, v] of rec.t) {
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(v);
    }
  }
  if (!cur.length) return null;

  const t = [...byYear.entries()]
    .filter(([, vs]) => vs.length >= Math.max(2, countryCodes.length * 0.4))
    .sort((a, b) => a[0] - b[0])
    .map(([y, vs]) => [y, median(vs)]);

  return {
    y: latestYear,
    v: median(cur),
    p: prev.length ? median(prev) : null,
    py: null,
    t,
    n: cur.length,
    aggregated: true,
  };
}

/**
 * Least-squares slope over the sparkline window.
 *
 * Returned two ways because the useful phrasing depends on the metric:
 * `perYear` is the slope in the indicator's own units (right for anything
 * already a rate — "+0.4 pts per year"), `pctPerYear` is that slope as a share
 * of the window mean (right for levels — "+2.7% per year").
 */
export function trendSlope(rec) {
  if (!rec?.t || rec.t.length < 3) return null;
  const pts = rec.t;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  if (!den) return null;
  const perYear = num / den;
  return { perYear, pctPerYear: my ? (perYear / Math.abs(my)) * 100 : null };
}
