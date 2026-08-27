#!/usr/bin/env node
/**
 * Rebuild public/data/wdi.json from the World Bank REST API.
 *
 * This is the recurring path, run by .github/workflows/refresh-data.yml.
 * It produces byte-for-byte the same bundle shape as scripts/build_data.py,
 * so the app never needs to know which path produced its data.
 *
 *   node scripts/refresh_data.mjs
 *
 * Why static rather than live in-browser calls: the API needs one request per
 * indicator per page, the bundle is ~650 KB (well under 200 KB gzipped), and a
 * committed file means the dashboard renders instantly, survives World Bank
 * downtime, and has a diffable history of every data revision.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const API = "https://api.worldbank.org/v2";
const TREND_YEARS = 10;
const MAX_STALENESS = 8;
const MIN_YEAR = new Date().getFullYear() - 16;
const RETRIES = 4;

async function getJSON(url) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "wdi-dashboard/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === RETRIES) throw new Error(`${url} failed after ${RETRIES} tries: ${err.message}`);
      await new Promise((r) => setTimeout(r, 800 * 2 ** (attempt - 1)));
    }
  }
}

/** Every page of one indicator, for all countries. */
async function fetchIndicator(code) {
  const base = `${API}/country/all/indicator/${code}?format=json&per_page=15000&date=${MIN_YEAR}:${new Date().getFullYear()}`;
  const first = await getJSON(base);
  if (!Array.isArray(first) || !first[1]) throw new Error(`no data payload for ${code}`);
  const rows = [...first[1]];
  const pages = first[0].pages ?? 1;
  for (let p = 2; p <= pages; p++) {
    const next = await getJSON(`${base}&page=${p}`);
    if (next[1]) rows.push(...next[1]);
  }
  return rows;
}

/** The full economy list, aggregates included. */
async function fetchEconomies() {
  const rows = [];
  let page = 1, pages = 1;
  do {
    const j = await getJSON(`${API}/country?format=json&per_page=400&page=${page}`);
    pages = j[0].pages;
    rows.push(...j[1]);
    page++;
  } while (page <= pages);
  return rows;
}

// region.id === "NA" marks an aggregate rather than a country.
const isCountry = (c) => c.region && c.region.id !== "NA";

function condense(byYear, latestYear) {
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  if (!years.length) return null;
  const y = years.at(-1);
  if (latestYear - y > MAX_STALENESS) return null;
  const py = years.length > 1 ? years.at(-2) : null;
  const window = years.filter((yy) => yy > y - TREND_YEARS);
  const r = (n) => Math.round(n * 1e6) / 1e6;
  return {
    y, v: r(byYear[y]),
    p: py === null ? null : r(byYear[py]),
    py,
    t: window.map((yy) => [yy, r(byYear[yy])]),
  };
}

const indicators = JSON.parse(await readFile("data/indicators.json", "utf8"));
const regionMap = JSON.parse(await readFile("data/regions.json", "utf8"));

const economies = await fetchEconomies();
const countries = economies.filter(isCountry).map((c) => ({
  c: c.id, n: c.name, region: c.region.value, i: c.incomeLevel?.value ?? "", iso2: c.iso2Code,
}));
const valid = new Set(countries.map((c) => c.c));
console.error(`[refresh] ${countries.length} countries`);

/* Official regional aggregates ------------------------------------------------
   The World Bank publishes a subtotal for each region, aggregated the way that
   indicator should be aggregated — a sum for population, a population-weighted
   average for life expectancy, UNODC's own method for homicides. Those are the
   regional benchmarks. We do not compute our own.

   `country/all` already returns these rows, so capturing them costs no extra
   requests; they are simply no longer thrown away. */
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const aggCodeByName = new Map();
for (const { code, names } of regionMap.aggregates) {
  for (const n of names) aggCodeByName.set(norm(n), code);
}
const aggCodes = new Set(regionMap.aggregates.map((a) => a.code));
const presentAggs = new Set(economies.filter((e) => aggCodes.has(e.id)).map((e) => e.id));
for (const code of aggCodes) {
  if (!presentAggs.has(code)) console.error(`[refresh] WARNING: aggregate ${code} is absent from the economy list`);
}

// The API returns an empty countryiso3code for some economies, so a naive
// filter on that field silently drops them. Fall back to the 2-letter code
// carried in row.country.id, which is always populated.
const byIso2 = new Map(countries.filter((c) => c.iso2).map((c) => [c.iso2, c.c]));
const resolve = (row) => {
  const iso3 = row.countryiso3code;
  if (iso3 && valid.has(iso3)) return iso3;
  const iso2 = row.country?.id;
  return iso2 ? byIso2.get(iso2) ?? null : null;
};

const obs = {};    // country       -> indicatorId -> {year: value}
const aggObs = {}; // aggregate code -> indicatorId -> {year: value}
let rescued = 0;
for (const ind of indicators) {
  const rows = await fetchIndicator(ind.code);
  let n = 0, a = 0;
  for (const row of rows) {
    if (row.value === null) continue;
    if (aggCodes.has(row.countryiso3code)) {
      ((aggObs[row.countryiso3code] ??= {})[ind.id] ??= {})[Number(row.date)] = row.value;
      a++;
      continue;
    }
    const cc = resolve(row);
    if (!cc) continue;
    if (!row.countryiso3code || !valid.has(row.countryiso3code)) rescued++;
    ((obs[cc] ??= {})[ind.id] ??= {})[Number(row.date)] = row.value;
    n++;
  }
  console.error(`[refresh] ${ind.code.padEnd(24)} ${String(n).padStart(6)} observations  ${String(a).padStart(3)} aggregate`);
}
if (rescued) console.error(`[refresh] ${rescued} rows matched via the 2-letter code fallback`);

const latestYear = Math.max(
  ...Object.values(obs).flatMap((byInd) => Object.values(byInd).flatMap((byYear) => Object.keys(byYear).map(Number)))
);

const series = {}, kept = [];
for (const c of countries) {
  const byInd = obs[c.c];
  if (!byInd) continue;
  const rec = {};
  for (const [id, byYear] of Object.entries(byInd)) {
    const cond = condense(byYear, latestYear);
    if (cond) rec[id] = cond;
  }
  if (Object.keys(rec).length) { series[c.c] = rec; kept.push(c); }
}

const regions = [...new Set(kept.map((c) => c.region))].sort();
const ridx = Object.fromEntries(regions.map((r, i) => [r, i]));

// Parallel to `regions`: the official aggregate code for each, or null if the
// region has no published subtotal (that region then reads NA, never a
// silently substituted figure computed some other way).
const regionCodes = regions.map((name) => aggCodeByName.get(norm(name)) ?? null);
regions.forEach((name, i) => {
  if (!regionCodes[i]) console.error(`[refresh] WARNING: no official aggregate mapped for region "${name}"`);
});

const regionSeries = {};
for (const code of regionCodes.filter(Boolean)) {
  const byInd = aggObs[code];
  if (!byInd) { console.error(`[refresh] WARNING: no observations for aggregate ${code}`); continue; }
  const rec = {};
  for (const [id, byYear] of Object.entries(byInd)) {
    const cond = condense(byYear, latestYear);
    if (cond) rec[id] = cond;
  }
  regionSeries[code] = rec;
}
console.error(
  `[refresh] regional aggregates: ` +
  regionCodes.map((c, i) => `${c ?? "??"}=${c ? Object.keys(regionSeries[c] ?? {}).length : 0}`).join(" ") +
  ` of ${indicators.length} indicators`
);

const bundle = {
  generated: new Date().toISOString().slice(0, 10),
  source: "World Bank World Development Indicators (REST API)",
  yearSpan: [latestYear - TREND_YEARS + 1, latestYear],
  regions,
  regionCodes,
  indicators,
  countries: kept.map((c) => ({ c: c.c, n: c.n, r: ridx[c.region], i: c.i, iso2: c.iso2 })),
  series,
  regionSeries,
};

const out = "public/data/wdi.json";
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(bundle));
console.error(`[refresh] wrote ${out} — ${kept.length} countries × ${indicators.length} indicators`);
