# CHECKPOINT

**Last updated:** 2026-08-26
**Status:** Built, deployed, live. Handed off to Claude Code for further iteration.

Start with `CLAUDE.md` — invariants, environment notes, and open items.
`PLAN.md` holds the original design decisions.

## Build phases — all complete
- [x] 1. Repo scaffolded, git init'd
- [x] 2. Indicator selection + metadata   → `data/indicators.json` (15 indicators)
- [x] 3. Data pipeline                    → `public/data/wdi.json` (217 countries)
- [x] 4. KPI normalization logic          → `src/lib/kpi.js`
- [x] 5. Dashboard UI                     → `src/`
- [x] 6. Deployment                       → `.github/workflows/`, GitHub Pages
- [x] 7. Verification                     → build, data spot-checks, headless sweep

## Live
- Site: https://robertrouse.github.io/wdi-dashboard/
- Repo: https://github.com/robertrouse/wdi-dashboard
- Pages source: GitHub Actions · Actions workflow permissions: read/write
- Deployed bundle: World Bank REST API, data through 2025
- Refresh cadence: 1st of each month, 06:00 UTC, plus manual dispatch

## Verification record
- Data spot-checked against the source CSV, exact match on all five:
  USA GDP/capita 2024 = 84,534.0408 · NGA life exp 2023 = 54.4620 ·
  BRA homicides 2023 = 19.2753 · IND population 2024 = 1,450,935,791 ·
  JPN inflation 2024 = 2.7385
- Headless sweep of all 15 focus metrics × both view levels, all four country
  presets, attention filter and empty state: zero console errors.
- Full CI chain proven live: API pull → sanity gate → commit → redeploy → Pages.

## Refresh path verified on real hardware — 2026-08-26
Run on Robert's Mac with live API access, which the authoring session lacked.

- `git push` done; origin is level with local at `21b53ed`.
- `npm run refresh` completed against `api.worldbank.org`: 217 countries ×
  15 indicators, 2904 observations for `IT.NET.USER.ZS`.
- `npm run refresh:diff` reported **0 gained, 0 lost** and `git status` was
  clean — the API-sourced bundle reproduced byte-for-byte. The pipeline is
  deterministic against an unchanged API vintage.
- **Open item 1 is closed, and the hypothesis in it was wrong.** TKM / VUT /
  WSM are missing internet-users readings because the World Bank retracted
  those ITU estimates, not because of a code-matching bug. Full write-up in
  `CLAUDE.md`.
- `npm run build` initially failed on a half-installed `node_modules` left by
  the sandbox (empty `@rollup/rollup-*` dirs). `npm ci` fixed it; the build is
  clean at 228.93 kB / 71.80 kB gzipped. See the environment note in
  `CLAUDE.md`.

## Regional benchmarks now come from the World Bank — 2026-08-26

Region rows were the median of the member countries on screen; they are now the
Bank's own published regional subtotal. See PLAN.md "Amendments" for the shape
change and CLAUDE.md invariant 6 for the reasoning.

- All 7 regions × 15 indicators resolve — no gaps, so no fallback path is used.
- Verified both data paths emit identical top-level keys and record shapes.
  The API path costs no extra requests (the aggregates already rode along in
  the `country/all` pull and were being discarded).
- Spot-checked against the live API: NAC/SSF/EAS GDP per capita 2025 match to
  the decimal.
- Swept all 15 focus metrics × both view levels in the browser, zero console
  errors. The old sidebar copy ("Median of the selected countries in each
  region") was caught by that sweep and fixed, along with the legend note, the
  row subtitle and the detail-panel eyebrow.
- Sanity gate rewritten and **actually exercised** for the first time: passes
  the good bundle, rejects nine deliberate corruptions with accurate messages.
  It also no longer hardcodes 15 indicators (closes old open item 4).

Scale of the correction, for context: East Asia & Pacific GDP read **$16.7B**
under the old median (its middle-ranked economy) against a true **$33.7T**.

## Sparklines carry a benchmark — 2026-08-27

Dotted reference line, trace coloured by which side of it each year fell on, and
a hover readout (year · value · benchmark · better/worse). See PLAN.md
"Amendments" and CLAUDE.md invariant 9.

- The reference is a time series, so 2016 is compared with the 2016 benchmark.
- Country rows reference their region; region rows reference the new World (WLD)
  aggregate; inflation references its target band.
- GDP, population, net migration and urbanisation get NO reference — measured,
  not assumed: applying it flattened 205/212 countries to under a pixel for GDP
  and encoded nothing for urbanisation. Those keep their old self-scaled trace.
- Verified: all 15 metrics in both view levels, detail panel, hover readout with
  a real pointer, zero console errors. Both data paths emit identical shapes.
- Gate now covers `worldSeries`; re-exercised against 11 corruptions, all caught.

**Trap this exposed:** the bundle embeds a copy of `data/indicators.json`. I
added `aggKind` to the glossary but the app kept reading the old copy, so GDP
briefly kept a reference line it should never have had. A glossary edit does
nothing until the data is rebuilt. Documented in PLAN.md and README.

## UI: chrome shrunk, filters and detail moved — 2026-08-27

- **Header 150px -> 58px.** Standfirst, eyebrow and the stacked stat blocks are
  gone; mark, title, three inline stats and the Filters button on one line.
- **Filters behind a button** (drawer + backdrop, Escape / backdrop / Done all
  dismiss). Recovering those 318px is what lets all fifteen glyph columns fit
  without the horizontal scroller.
- **Row detail is a modal**, not a panel below the matrix. Also compacted: the
  per-row definition and caveat text is gone, rows are 9px instead of 16px, and
  the dialog is 860px wide. Eight metrics visible at once, against two or three.
- **Tooltips split by question.** Column header -> full indicator card with
  definition and caveat. Data-row glyph -> that row's value, verdict and a
  sparkline with its benchmark, no standing text.
- Verified: all 15 metrics x both view levels render; drawer and modal dismiss
  via Escape, backdrop and button; clicks inside the drawer do not dismiss it;
  no app console errors.

**Known cosmetic issue, pre-existing:** `clamp()` truncates the three GDP
definitions at their shared opening, so on the column-header hovers GDP, GDP per
capita and GDP growth all read identically until the caveat. Worth either
raising the clamp or writing distinct openings.

## Aggregate rows, percent change, no income subhead — 2026-08-27

- **Every section opens with its regional aggregate**; region view opens with
  the World. Built in the `rows` memo *after* `scales` is derived from
  `dataRows`, so they are shown and scored but never help set the benchmark —
  the note still counts 26 countries / 7 regions.
- **Change is percent change**, except metrics already in percent, which report
  points. Fallback to native units when the baseline is zero or sign-crossing
  (net migration swings through zero).
- **Income-level subhead removed** from country rows.

Fixed on the way: the "rounds to zero" guard was a regex over the formatted
string and missed `−0.0%` once the unit moved to the end. It now tests the
rounded number. Swept all 15 metrics — no zero leaks.

## Immediate next actions
1. Check `gh run list --event schedule` after **1 Sept 2026** — the monthly
   trigger has still never fired, and the repo is too new for it to have.
2. Narrow/tablet-width review of the glyph matrix (open item 3): the rightmost
   column clips and the horizontal scroll affordance is not obvious.

## Notes / gotchas
- The authoring session's sandbox could NOT reach api.worldbank.org or
  fonts.googleapis.com. Claude Code on Robert's Mac can. This means:
  the API refresh path is untested locally. (Kanit has since been verified
  rendering correctly on the live site at desktop width.)
- `WDI_CSV_tall.csv` is 1.1 GB; always stream it, never read it whole.
- Vite needs delete permission on `dist/`; in a Cowork session that requires
  `device_request_delete_permission` on the WDI folder.
