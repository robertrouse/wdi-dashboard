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
