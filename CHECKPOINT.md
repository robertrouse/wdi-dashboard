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
