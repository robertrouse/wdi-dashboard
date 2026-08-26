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

/** The one entry point the UI uses. `ind` is an indicators.json record. */
export function formatValue(v, ind, { compactAlways = false } = {}) {
  if (v == null || Number.isNaN(v)) return "—";
  const body =
    ind.scale === "compact" || compactAlways
      ? compact(v, ind.decimals)
      : plain(v, ind.decimals);
  return `${ind.prefix ?? ""}${body}${ind.suffix ? " " + ind.suffix : ""}`;
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
  const body = ind.scale === "compact" ? compact(v, ind.decimals) : plain(v, ind.decimals);
  return { num: `${ind.prefix ?? ""}${body}`, unit: ind.suffix ?? "" };
}

/** Truncate on a word boundary — mid-word ellipses read as a bug. */
export function clamp(text, n) {
  if (!text || text.length <= n) return text;
  const cut = text.slice(0, n);
  const i = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\u2014"));
  return (i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;:.\u2014-]+$/, "") + "\u2026";
}
