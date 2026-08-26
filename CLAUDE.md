# CLAUDE.md — working notes for Claude Code

Context for continuing this project. `README.md` is written for humans using
the dashboard; this file is what an agent needs to not break it.

---

## What this is, and what it is *for*

A web reimplementation of "Multiple Key Performance Metrics" — Robert Rouse's
dashboard from *The Big Book of Dashboards* — using World Bank World
Development Indicators as the demonstration dataset.

**The dashboard is an argument, not just a UI.** It exists to demonstrate how
to compare KPIs measured in incompatible units (trillions of dollars, single-
digit percentages, rates per 1,000, raw counts) in one view. Robert teaches
these concepts to clients. A change that makes the page prettier but weakens
the demonstration is a regression. When a design choice and the argument
conflict, the argument wins.

Source material lives in the parent folder `../`:
- `BBOD Multiple Metrics KPI.docx` — the published chapter, incl. the original
  dashboard screenshots. Read it before redesigning anything structural.
- `Action Brand Book (1).pdf` — brand palette p.23, typeface p.36, type styles
  p.37.
- `wdi_glossary_inputs.csv` — Robert's original Tableau glossary; the schema
  `data/indicators.json` extends.
- `WDI_CSV_tall.csv` (1.1 GB) — bulk source for the offline data path.

---

## Invariants — do not break these without discussing it first

1. **Native units in the label, normalized position in the glyph.** The printed
   number is never rescaled. The glyph is never drawn from a raw value.
2. **Favorable direction comes from metadata**, never from intuition or a
   hard-coded per-metric branch. `direction` is `up` | `down` | `band` | `none`.
3. **Scales are built from the rows on screen** (`buildScalesFromRows`), not
   from the full dataset. In region view this means region medians are scored
   against other region medians. Scoring them against the country distribution
   flattens the view and is wrong.
4. **"No data" is a distinct state** (`PERF.NONE`, dashed circle, `NA`). Never
   render a missing value as zero, blank, or bottom-ranked.
5. **Sparklines are scaled to their own range.** They encode shape and
   direction only. If you ever put them on a shared axis, the tooltip claim
   that magnitude is not comparable becomes a lie.
6. **Region rows are medians, never sums or unweighted means.** Summing life
   expectancy is meaningless; averaging percentages without weights is worse.
7. **Adding an indicator must stay a data-only change** — one row in
   `data/indicators.json` plus a data rebuild. If a change forces you to touch
   a component to add a metric, the abstraction has leaked; fix that instead.
8. **Type stays large.** Body 17px, nothing below 15px, no fine print. Robert
   asked for this explicitly and it is a stated design goal, not a default.

## Brand tokens

Defined in `src/index.css`. Kanit (Google Fonts) throughout.
Blue Raven `#0A1044` · Blue Maven `#4655E4` · Red Cerise `#F8227D` ·
Blue Ice `#00CEEA` · Background `#F4FBFF` · Cool Grey `#D8E9F4` ·
Neutral Grey `#C5CED6` · Warm Grey `#50687A`.
Performance roles: strong = Maven, mid = Blaze `#FF9900`, weak = Cerise,
neutral/none = greys. Expanded-palette colours accentuate, never dominate.

---

## Architecture

```
data/indicators.json        the glossary — the single source of truth for
                            units, direction, targets, definitions, caveats
scripts/build_data.py       seed bundle from the local bulk CSV (offline path)
scripts/refresh_data.mjs    recurring bundle from the World Bank REST API
scripts/diff_bundle.mjs     human-readable summary of what a refresh changed
src/lib/kpi.js              scales, scoring, deltas, region roll-ups, trend
src/lib/format.js           unit-aware formatting
src/components/*.jsx        presentation only; no metric-specific logic
```

Both data paths must emit an **identical bundle shape** — the app never learns
which one produced its data. If you change the shape, change both, and say so
in `PLAN.md`.

Bundle shape:
```
{ generated, source, yearSpan:[from,to], regions:[…], indicators:[…],
  countries:[{c,n,r,i,iso2}],
  series:{ CCC: { indicatorId: { y, v, p, py, t:[[year,value],…] } } } }
```
`y`/`v` latest year and value · `p`/`py` previous value and its year ·
`t` trend window.

---

## Environment — read this before debugging a network failure

**You are running on Robert's Mac. The session that built this was not.**

That earlier session ran in a sandbox with no route to `api.worldbank.org`,
which is why the committed bundle was seeded from the bulk CSV and why
`scripts/refresh_data.mjs` was written but never executed locally. You almost
certainly *can* reach the API. **Verifying the refresh path end to end is the
single most useful thing you can do early.**

Verified on this machine: Node v22.23.2, npm 10.9.8.

---

## Current state (2026-08-26)

Live: <https://robertrouse.github.io/wdi-dashboard/>
Repo: <https://github.com/robertrouse/wdi-dashboard>

- Pages is enabled with the GitHub Actions source; Actions workflow permissions
  are set to read/write (the refresh job needs that to commit).
- Deploy and refresh workflows have both run green, including the full
  refresh → sanity-gate → commit → redeploy chain.
- The live bundle is API-sourced, data through 2025.
- **There is one local commit not yet pushed:** `4f39a52` (the `refresh:diff`
  tool and the 2-letter-code fallback). Push it early — the fallback is the
  fix for open item 1 below and it should be exercised on the next refresh.

## Open items

1. **Three countries lost internet-users readings on the first API refresh** —
   Turkmenistan, Vanuatu, Samoa — despite being well inside the staleness
   window, so this is not the window sliding. Hypothesis: the World Bank API
   returns an empty `countryiso3code` for some economies and the row filter
   dropped them. `refresh_data.mjs` now falls back to `row.country.id` (the
   2-letter code), **but that fix was never executed** — no API access in the
   authoring session. To close this out:
   ```bash
   npm run refresh        # watch for "N rows matched via the 2-letter code fallback"
   npm run refresh:diff   # do TKM / VUT / WSM come back for the `net` indicator?
   ```
   If they do not, the hypothesis is wrong and it needs a fresh look — inspect
   the raw API rows for those countries rather than assuming.

2. **The monthly schedule has not fired yet.** Every green run so far was a
   `workflow_dispatch` or a push. They take the same path, but GitHub can delay
   or drop `schedule` events on low-traffic repos. Check the Actions tab after
   the 1st of the month.

3. **Type has never been reviewed in Kanit.** The authoring sandbox could not
   reach Google Fonts, so every screenshot rendered in a fallback face. Layout
   was verified; typography was not. Worth one pass at real sizes — especially
   the rotated column headers in `Matrix.jsx`, which are tight.

4. **`scripts/build_data.py` hardcodes nothing about indicator count, but
   `refresh-data.yml`'s sanity gate asserts exactly 15.** If you add or remove
   an indicator, update that assertion or the monthly refresh will start
   failing closed.

---

## Verifying a change

```bash
npm run dev            # http://localhost:5173
npm run build          # must stay clean
npm run refresh:diff   # after any data change — read the "lost" column
```

For UI changes, exercise **all 15 focus metrics in both view levels**. That
sweep has caught real bugs twice (band-metric sorting, region-scale mismatch)
and it is cheap. Playwright against `npm run preview` works well for it.

Data spot-checks against the source of truth are worth repeating after any
pipeline change. Known-good values from the CSV seed (2024 vintage):
USA GDP/capita 84,534.0408 · IND population 1,450,935,791 ·
JPN inflation 2.7385 · NGA life expectancy 54.4620 · BRA homicides 19.2753.

## Two CI traps already hit — do not reintroduce them

- **`actions/checkout` in a `workflow_call` defaults to the caller's SHA**,
  which for the refresh job is the commit *before* its own data commit.
  `deploy.yml` pins `ref: ${{ github.ref }}` for this reason. Removing it makes
  the site silently serve stale data while the repo looks correct.
- **A commit pushed with `GITHUB_TOKEN` does not trigger other workflows.**
  That is why `refresh-data.yml` calls `deploy.yml` explicitly instead of
  relying on its own push.

## Working style

Robert is a professional data-visualization practitioner and the author of the
source chapter. He wants direct, evidence-grounded answers and will push back
precisely when framing does not match his situation — do the same in return.
Show him what changed and why; do not narrate routine steps. When something is
unverified, say so plainly rather than implying it was tested.
