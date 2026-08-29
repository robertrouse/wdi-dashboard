/* ==========================================================================
   Value formatting.

   Every indicator carries prefix / suffix / decimals / scale in the glossary
   (data/indicators.json), so formatting is data-driven rather than special-
   cased per metric. This is the same idea as the Tableau glossary sheet:
   one row of metadata per indicator, no per-metric logic anywhere else.
   ========================================================================== */

const UNITS = [
  { at: 1e12, sfx: "T" },
  { at: 1e9,  sfx: "B" },
  { at: 1e6,  sfx: "M" },
  { at: 1e3,  sfx: "K" },
];

/** 29184890000000 -> "29.2T"   (used for GDP, population, migration) */
export function compact(n, decimals = 1) {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  for (const { at, sfx } of UNITS) {
    if (a >= at) {
      const scaled = a / at;
      // Keep three significant figures rather than three decimals: 1.05T and
      // 987B should read at the same visual weight.
      const d = scaled >= 100 ? 0 : scaled >= 10 ? 1 : decimals;
      return `${sign}${scaled.toFixed(d)}${sfx}`;
    }
  }
  return `${sign}${a.toFixed(a < 10 ? decimals : 0)}`;
}

export function plain(n, decimals = 1) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * At most `sig` significant digits, with no trailing zeros.
 *
 * Used for the metrics already expressed as a percentage. A percentage is
 * bounded at 100, so a fixed decimal count spends its precision at exactly the
 * wrong end: "99.8%" and "96.1%" claim a tenth of a point that no survey
 * supports and no reader uses, while "3.2%" genuinely needs its decimal.
 * Significant digits scale with the number instead — 3.2, 32, 100.
 *
 *   3.24 -> "3.2"   96.13 -> "96"   0.14 -> "0.14"   219.9 -> "220"
 *
 * This rounds 99.8 up to 100, which is intended and is also the one case worth
 * thinking twice about: on access to electricity it turns "nearly everyone"
 * into "everyone", and that gap is real people.
 */
export function significant(n, sig = 2) {
  if (!Number.isFinite(n) || n === 0) return "0";
  const mag = Math.floor(Math.log10(Math.abs(n)));
  const factor = 10 ** (sig - 1 - mag);
  const rounded = Math.round(n * factor) / factor;
  // Decimals come from the ROUNDED magnitude: rounding 99.8 to 100 moves it up
  // an order, and asking for a decimal there would print "100.0".
  const rmag = rounded === 0 ? 0 : Math.floor(Math.log10(Math.abs(rounded)));
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(0, sig - 1 - rmag),
  });
}

/**
 * What separates a number from its unit.
 *
 * The percent sign binds directly to the digits — "3.2%", not "3.2 %". It is a
 * symbol rather than a word, US convention sets it closed up, and it is the
 * same reason it is set at the number's own size: "3.2%" is one token. Word
 * units ("yrs", "per 1,000", "t CO2e") are separate words and take a thin
 * space, which keeps them attached without crowding the figure.
 */
export const unitGap = (suffix) => (suffix === "%" ? "" : "\u2009");

/** Percentages get significant digits; everything else keeps its own precision. */
function numberBody(v, ind, compactAlways = false) {
  if (ind.scale === "compact" || compactAlways) return compact(v, ind.decimals);
  if (ind.suffix === "%") return significant(v, 2);
  return plain(v, ind.decimals);
}

/** The one entry point the UI uses. `ind` is an indicators.json record. */
export function formatValue(v, ind, { compactAlways = false } = {}) {
  if (v == null || Number.isNaN(v)) return "—";
  const body = numberBody(v, ind, compactAlways);
  return `${ind.prefix ?? ""}${body}${ind.suffix ? unitGap(ind.suffix) + ind.suffix : ""}`;
}

/** Percent change, formatted for the delta column. Returns null when undefined. */
export function formatDelta(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const mag = Math.abs(pct);
  const digits = mag >= 100 ? 0 : mag >= 10 ? 1 : mag >= 1 ? 1 : 2;
  return `${pct >= 0 ? "+" : "−"}${mag.toFixed(digits)}%`;
}

/** For indicators already expressed as a rate, points are clearer than percent-of-percent. */
export function formatDeltaPoints(cur, prev, ind) {
  if (cur == null || prev == null) return null;
  const d = cur - prev;
  const mag = Math.abs(d);
  const digits = mag >= 10 ? 1 : ind.decimals;
  return `${d >= 0 ? "+" : "−"}${mag.toFixed(digits)}${ind.suffix === "%" ? " pts" : ""}`;
}

/** Same as formatValue but split, so a layout can set the unit smaller. */
export function splitValue(v, ind) {
  if (v == null || Number.isNaN(v)) return { num: "\u2014", unit: "" };
  const body = numberBody(v, ind);
  return { num: `${ind.prefix ?? ""}${body}`, unit: ind.suffix ?? "" };
}

/** Truncate on a word boundary — mid-word ellipses read as a bug. */
export function clamp(text, n) {
  if (!text || text.length <= n) return text;
  const cut = text.slice(0, n);
  const i = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\u2014"));
  return (i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;:.\u2014-]+$/, "") + "\u2026";
}
