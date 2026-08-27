# World Development Indicators — Multi-Metric KPI Dashboard

A web reimplementation of the "Multiple Key Performance Metrics" dashboard
(Robert Rouse / InterWorks, *The Big Book of Dashboards*, Ch. Multiple Metrics KPI),
using World Bank World Development Indicators as the demonstration dataset.

## Core problem being demonstrated
Organizations track KPIs measured in incompatible units — percentages, dollars,
raw counts, tiny decimals, billions. A single view must let a reader compare
"how are we doing?" across all of them at once. The solution set:

1. **Shape encodes performance vs. target, not magnitude.** A circle with a
   filled arc above/below center reads identically whether the metric is 0.7%
   or $28 trillion.
2. **Normalize to a common scale for position, keep native units for labels.**
   Values are indexed within the peer set (percentile rank); the printed number
   stays in native units with prefix/suffix from the glossary.
3. **Favorable direction is metadata, not intuition.** `+` / `-` / `na` per
   indicator drives color; homicide down is good, life expectancy up is good.
4. **Sparklines carry trend without axes.** Each row's 10-year line is scaled
   to its own min/max — trend shape is comparable even when units are not.
5. **One flexible structure, not one panel per metric.** Rows are data-driven;
   adding an indicator is a glossary row, not a new component.

## Decisions (locked 2026-08-26)
- **Data**: static JSON bundle in `public/data/`, refreshed by a scheduled
  GitHub Action calling the World Bank API. v1 seeded from the local bulk
  `WDI_CSV_tall.csv` (the build shells in the authoring session had no egress
  to api.worldbank.org).
- **Stack**: Vite + React 18, deployed to GitHub Pages.
- **Countries**: balanced ~3-4 per World Bank region (not top-20-by-GDP), so
  the region grouping is actually demonstrative.
- **Brand**: Action brand book — Kanit type, Blue Raven `#0A1044`,
  Blue Maven `#4655E4`, Red Cerise `#F8227D`, Blue Ice `#00CEEA`,
  Background `#F4FBFF`, greys `#D8E9F4` / `#C5CED6` / `#50687A`.
- **Legibility**: base body type >= 16px, table text >= 17px, no fine print.

## Amendments

### 2026-08-26 — regional benchmarks come from the World Bank, not from us

**Supersedes the original region roll-up.** Region rows were the median of the
member countries currently on screen. They are now the Bank's own published
regional subtotal, carried in the bundle as `regionSeries` and mapped by
`data/regions.json`. Rationale and the rules that follow are in CLAUDE.md
invariant 6; the short version is that no single roll-up rule is correct for
fifteen metrics, and the median made "East Asia & Pacific GDP" read as the GDP
of its middle-ranked economy — $16.7B against a true $33.7T.

**This changed the bundle shape**, so both data paths changed together, as the
architecture note requires:

- added `regionCodes` (parallel to `regions`, `null` where unmapped)
- added `regionSeries` (same record shape as `series`, keyed by aggregate code)
- added `aggShort` to each indicator in `data/indicators.json` — a short,
  faithful restatement of the Bank's aggregation method, shown in the matrix
  header

Both `scripts/build_data.py` and `scripts/refresh_data.mjs` emit the new keys
and were run to confirm identical top-level keys and identical record shapes.
The API path gets the aggregates from the `country/all` pull it already makes,
so the change costs no extra requests.

**Behaviour change worth knowing:** the country filter no longer alters what a
region row reports — an official aggregate covers the whole region. Filtering
still decides which region rows appear. The sidebar hint, the row subtitle, the
legend note and the detail-panel eyebrow were all reworded to match; leaving any
of them saying "median of the selected countries" would have been a live lie
about the number next to it.

### 2026-08-27 — sparklines carry a benchmark

Each sparkline now draws a dotted reference and colours the trace by which side
of it the row was on in each year, with a hover readout giving year, value and
benchmark. The reference is a **time series**, not a flat line at the latest
value, which would manufacture crossings that never happened.

The reference and the colouring are deliberately one decision — the dotted line
a reader sees is the line the colours are measured from. Where nothing can be
compared, nothing is drawn, and both exclusions were measured rather than
assumed:

- **Totals get no reference.** GDP, population and net migration aggregate by
  summing, so a country is below its region by construction. Forcing that
  figure into the vertical range flattened the country's own decade to under a
  pixel in 205 of 212 cases for GDP, 215 of 217 for population.
- **Metrics with no favourable direction get none either.** Urbanisation would
  have cost 100 of 217 countries most of their vertical range to encode nothing.

Those rows keep the plain self-scaled trace and single performance colour they
had before. Overall 8.4% of country-metric rows sit under 3px of trace, against
roughly a third if the reference had been applied everywhere.

Shape change (both data paths again):

- added `worldSeries` (WLD) — what a *region* row is drawn against. Kept out of
  `regions`/`regionCodes` because the world is not a region and must not be a row.
- added `aggKind` (`total` | `level`) to each indicator, derived from the Bank's
  own aggregation method, so the exclusion above stays data-driven.

**Trap worth remembering:** the bundle embeds a *copy* of `data/indicators.json`.
Editing the glossary without rebuilding the bundle leaves the app reading the old
metadata — that is exactly how GDP briefly kept a reference line it should never
have had. Any glossary change needs a data rebuild before it takes effect.

## Phases
| # | Phase | Output |
|---|-------|--------|
| 1 | Scaffold + checkpoints | repo, PLAN.md, CHECKPOINT.md |
| 2 | Indicator selection + metadata | `data/indicators.json` |
| 3 | Data pipeline | `scripts/build_data.py`, `scripts/refresh_data.mjs`, `public/data/wdi.json` |
| 4 | Normalization / KPI logic | `src/lib/kpi.js` |
| 5 | Dashboard UI | `src/` components, brand CSS |
| 6 | Deployment | Pages workflow, refresh workflow, README |
| 7 | Verification | build, visual QA, data spot-checks |

## Source files (parent folder)
- `WDI_CSV_tall.csv` (1.1 GB) — tall observations
- `WDI_EXCEL_Series_prepared.csv` — indicator metadata incl. definitions + limitations
- `WDI_EXCEL_Country_prepared.csv` — country metadata incl. Region, Income Group
- `wdi_glossary_inputs.csv` — Robert's Tableau glossary schema
