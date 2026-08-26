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

## Immediate next actions
1. `git push` — one local commit (`4f39a52`) is ahead of origin.
2. `npm run refresh && npm run refresh:diff` — first real test of the
   2-letter-code fallback. See open item 1 in `CLAUDE.md`.
3. Check the Actions tab after the 1st: the monthly `schedule` trigger has
   never fired (every run so far was dispatch or push).

## Notes / gotchas
- The authoring session's sandbox could NOT reach api.worldbank.org or
  fonts.googleapis.com. Claude Code on Robert's Mac can. This means:
  the API refresh path is untested locally. (Kanit has since been verified
  rendering correctly on the live site at desktop width.)
- `WDI_CSV_tall.csv` is 1.1 GB; always stream it, never read it whole.
- Vite needs delete permission on `dist/`; in a Cowork session that requires
  `device_request_delete_permission` on the WDI folder.
