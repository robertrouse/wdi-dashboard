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

## Data architecture

The app reads exactly one static file, `public/data/wdi.json` (~650 KB, ~70 KB
gzipped): 217 countries × 15 indicators, each with its latest observation, the
previous one, and a ten-year trend. Nothing is fetched at page load.

```
                 World Bank REST API
                          │
                          │  monthly, or on demand
                          ▼
        .github/workflows/refresh-data.yml
                          │
             scripts/refresh_data.mjs
                          │
                  sanity checks ──── fail ──▶ job stops, live site untouched
                          │ pass
                          ▼
          commit public/data/wdi.json  ── unchanged ──▶ done, nothing to deploy
                          │ changed
                          ▼
          .github/workflows/deploy.yml  (workflow_call)
                          │
                   npm ci && npm run build
                          ▼
                    GitHub Pages
```

**Why static rather than live API calls.** Fifteen indicators means fifteen-plus
round trips before anything renders, and every viewer pays that cost, subject to
World Bank uptime and rate limits. A committed bundle renders instantly, works
offline, and gives a diffable history of every data revision. The trade is
freshness — and these are *annual* series, so a monthly pull is already well
ahead of the publication rate.

**Three safeguards worth knowing about:**

1. *The sanity gate.* After the API pull, the workflow checks country count,
   indicator count, GDP coverage and latest year. If any check trips the job
   fails with the bundle uncommitted, and the live site keeps serving the last
   known-good data. A half-successful API pull can never overwrite good data.
2. *Commit only on change.* If the World Bank published nothing new, the job
   exits quietly. The git history stays a log of real data revisions rather
   than a log of cron firings.
3. *The explicit redeploy call.* A commit pushed by `GITHUB_TOKEN` does **not**
   trigger other workflows — GitHub's loop protection. So `refresh-data.yml`
   invokes `deploy.yml` directly via `workflow_call` when the data changed.
   Without that, refreshed data would sit in the repo and never reach the site.

### Changing the cadence

Edit the cron in `.github/workflows/refresh-data.yml`:

```yaml
- cron: "0 6 1 * *"     # 1st of each month, 06:00 UTC  ← current
- cron: "0 6 1 */3 *"   # quarterly
- cron: "0 6 * * 1"     # every Monday
```

You can always force a run from the **Actions** tab → *Refresh WDI data* →
*Run workflow*, which is the useful button when the World Bank announces a
release mid-month.

### Building the bundle locally

Two paths produce an identical bundle shape:

```bash
# From the World Bank REST API — the same code CI runs
npm run refresh

# From a local bulk WDI CSV extract — no network needed
python3 scripts/build_data.py \
  --tall ../WDI_CSV_tall.csv \
  --country ../WDI_EXCEL_Country_prepared.csv \
  --out public/data/wdi.json
```

The committed bundle was seeded from the bulk CSV path.

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

## First-time setup

```bash
gh repo create wdi-dashboard --public --source=. --remote=origin --push
```

Then, once:

1. **Settings → Pages → Source: GitHub Actions.** Without this the deploy
   workflow builds fine and publishes nothing.
2. **Settings → Actions → General → Workflow permissions: Read and write.**
   The refresh job needs this to commit the updated bundle.
3. **Actions tab → Refresh WDI data → Run workflow.** This is the first real
   test of the API path end to end. Watch it once; after that it is monthly and
   silent.

The site lands at `https://<your-username>.github.io/wdi-dashboard/`. The build
derives its base path from the repository name, so renaming the repo does not
break asset URLs.

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
  and Afghanistan moved out of South Asia into what the API now returns as
  "Middle East, North Africa, Afghanistan & Pakistan". South Asia is therefore
  smaller here than in older WDI vintages, and the region label changes
  depending on whether the bundle came from the API or from an older bulk CSV.
- Region rows are **medians of the selected member countries**, not weighted
  aggregates. Summing life expectancy or averaging unweighted percentages would
  be wrong; the median is honest and the tooltip says so.

Source: World Bank, World Development Indicators (CC BY 4.0).
