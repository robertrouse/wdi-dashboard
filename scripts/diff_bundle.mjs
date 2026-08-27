#!/usr/bin/env node
/**
 * Summarise what a refresh actually changed.
 *
 * public/data/wdi.json is a single minified line, so `git diff` on it is
 * useless — it reports "1 file changed, 1 insertion, 1 deletion" whether one
 * country moved or the whole bundle broke. This prints a readable summary of
 * the working-tree bundle against the committed one, so an on-demand refresh
 * is something you can review before you push it.
 *
 *   node scripts/diff_bundle.mjs          # working tree vs HEAD
 *   node scripts/diff_bundle.mjs <ref>    # working tree vs any git ref
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const BUNDLE = "public/data/wdi.json";
const ref = process.argv[2] ?? "HEAD";

let before;
try {
  before = JSON.parse(execFileSync("git", ["show", `${ref}:${BUNDLE}`], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  }));
} catch {
  console.error(`Could not read ${BUNDLE} at ${ref} — is this a git repo with that ref?`);
  process.exit(1);
}
const after = JSON.parse(await readFile(BUNDLE, "utf8"));

const line = (l, a, b) => {
  const changed = String(a) !== String(b);
  console.log(`  ${l.padEnd(16)} ${String(a).padStart(12)} ${changed ? "→" : " "} ${changed ? String(b).padStart(12) : "".padStart(12)}`);
};

console.log(`\nBundle: working tree vs ${ref}\n`);
line("source", before.source.includes("API") ? "API" : "bulk CSV", after.source.includes("API") ? "API" : "bulk CSV");
line("generated", before.generated, after.generated);
line("latest year", before.yearSpan[1], after.yearSpan[1]);
line("countries", before.countries.length, after.countries.length);
line("indicators", before.indicators.length, after.indicators.length);

// Per-indicator: how many countries have a reading, and how many advanced a year.
console.log(`\n  ${"indicator".padEnd(26)} ${"countries".padStart(9)} ${"advanced".padStart(9)}  latest year`);
console.log(`  ${"-".repeat(26)} ${"-".repeat(9)} ${"-".repeat(9)}  ${"-".repeat(11)}`);

let advancedTotal = 0, lostTotal = 0;
for (const ind of after.indicators) {
  let n = 0, advanced = 0, lost = 0, maxY = 0;
  for (const [cc, rec] of Object.entries(after.series)) {
    const a = rec[ind.id];
    if (!a) { if (before.series[cc]?.[ind.id]) lost++; continue; }
    n++;
    maxY = Math.max(maxY, a.y);
    const b = before.series[cc]?.[ind.id];
    if (b && a.y > b.y) advanced++;
  }
  advancedTotal += advanced; lostTotal += lost;
  const flag = lost > 0 ? `  ⚠ ${lost} lost` : "";
  console.log(`  ${ind.label.padEnd(26)} ${String(n).padStart(9)} ${String(advanced).padStart(9)}  ${maxY}${flag}`);
}

console.log(`\n  ${advancedTotal} country-indicator pairs gained a newer observation.`);
if (lostTotal) {
  console.log(`  ⚠ ${lostTotal} pairs LOST a reading they previously had — worth checking before you push.`);
} else {
  console.log(`  No readings were lost.`);
}

/* The regional aggregates are the benchmark every region row is scored
   against, so a silent gap here is worse than a missing country: it moves the
   line everything else is measured from. Report them explicitly. */
const codesBefore = before.regionCodes ?? [];
const codesAfter = after.regionCodes ?? [];
console.log(`\n  regional aggregates (official World Bank subtotals)`);
if (!codesAfter.length) {
  console.log(`  ⚠ the new bundle carries NO regional aggregates — every region row will read NA.`);
} else {
  let aggLost = 0;
  console.log(`  ${"region".padEnd(26)} ${"code".padEnd(5)} ${"indicators".padStart(10)}  latest year`);
  console.log(`  ${"-".repeat(26)} ${"-".repeat(5)} ${"-".repeat(10)}  ${"-".repeat(11)}`);
  after.regions.forEach((name, i) => {
    const code = codesAfter[i];
    const recs = code ? after.regionSeries?.[code] ?? {} : {};
    const prevCode = codesBefore[before.regions.indexOf(name)];
    const prevRecs = prevCode ? before.regionSeries?.[prevCode] ?? {} : {};
    const lost = Object.keys(prevRecs).filter((id) => !recs[id]).length;
    aggLost += lost;
    const maxY = Math.max(0, ...Object.values(recs).map((r) => r.y));
    const n = Object.keys(recs).length;
    console.log(
      `  ${name.trim().slice(0, 26).padEnd(26)} ${String(code ?? "--").padEnd(5)} ` +
      `${String(`${n}/${after.indicators.length}`).padStart(10)}  ${maxY || "-"}` +
      (lost ? `  ⚠ ${lost} lost` : "") +
      (code ? "" : "  ⚠ no aggregate mapped")
    );
  });
  if (aggLost) console.log(`  ⚠ ${aggLost} region-indicator benchmarks LOST — region rows will read NA.`);

  const wNow = Object.keys(after.worldSeries ?? {}).length;
  const wWas = Object.keys(before.worldSeries ?? {}).length;
  const wMax = Math.max(0, ...Object.values(after.worldSeries ?? {}).map((r) => r.y));
  console.log(
    `  ${"World (sparkline reference)".padEnd(26)} ${"WLD".padEnd(5)} ` +
    `${String(`${wNow}/${after.indicators.length}`).padStart(10)}  ${wMax || "-"}` +
    (wNow < wWas ? `  ⚠ ${wWas - wNow} lost` : "")
  );
}
console.log();
