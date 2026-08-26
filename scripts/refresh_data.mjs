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

async function fetchCountries() {
  const rows = [];
  let page = 1, pages = 1;
  do {
    const j = await getJSON(`${API}/country?format=json&per_page=400&page=${page}`);
    pages = j[0].pages;
    rows.push(...j[1]);
    page++;
  } while (page <= pages);
  // region.id === "NA" marks an aggregate rather than a country.
  return rows
    .filter((c) => c.region && c.region.id !== "NA")
    .map((c) => ({ c: c.id, n: c.name, region: c.region.value, i: c.incomeLevel?.value ?? "", iso2: c.iso2Code }));
}

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
const countries = await fetchCountries();
const valid = new Set(countries.map((c) => c.c));
console.error(`[refresh] ${countries.length} countries`);

const obs = {}; // country -> indicatorId -> {year: value}
for (const ind of indicators) {
  const rows = await fetchIndicator(ind.code);
  let n = 0;
  for (const row of rows) {
    if (row.value === null) continue;
    const cc = row.countryiso3code;
    if (!valid.has(cc)) continue;
    ((obs[cc] ??= {})[ind.id] ??= {})[Number(row.date)] = row.value;
    n++;
  }
  console.error(`[refresh] ${ind.code.padEnd(24)} ${String(n).padStart(6)} observations`);
}

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

const bundle = {
  generated: new Date().toISOString().slice(0, 10),
  source: "World Bank World Development Indicators (REST API)",
  yearSpan: [latestYear - TREND_YEARS + 1, latestYear],
  regions,
  indicators,
  countries: kept.map((c) => ({ c: c.c, n: c.n, r: ridx[c.region], i: c.i, iso2: c.iso2 })),
  series,
};

const out = "public/data/wdi.json";
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(bundle));
console.error(`[refresh] wrote ${out} — ${kept.length} countries × ${indicators.length} indicators`);
