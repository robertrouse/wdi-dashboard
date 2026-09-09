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

     3. EVERY ROW IS MEASURED AGAINST A PUBLISHED AGGREGATE.
        A country is read against its own region's subtotal, a region against
        the World. Where an explicit target exists it wins — inflation has one
        (a ~2% band) and uses it. A peer median of the visible rows is the last
        resort, kept only for the metrics where no aggregate can serve as a
        benchmark: the additive ones, where a country sits below its region by
        construction. All three produce the same 0-1 score, so the same glyph
        reads whichever governs.

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
  // (below + tied/2) / n — the standard mid-rank definition, bounded (0,1).
  // This used to divide by n-1, which let the largest value score above 1.0
  // (7.5/7 = 1.07 in an eight-item set). Nothing caught it because the glyph
  // clamped the overflow away; now that fill position carries magnitude rather
  // than a verdict, an out-of-range rank is a wrong mark, not a wasted one.
  const mid = (lo + hiIdx) / 2;
  return sorted.length === 1 ? 0.5 : mid / sorted.length;
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
 *  - The peer-median scales are recomputed whenever the filter changes. Where
 *    one is still the benchmark, "above average" has to mean above the average
 *    of what the reader is looking at, or the comparison is a lie of omission.
 *    The region-gap spread does NOT move with the filter — see
 *    regionGapSpreads for why that asymmetry is deliberate.
 *
 *  - In region view the comparison set is the seven official regional
 *    aggregates, not the couple of hundred countries behind them. Scoring a
 *    regional aggregate against a country-level distribution would push every
 *    region toward the middle and make the view look flatter than the world is.
 *
 * `rows` is anything with a `get(indicatorId)` method — country rows and
 * region roll-ups both qualify.
 */
export function buildScalesFromRows(rows, indicators, bundle) {
  const scales = {};
  const gaps = regionGapSpreads(bundle, indicators);
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
      /* How big a gap from a country's own region counts as a big gap, for
         this metric. Fixed — see regionGapSpreads. */
      regionGap: gaps[ind.id] ?? null,
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
/**
 * Score one row/metric into two INDEPENDENT channels.
 *
 *   deviation  -1…+1  WHERE the value sits relative to the benchmark.
 *                     Positive means higher, full stop. Not "better".
 *   perf              WHETHER that is good, via `goodness`.
 *
 * These used to be the same number, and fill position was just colour drawn
 * again: a country with high homicides filled DOWNWARD because high homicides
 * are bad. That is a defensible convention and it costs the reader the one
 * thing the mark is best at showing — magnitude. A reader scanning the
 * homicide column could not see which countries had a lot of homicides, only
 * which ones were doing badly, and had to already know the direction of the
 * metric to translate back.
 *
 * Now the fill answers "higher or lower than the benchmark, and by how much"
 * for every metric alike, and colour carries the verdict on top of it. High
 * homicides fill upward, in cerise: a lot, and that is bad.
 *
 * The cost is real and worth stating: the two channels were previously
 * redundant, so the verdict survived colour-blindness through position alone.
 * It no longer does. Colour is now the only channel carrying "good or bad",
 * which is why every column header names its direction and the legend leads
 * with a high-and-bad example rather than a low-and-bad one.
 */
export function score(rec, ind, scale) {
  if (!rec || rec.v == null || !scale || !scale.n) {
    return { perf: PERF.NONE, goodness: null, deviation: 0, rank: null };
  }

  let goodness, deviation;
  if (ind.direction === "band" && ind.targetBand) {
    // Distance from an explicit target band, normalized by the band's own width.
    const [lo, hi] = ind.targetBand;
    const width = Math.max(hi - lo, 1e-9);
    const outside = rec.v < lo ? lo - rec.v : rec.v > hi ? rec.v - hi : 0;
    // Inside the band scores 1.0; outside, goodness decays from 0.5 with
    // distance measured in band-widths, so 2% and 3% both read as "on target"
    // while 9% and 40% are both clearly off it.
    goodness = outside === 0 ? 1 : 0.5 * Math.exp(-outside / (width * 2));
    // Position is signed distance from the TARGET, so the band's two failure
    // modes stop looking identical: 40% inflation fills upward and 0.1% fills
    // downward, both cerise. Under the old scheme both were simply "low
    // goodness" and drew the same glyph, which was the one place the mark
    // actively hid something the reader needed.
    const target = ind.target ?? (lo + hi) / 2;
    deviation = Math.tanh((rec.v - target) / (width * 2));
  } else {
    const p = percentileRank(scale.sorted, rec.v);
    goodness = ind.direction === "down" ? 1 - p : p;
    deviation = (p - 0.5) * 2;          // higher value ⇒ fill above, always
  }

  let perf;
  if (ind.direction === "none") perf = PERF.NEUTRAL;
  else if (goodness >= 0.62) perf = PERF.STRONG;
  else if (goodness >= 0.38) perf = PERF.MID;
  else perf = PERF.WEAK;

  const rank = ind.direction === "band" ? null : percentileRank(scale.sorted, rec.v);
  return { perf, goodness, deviation, rank };
}

/**
 * Direction and favorability of the most recent change.
 * A rise in homicides and a rise in life expectancy are both "up"; only one is
 * good, and the arrow is coloured accordingly.
 */
export function delta(rec, ind) {
  if (!rec || rec.v == null || rec.p == null) {
    return { dir: 0, favorable: null, abs: null, pct: null, v: rec?.v ?? null, p: rec?.p ?? null, from: rec?.py ?? null };
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
  // v and p ride along so a formatter can tell whether the baseline is a sane
  // denominator for a percent change (see DeltaArrow).
  return { dir, favorable, abs, pct, v: rec.v, p: rec.p, from: rec.py };
}

/* --------------------------------------------------------------------------
   What a row is measured against.

   A regional subtotal is not a big country, and scoring it as one produced
   verdicts that were decided before the data was consulted. Against a set of
   selected countries, six of seven regions read "strong" on GDP — a regional
   total nearly always exceeds any single member of it, so the glyph was
   restating arithmetic. On under-5 mortality against a G20 set, six of seven
   read "weak" for the mirror-image reason. Neither was a finding.

   Regional subtotals are therefore measured against the WORLD aggregate, which
   is the only peer a region has, and a country against its own region. That
   also makes the glyph and the sparkline agree, which is the whole reason the
   two functions share a rule: referenceFor() already draws those exact lines,
   and a row whose two marks are measured from different places is lying to at
   least one reader. Countries were doing precisely that until 2026-09-09 — the
   hover card scored them against the median of the visible selection while the
   sparkline under it was drawn against the region.

   The exclusions mirror referenceFor() exactly, and for the same reasons:

     · totals        GDP, population, net migration. Every region is below the
                     world total by construction, so a better/worse verdict is
                     arithmetic, not information. No verdict; the hover states
                     the region's SHARE of the world total instead, which is the
                     real quantity.
     · no direction  urbanisation. Nothing is better, so nothing is claimed.
     · band metrics  inflation keeps its target band — a target beats a peer,
                     and it applies to regions exactly as it does to countries.
     · the World     has nothing above it, so it carries no verdict at all.

   K is the relative difference that reads as "clearly" better or worse. At 0.30
   the middle band is about ±7% of the world figure, which across the real data
   leaves a genuine spread (31 strong / 14 near / 25 weak over 70 region-metric
   pairs) rather than the near-binary split a tighter constant produces.
   -------------------------------------------------------------------------- */

const WORLD_SPREAD = 0.30;

/* How many "typical gaps" from your own region reads as clearly better or
   worse. At 2.0 the middle band is roughly ±0.6 of a typical gap, which across
   the real data splits 43% strong / 28% near / 29% weak — a genuine middle,
   where a tighter constant makes the column almost binary. */
const REGION_SPREAD = 2.0;

/**
 * Per-indicator: how far a country typically sits from its own region.
 *
 * A single constant cannot serve this. Country-to-region gaps run ±12% on life
 * expectancy and −83% to +440% on GDP per capita; one threshold would call
 * every country average on the first and extreme on the second. So the scale
 * comes from the metric's own data: the MEDIAN ABSOLUTE relative gap between a
 * country and its region's published subtotal, over every country the Bank
 * publishes. Robust to the outliers that make these distributions unusable —
 * Monaco's GDP per capita is 15x its region and would otherwise set the ruler
 * for all of Europe.
 *
 * Computed from the WHOLE bundle, not the visible rows, and that is deliberate.
 * The benchmark a country is judged against is now its region, which does not
 * move when the reader filters. If the sensitivity moved instead, the same
 * country against the same region would change colour because an unrelated
 * country was added to the table — the filtering bug in a new place.
 */
export function regionGapSpreads(bundle, indicators) {
  const out = {};
  if (!bundle?.countries) return out;
  for (const ind of indicators) {
    if (ind.aggKind === "total") continue;
    if (ind.direction !== "up" && ind.direction !== "down") continue;
    const abs = [];
    for (const c of bundle.countries) {
      const rec = bundle.series?.[c.c]?.[ind.id];
      if (!rec || rec.v == null) continue;
      const code = bundle.regionCodes?.[c.r];
      const rr = code ? bundle.regionSeries?.[code]?.[ind.id] : null;
      if (!rr || rr.v == null || rr.v === 0) continue;
      abs.push(Math.abs((rec.v - rr.v) / Math.abs(rr.v)));
    }
    const m = median(abs);
    if (m != null && m > 0) out[ind.id] = m;
  }
  return out;
}

/** Rows that carry a published subtotal rather than a single economy. */
export function isAggregateRow(row) {
  return row?.kind === "region" || row?.kind === "aggregate" || row?.kind === "world";
}

/**
 * What this row's glyph is measured against.
 * `kind` is "target" | "world" | "peer" | "none"; `value` is the number itself.
 */
export function benchmarkFor(bundle, row, ind, scale) {
  if (ind.direction === "band" && ind.targetBand) {
    return { kind: "target", value: ind.target, label: "target" };
  }
  if (isAggregateRow(row)) {
    const noVerdict = { kind: "none", value: null, label: "" };
    if (row.kind === "world") return noVerdict;              // nothing sits above it
    if (ind.aggKind === "total") return noVerdict;           // a share, not a verdict
    if (ind.direction !== "up" && ind.direction !== "down") return noVerdict;
    const w = worldRecord(bundle, ind);
    return w ? { kind: "world", value: w.v, label: "World" } : noVerdict;
  }
  /* A COUNTRY is measured against its own region's published subtotal.

     It used to be measured against the median of whatever countries happened
     to be on screen, and that was wrong in a way the dashboard was already
     admitting elsewhere: referenceFor() draws the regional aggregate as the
     sparkline's dotted line, so the hover card said "clearly better than the
     peer median, 5.7 per 1,000" directly above a chart measuring the same
     country against 13.2. Two marks in one card, measured from two different
     places. The region is the right one — it is a published figure, it does
     not move when the reader filters, and "how does Korea compare with East
     Asia & Pacific" is a question with an answer.

     The exclusions mirror referenceFor() exactly, and for the same reasons: a
     TOTAL is not a benchmark (a country is below its region's GDP by
     construction), and a metric with no favourable direction has no verdict to
     give. Those keep the peer median, which is the honest reading left. */
  const peer = {
    kind: "peer",
    value: scale?.benchmark ?? null,
    label: scale?.benchmarkKind ?? "peer median",
  };
  if (ind.aggKind === "total") return peer;
  if (ind.direction !== "up" && ind.direction !== "down") return peer;

  const rec = row.region == null ? null : regionRecord(bundle, row.region, ind);
  if (rec) {
    return { kind: "region", value: rec.v, label: bundle.regions[row.region]?.trim() ?? "its region" };
  }
  // Every country/metric pair in the current bundle has a regional subtotal, so
  // this is a guard rather than a path. If one ever goes missing, step up to the
  // World rather than down to the peer median: it is still one of the Bank's own
  // aggregates, so the column keeps a single kind of number in it.
  const w = worldRecord(bundle, ind);
  return w ? { kind: "world", value: w.v, label: "World" } : peer;
}

/** Score a row against whatever benchmarkFor() says governs it. */
export function scoreRow(rec, ind, scale, bm) {
  if (!rec || rec.v == null) return { perf: PERF.NONE, goodness: null, deviation: 0, rank: null };
  if (!bm || bm.kind === "none") return { perf: PERF.NEUTRAL, goodness: null, deviation: 0, rank: null };

  if (bm.kind === "world" || bm.kind === "region") {
    if (bm.value == null || bm.value === 0) {
      return { perf: PERF.NONE, goodness: null, deviation: 0, rank: null };
    }
    /* Same shape either way — relative difference from a published aggregate,
       squashed by however much of a difference counts as a lot. What differs is
       the ruler: a region against the World gets a flat constant, because seven
       regional subtotals of the same metric are already on comparable ground. A
       country against its region does not, because the spread of that gap is a
       property of the metric (±12% on life expectancy, −83% to +440% on GDP per
       capita), so it comes from the metric's own distribution. */
    const spread = bm.kind === "region"
      ? (scale?.regionGap ?? 0.30) * REGION_SPREAD
      : WORLD_SPREAD;
    const rel = (rec.v - bm.value) / Math.abs(bm.value);
    const signed = ind.direction === "down" ? -rel : rel;
    const goodness = 0.5 + 0.5 * Math.tanh(signed / spread);
    const perf = goodness >= 0.62 ? PERF.STRONG : goodness >= 0.38 ? PERF.MID : PERF.WEAK;
    // Fill follows the raw comparison, not the verdict — see score() above.
    const deviation = Math.tanh(rel / spread);
    return { perf, goodness, deviation, rank: null };
  }

  return score(rec, ind, scale);   // peer median, or an explicit target band
}

/** A region's share of the world total — the honest reading for summed metrics. */
export function shareOfWorld(bundle, rec, ind) {
  if (ind.aggKind !== "total" || !rec || rec.v == null) return null;
  const w = worldRecord(bundle, ind);
  if (!w || !w.v) return null;
  return rec.v / w.v;
}

/**
 * The region's benchmark: the World Bank's own published subtotal.
 *
 * This used to be a median of whichever member countries were on screen. It is
 * not any more, and the reason matters. Every one of these indicators has a
 * correct way to aggregate and they are not the same way — population is a sum,
 * life expectancy is a population-weighted average, inflation is a median,
 * homicides are aggregated by UNODC under its own method. A single roll-up rule
 * cannot be right for all fifteen, and a median of member countries is right for
 * almost none of them: it weights Tuvalu and China equally, so "Sub-Saharan
 * Africa's GDP" came out as the GDP of its middle-ranked economy.
 *
 * The Bank already publishes each of these, aggregated the way that indicator
 * should be aggregated. `data/regions.json` maps a region to the code of its
 * official aggregate; the build scripts carry those series into `regionSeries`.
 * `ind.aggregation` records which method was used, and the UI shows it — the
 * fact that the method changes per metric is part of the lesson, not a detail
 * to hide.
 *
 * Two consequences worth being explicit about:
 *
 *  - The value is FIXED. It covers every economy the Bank counts in that
 *    region, so it does not move when the reader filters the country list.
 *    Filtering decides which region rows appear, never what they say.
 *
 *  - There is no fallback. If a region has no published subtotal for an
 *    indicator, it reads NA. Quietly swapping in a differently-computed number
 *    would put two incompatible statistics in one column, which is exactly the
 *    error this dashboard exists to teach people to avoid.
 */
export function regionRecord(bundle, regionIdx, ind) {
  const code = bundle.regionCodes?.[regionIdx];
  if (!code) return null;
  const rec = bundle.regionSeries?.[code]?.[ind.id];
  if (!rec || rec.v == null) return null;
  return { ...rec, aggregated: true, aggCode: code };
}

/** The World aggregate — same source, one level up from a region. */
export function worldRecord(bundle, ind) {
  const rec = bundle.worldSeries?.[ind.id];
  if (!rec || rec.v == null) return null;
  return { ...rec, aggregated: true, aggCode: "WLD" };
}

/**
 * What a row's sparkline is drawn against, and therefore what its colours mean.
 *
 * The reference and the colouring are one decision, not two: the dotted line a
 * reader sees has to be the line the colours are measured from, or the chart
 * says something it does not mean.
 *
 *   band metrics  -> the target band. "Better" is inside it, so scoring
 *                    inflation against a regional average would answer a
 *                    question nobody asked.
 *   region rows   -> the World aggregate.
 *   country rows  -> that country's own region aggregate.
 *
 * Returns the full trend, not a single latest value: comparing a 2016 reading
 * against a 2025 benchmark would manufacture crossings that never happened.
 */
export function referenceFor(bundle, row, ind) {
  if (ind.direction === "band" && ind.targetBand) {
    return { kind: "band", band: ind.targetBand, label: "target" };
  }

  // A TOTAL is not a benchmark. GDP, population and net migration aggregate by
  // summing their members, so a country sits below its region's figure by
  // construction and the comparison has exactly one possible answer. Worse, the
  // aggregate is so much larger that forcing it into the vertical range flattens
  // the country's own decade to under a pixel — measured at 205 of 212 countries
  // for GDP. Those rows keep a self-scaled trace and their overall performance
  // colour. Only aggregates that express a typical LEVEL can be compared to.
  if (ind.aggKind === "total") return null;

  // No favourable direction, nothing for the colour to say. Urbanisation is the
  // only one left in this case, and a context line there costs 100 of 217
  // countries most of their vertical range to encode nothing. The reference is
  // drawn exactly where it can be compared against, and nowhere else.
  if (ind.direction !== "up" && ind.direction !== "down") return null;

  // Nothing sits above the World, so its own row has no reference.
  if (row.kind === "world") return null;

  // Region-level rows — the seven rows of region view, and the aggregate row
  // that closes each section of country view — are read against the World.
  if (row.kind === "region" || row.kind === "aggregate") {
    const rec = worldRecord(bundle, ind);
    return rec ? { kind: "series", points: rec.t, label: "World" } : null;
  }
  const rec = row.region == null ? null : regionRecord(bundle, row.region, ind);
  if (!rec) return null;
  return { kind: "series", points: rec.t, label: bundle.regions[row.region]?.trim() ?? "Region" };
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
