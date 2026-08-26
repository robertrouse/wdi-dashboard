# Many metrics, one view

A web dashboard built on the World Bank's World Development Indicators, made to
demonstrate a specific problem and a specific set of answers to it.

**The problem.** An organization tracks dozens of KPIs. GDP is tens of
trillions of dollars. Inflation is a single-digit percent. Under-5 mortality is
a rate per thousand. Population is billions. A reader has to answer "how are we
doing?" across all of them at once, and no shared axis can carry them.

**The answers**, each visible in the interface:

| Idea | Where it shows up |
|---|---|
| Position is normalized; labels stay in native units | The glyph column vs. the value column |
| Favorable direction is metadata, not intuition | Falling under-5 mortality and rising life expectancy are both blue |
| Targets beat benchmarks where they exist | Inflation scores against a 2% band; everything else against the peer median |
| The benchmark follows the selection | Change the country set and every glyph re-scores |
| "No data" is a state, not a zero | Adult literacy renders `NA`, never an empty or bottom-ranked cell |
| Sparklines show shape, not magnitude | Each line scaled to its own range |
| One structure, not one panel per metric | Adding an indicator is a row in `data/indicators.json` |

This is a web reimplementation of "Multiple Key Performance Metrics" (Robert
Rouse, InterWorks) as published in *The Big Book of Dashboards*.

---

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # -> dist/
```

## Data

The app reads one static file, `public/data/wdi.json` (~650 KB, ~70 KB gzipped):
217 countries × 15 indicators, each with its latest observation, the previous
one, and a ten-year trend.

**Why static rather than live API calls.** The World Bank API needs one request
per indicator per page — fifteen indicators is fifteen-plus round trips before
anything renders, and every viewer pays that cost, subject to World Bank
uptime. A committed bundle renders instantly, works offline, and gives a
diffable history of every data revision. The trade is freshness, and these are
annual series: a weekly refresh is comfortably ahead of the publication rate.

Two paths produce the identical bundle shape:

```bash
# Recurring: pull from the World Bank REST API (also runs weekly in CI)
npm run refresh

# Seed / offline: derive from a local bulk WDI CSV extract
python3 scripts/build_data.py \
  --tall ../WDI_CSV_tall.csv \
  --country ../WDI_EXCEL_Country_prepared.csv \
  --out public/data/wdi.json
```

`.github/workflows/refresh-data.yml` runs the API path every Monday, validates
the result (country count, indicator count, latest year) and commits only if
the data actually changed.

## Adding or changing an indicator

Everything about an indicator lives in `data/indicators.json` — an extension of
the Tableau glossary sheet this project grew out of:

```json
{
  "id": "life",
  "code": "SP.DYN.LE00.IN",
  "label": "Life expectancy",
  "short": "Life expect.",
  "group": "Health & Education",
  "prefix": "", "suffix": "yrs", "decimals": 1, "scale": "plain",
  "direction": "up", "target": null, "targetBand": null,
  "definition": "…", "caveat": "…"
}
```

`direction` is `up`, `down`, `band` (needs `target` + `targetBand`) or `none`.
`scale` is `compact` (K/M/B/T) or `plain`. Add the row, re-run the data build,
and the indicator appears in the matrix, the filter list, the focus-metric
selector and the detail panel. No component changes.

## Deploying

Push to `main`. `.github/workflows/deploy.yml` builds with
`BASE_PATH=/<repo-name>/` and publishes to GitHub Pages. Enable Pages once,
under Settings → Pages → Source: **GitHub Actions**.

## Layout

```
data/indicators.json        the glossary — units, direction, definitions, caveats
scripts/build_data.py       seed bundle from a local bulk CSV
scripts/refresh_data.mjs    recurring bundle from the World Bank API
src/lib/kpi.js              normalization, scoring, deltas, region roll-ups
src/lib/format.js           unit-aware value formatting
src/components/KpiGlyph     the performance mark
src/components/Matrix       countries/regions × metrics
src/components/DetailPanel  one entity, every indicator, in full
PLAN.md / CHECKPOINT.md     design decisions and build state
```

## Notes on the data

- Values are each country's **most recent available observation**, which is not
  the same year for every country. The year is printed under every value.
- Region groupings are the World Bank's own and were revised in 2024: Pakistan
  and Afghanistan moved from South Asia to the Middle East & North Africa group.
- Region rows are **medians of the selected member countries**, not weighted
  aggregates. Summing life expectancy or averaging unweighted percentages would
  be wrong; the median is honest and the tooltip says so.

Source: World Bank, World Development Indicators (CC BY 4.0).
