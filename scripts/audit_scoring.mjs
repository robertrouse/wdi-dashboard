/* Property-check every colour/verdict path against the glossary. */
import { readFileSync } from "node:fs";
import { buildScalesFromRows, score, delta, PERF } from "../src/lib/kpi.js";

const b = JSON.parse(readFileSync("public/data/wdi.json", "utf8"));
const inds = b.indicators;
const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

// Build a realistic scale per indicator from the country set.
const rows = b.countries.map((c) => ({ get: (id) => b.series[c.c]?.[id] ?? null }));
const scales = buildScalesFromRows(rows, inds);

for (const ind of inds) {
  const sc = scales[ind.id];
  if (!sc?.n) continue;
  const lo = sc.sorted[0], hi = sc.sorted[sc.sorted.length - 1];
  const mid = sc.median;

  const s = (v) => score({ v, y: 2025, p: null, py: null, t: [] }, ind, sc);

  if (ind.direction === "up") {
    ok(s(hi).goodness >= s(lo).goodness, `${ind.id}: up — max should not score below min`);
    ok(s(hi).perf === PERF.STRONG, `${ind.id}: up — max should be STRONG, got ${s(hi).perf}`);
    ok(s(lo).perf === PERF.WEAK, `${ind.id}: up — min should be WEAK, got ${s(lo).perf}`);
  }
  if (ind.direction === "down") {
    ok(s(lo).goodness >= s(hi).goodness, `${ind.id}: down — min should not score below max`);
    ok(s(lo).perf === PERF.STRONG, `${ind.id}: down — min should be STRONG, got ${s(lo).perf}`);
    ok(s(hi).perf === PERF.WEAK, `${ind.id}: down — max should be WEAK, got ${s(hi).perf}`);
  }
  if (ind.direction === "none") {
    for (const v of [lo, mid, hi]) ok(s(v).perf === PERF.NEUTRAL, `${ind.id}: none — must always be NEUTRAL`);
  }
  if (ind.direction === "band") {
    const [bLo, bHi] = ind.targetBand;
    const inside = (bLo + bHi) / 2;
    ok(s(inside).perf === PERF.STRONG, `${ind.id}: band — inside band should be STRONG, got ${s(inside).perf}`);
    // Symmetry: equal distance outside the band on either side must score equally.
    const d = (bHi - bLo);
    const below = s(bLo - d), above = s(bHi + d);
    ok(Math.abs(below.goodness - above.goodness) < 1e-9,
       `${ind.id}: band — equal distance either side must score equally (${below.goodness} vs ${above.goodness})`);
    ok(below.deviation < 0 && above.deviation < 0,
       `${ind.id}: band — outside the band must read as below the midline on both sides`);
  }

  // ---- delta favourability ----
  const D = (v, p) => delta({ v, p, py: 2024, y: 2025, t: [] }, ind);
  if (ind.direction === "up") {
    ok(D(2, 1).favorable === true,  `${ind.id}: up — a rise must be favourable`);
    ok(D(1, 2).favorable === false, `${ind.id}: up — a fall must be unfavourable`);
  }
  if (ind.direction === "down") {
    ok(D(1, 2).favorable === true,  `${ind.id}: down — a fall must be favourable`);
    ok(D(2, 1).favorable === false, `${ind.id}: down — a rise must be unfavourable`);
  }
  if (ind.direction === "none") {
    ok(D(2, 1).favorable === null && D(1, 2).favorable === null,
       `${ind.id}: none — movement must carry no verdict`);
  }
  if (ind.direction === "band") {
    const t = ind.target;
    ok(D(t, t + 5).favorable === true,  `${ind.id}: band — moving onto target must be favourable`);
    ok(D(t + 5, t).favorable === false, `${ind.id}: band — moving off target must be unfavourable`);
    // from either side
    ok(D(t, t - 5).favorable === true,  `${ind.id}: band — approaching from below must be favourable`);
  }
}

console.log(`checked ${inds.length} indicators against the live scales`);
if (fail.length) { console.log("\nFAILURES:"); fail.forEach((f) => console.log("  ✗ " + f)); }
else console.log("all direction / verdict / symmetry properties hold");
