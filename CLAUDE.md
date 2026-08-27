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
   from the full dataset. In region view this means the seven regional
   aggregates are scored against each other. Scoring them against the country
   distribution flattens the view and is wrong.
4. **"No data" is a distinct state** (`PERF.NONE`, dashed circle, `NA`). Never
   render a missing value as zero, blank, or bottom-ranked.
5. **Sparkline height is never comparable between rows.** Each is scaled to its
   own values plus its own reference (see 9) — never to a shared axis across
   rows. Shape, colour and where the trace crosses its reference are the
   comparable parts; vertical extent is not, and no copy may imply it is.
6. **Region rows are the World Bank's own published subtotals** — never a
   roll-up this project computes. `data/regions.json` maps each region to its
   official aggregate code (the seven "all income levels" ones: EAS, ECS, LCN,
   MEA, NAC, SAS, SSF — *not* the "excluding high income" variants, which cover
   different economies). Both build scripts carry those series into
   `regionSeries`; `regionRecord()` reads them.

   This replaced a median of member countries on 2026-08-26. The old rule was
   trying to avoid a real error — summing life expectancy is meaningless and
   averaging percentages unweighted is worse — but it overcorrected into a
   different one, because *there is no single roll-up rule that is right for
   fifteen metrics*. Population wants a sum, life expectancy a
   population-weighted average, inflation a median, homicides whatever UNODC
   does. A median of member countries weights Tuvalu and China equally, so
   "East Asia & Pacific GDP" read as **$16.7 billion** — the middle-ranked
   economy — against a true regional figure of **$33.7 trillion**. Off by
   ×2,019, and it looked perfectly reasonable on screen.

   Two rules follow, and both matter:
   - **The aggregate is fixed.** It covers every economy the Bank counts in
     that region, so it does not move when the reader filters countries.
     Filtering decides which region rows appear, never what they say. Any copy
     implying otherwise is a bug — that is why the row subtitle says "every
     economy in the region" rather than a selection count.
   - **No fallback, ever.** A region with no published subtotal for an
     indicator reads `NA` (invariant 4). Quietly substituting a
     differently-computed number would put two incompatible statistics in one
     column, which is the exact error this dashboard exists to teach against.

   `ind.aggShort` carries a short, faithful restatement of the Bank's method
   and the matrix header shows it. Do not remove it: that the method *changes
   per metric* is part of the argument, not a footnote.
7. **Adding an indicator must stay a data-only change** — one row in
   `data/indicators.json` plus a data rebuild. If a change forces you to touch
   a component to add a metric, the abstraction has leaked; fix that instead.
8. **Type stays large.** Body 17px, nothing below 15px, no fine print. Robert
   asked for this explicitly and it is a stated design goal, not a default.
   (Note the design does not actually meet this: secondary lines in `Matrix.jsx`
   have always been 13-13.5px. Either raise them or restate what the floor
   covers — do not quietly cite this line as if it were true.)

9. **Chrome earns its pixels; the matrix gets the rest.** The header is one
    58px bar, the filters live in a drawer behind a button, and row detail is a
    modal. Anything that does not carry data stays out of the vertical budget —
    the full-width matrix fits all fifteen glyph columns without the horizontal
    scroller, which is the whole point of the view. If you add chrome, take the
    space from somewhere else.

10. **Definitions and caveats belong on the column header, nowhere else.**
    Hovering a header asks "what is this metric, and how do I read it?" — that
    gets the full `IndicatorCard`. Hovering a glyph in a data row asks "how is
    *this one* doing?", so it gets that row's value, verdict and sparkline and
    no standing text. The detail modal carries no caveat text either: fifteen
    repeated paragraphs pushed the numbers off screen. One place, one question.

11. **Aggregate rows are shown, but never set the benchmark.** Each section
    opens with its regional aggregate (region view opens with the World). They
    are built in the `rows` memo, *after* `scales` is derived from `dataRows` —
    that ordering is load-bearing. Letting a region's total into the median of
    its own members would move the very line the row exists to illustrate. They
    are scored against that scale, they just do not help set it, and the
    benchmark note counts peers only.

12. **Change is percent, except for metrics already in percent.** Those report
    percentage points — "unemployment up 10%" for 4.0% to 4.4% is the classic
    misread. Everything else is percent change so the column can be read down
    the page. Two exceptions, both in `DeltaArrow`: a zero or sign-crossing
    baseline (net migration swings through zero, and a percent change off a
    negative is an artefact, not a fact) falls back to native units; and a delta
    that rounds to zero at the displayed precision prints "no change" rather
    than "−0.0%". Check that on the rounded NUMBER — a regex over the formatted
    string missed it once the unit moved to the end.

13. **Row order is GDP descending and does NOT follow the focus metric.** It
    used to rank by whatever metric was in focus, which reshuffled the whole
    table on every switch and made two metrics impossible to compare by
    scanning the same row position. A fixed order costs a little ranking
    convenience and buys a stable page. Sections are ordered by the region's own
    published GDP aggregate, not by the sum of the selected members; missing GDP
    sorts last. Clicking a metric's column header sets the focus metric, and the
    order stays put — that is the point.

14. **A sparkline's dotted reference and its colours are ONE decision.** The
   line a reader sees must be the line the colours are measured from. The rules
   live in `referenceFor()` in `src/lib/kpi.js`, and each exclusion was measured
   rather than guessed:
   - Rated metrics get their peer aggregate as a **time series** — a country
     against its region, a region against the World. Never a flat line at the
     latest value: that invents crossings that never happened.
   - Band metrics get the target band, because "better" means inside it.
   - **Totals get nothing.** GDP, population and net migration aggregate by
     summing, so a country is below its region by construction — one possible
     answer — and forcing that figure into the vertical range flattened the
     country's own decade to under a pixel in 205 of 212 cases.
   - **No favourable direction gets nothing.** Urbanisation: the colours would
     encode nothing while costing 100 of 217 countries most of their range.

   `ind.aggKind` (`total` | `level`) drives the first exclusion and is derived
   from the Bank's own aggregation method, so adding an indicator stays a
   data-only change (invariant 7). Rows without a reference keep the plain
   self-scaled trace and single performance colour they had before.

## Brand tokens

Defined in `src/index.css`. Kanit throughout, loaded from the Google Fonts CDN
in `index.html`.

**The mark is the Action octopus** (`src/components/ActionMark.jsx`). It is not
redrawn — the path data was lifted out of the brand book PDF's own vector
operators (p.14, "The Pictogram"), so the curves are the originals. White on
Blue Raven is the treatment the book shows. The two eyes are filled with the
background colour on purpose: on the original they mask the tentacle lines
running behind them, so an `eyeFill` that does not match its background will
look broken. Stroke follows `currentColor`.

To re-extract it if the brand book is ever revised, the pictogram is
`page.get_drawings()[3:8]` on page 13 (0-indexed) of `../Action Brand Book
(1).pdf`; build the SVG from those items rather than `get_svg_image()`, which
drags in the whole page's font paths and lands at ~187 KB.

**On Kanit's provenance** — worth stating because it is easy to assume
otherwise: Kanit is *not* a bespoke Action typeface. It is an open-source
family by Cadson Demak (a Thai foundry), published on Google Fonts under the
SIL Open Font License 1.1. The Action brand book says so itself on p.36 ("As a
Google font, Kanit also offers the advantage of accessibility and ease of
use"). action.co self-hosts its own woff2 cuts, but they are the same font —
canvas glyph metrics for Kanit Light measured identically on action.co and on
this dashboard. There is no licensing constraint on using it here.

If zero third-party requests ever becomes a requirement, self-hosting is
permitted by the OFL and is the same approach action.co takes: drop woff2 files
in `public/fonts/` and replace the `<link>` in `index.html` with local
`@font-face` rules. Not needed today.
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
data/regions.json           region label -> official WB aggregate code, with
                            accepted-name aliases; read by BOTH build scripts
scripts/build_data.py       seed bundle from the local bulk CSV (offline path)
scripts/refresh_data.mjs    recurring bundle from the World Bank REST API
scripts/diff_bundle.mjs     human-readable summary of what a refresh changed
src/lib/kpi.js              scales, scoring, deltas, region benchmarks, trend
src/lib/format.js           unit-aware formatting
src/components/*.jsx        presentation only; no metric-specific logic
```

Both data paths must emit an **identical bundle shape** — the app never learns
which one produced its data. If you change the shape, change both, and say so
in `PLAN.md`.

Bundle shape:
```
{ generated, source, yearSpan:[from,to],
  regions:[…], regionCodes:[…],          // parallel arrays; code may be null
  indicators:[…],
  countries:[{c,n,r,i,iso2}],
  series:{      CCC: { indicatorId: { y, v, p, py, t:[[year,value],…] } } },
  regionSeries:{ EAS: { indicatorId: { y, v, p, py, t:[[year,value],…] } } },
  worldSeries:{        indicatorId: { y, v, p, py, t:[[year,value],…] } } }
```
`y`/`v` latest year and value · `p`/`py` previous value and its year ·
`t` trend window.

`regionSeries` records are the same shape as country records — deliberately, so
the same scoring, delta and sparkline code runs over both. They hold the World
Bank's official regional subtotals (invariant 6). `regionCodes[i]` is the
aggregate code for `regions[i]`; a `null` there means that region has no
published aggregate and its rows read `NA`.

`worldSeries` is the WLD aggregate, in the same record shape. It is not a
region and must never be a row — it exists so a REGION's sparkline has
something to be drawn against, the way a country's is drawn against its
region. `data/regions.json` carries its code under `world`.

**Region labels differ between the two data paths and that is expected.** The
API returns the post-reclassification names, some with trailing whitespace
(`"Sub-Saharan Africa "`); the January 2026 bulk CSV still labels *countries*
`"Middle East & North Africa"` even though its *aggregate* row already uses the
new name. `data/regions.json` lists both spellings and matching collapses
whitespace, so each path maps to the same aggregate code regardless. Compare
bundles on `regionCodes`, never on `regions`.

---

## Environment — read this before debugging a network failure

**You are running on Robert's Mac. The session that built this was not.**

That earlier session ran in a sandbox with no route to `api.worldbank.org`,
which is why the committed bundle was seeded from the bulk CSV and why
`scripts/refresh_data.mjs` was written but never executed locally. You almost
certainly *can* reach the API. **Verifying the refresh path end to end is the
single most useful thing you can do early.**

Verified on this machine: Node v22.22.0, npm 10.9.4. (An earlier note said
22.23.2 / 10.9.8; the running toolchain is the pair above.)

**The sandbox left `node_modules` half-installed.** Every
`@rollup/rollup-*` platform directory was created but *empty* — the optional
native binaries could not be downloaded without a network. `npm run refresh`
still worked (pure Node), but `npm run build` died with
`Cannot find module @rollup/rollup-darwin-arm64`. Fixed by `npm ci`, which
restores from `package-lock.json` and touches no committed file. CI was never
affected. If a fresh clone or a sandboxed session ever shows this again, run
`npm ci` before concluding anything is wrong with the repo.

---

## Current state (2026-08-26)

Live: <https://robertrouse.github.io/wdi-dashboard/>
Repo: <https://github.com/robertrouse/wdi-dashboard>

- Pages is enabled with the GitHub Actions source; Actions workflow permissions
  are set to read/write (the refresh job needs that to commit).
- Deploy and refresh workflows have both run green, including the full
  refresh → sanity-gate → commit → redeploy chain.
- The live bundle is API-sourced, data through 2025.
- Everything through `21b53ed` is pushed; origin and local are in sync.

## Open items

1. **CLOSED (2026-08-26) — the three missing internet-users readings are real,
   not a pipeline bug.** The refresh path has now been run end to end against
   the live API on Robert's Mac.

   The `countryiso3code` hypothesis was **wrong**. The fallback never fired
   (`rescued` was 0) and TKM / VUT / WSM stayed absent. Inspecting the raw API
   rows shows why: `IT.NET.USER.ZS` for those three economies now ends at

   | | last non-null in API | value | CSV seed had |
   |---|---|---|---|
   | Samoa (WSM)        | 2014 | 21.20 | 2023 = 58.1386 |
   | Vanuatu (VUT)      | 2015 | 22.35 | 2023 = 45.7313 |
   | Turkmenistan (TKM) | 2016 | 17.99 | 2017 = 21.251  |

   The World Bank **withdrew the recent ITU estimates** for these countries
   between the January 2026 bulk-CSV snapshot and the current API vintage. The
   API returns explicit `null`s for every later year — including years the CSV
   has dense values for. With `MAX_STALENESS = 8` against a latest year of
   2025, the cutoff is 2017, so all three fall out. **`condense()` is doing
   exactly the right thing**, and `NA` is the honest reading (invariant 4).
   The three countries still carry their other 12–14 indicators.

   Do not "fix" this. If it ever needs re-checking:
   ```bash
   curl -s "https://api.worldbank.org/v2/country/WSM/indicator/IT.NET.USER.ZS?format=json&per_page=200"
   ```

   Two things worth knowing that fell out of this:
   - **The 2-letter fallback is dead code, and harmlessly so.** Empty
     `countryiso3code` rows *do* exist — 80 of them in that indicator — but
     every one is an income-group aggregate (`XD`, `XM`, `XN`, `XT`, `XY`).
     Those are absent from `byIso2` (which is built only from real countries),
     so they resolve to `undefined` and get dropped, which is correct. Keep the
     fallback as cheap insurance; just don't expect it to do anything.
   - **A CSV-seeded bundle and an API-seeded bundle are not interchangeable in
     content**, only in shape. The bulk CSV is a frozen vintage and can carry
     readings the live API has since retracted. When they disagree, the API is
     current and the CSV is history. The spot-check values in this file are
     labelled "2024 vintage" for that reason — check them against the CSV, not
     against a fresh API pull.

2. **The monthly schedule has not fired yet.** Every green run so far was a
   `workflow_dispatch` or a push. They take the same path, but GitHub can delay
   or drop `schedule` events on low-traffic repos. The repo is only days old,
   so the first scheduled run is **1 September 2026, 06:00 UTC** — nothing to
   diagnose before then. Check with `gh run list --event schedule`.

3. **Type reviewed in Kanit at desktop width — CLOSED for that case.**
   Verified live in Chrome: Kanit loads from the Google Fonts CDN, weights
   300/400/500/600/700 all resolve, and the rotated column headers in
   `Matrix.jsx` are legible. Still unreviewed at narrow/tablet widths, where the
   glyph matrix overflows into its horizontal scroller and the rightmost column
   clips at the container edge. The scroll affordance is not obvious — consider
   a fade or shadow on the right edge of the scroll container.

4. **CLOSED (2026-08-26).** The sanity gate no longer hardcodes 15 — it derives
   the expected count from `data/indicators.json`, so adding an indicator stays
   a data-only change (invariant 7). The gate also now asserts that all seven
   regions have an official aggregate carrying every indicator.

   The gate has been exercised against the good bundle and nine deliberate
   corruptions (aggregates emptied, one region unmapped, one aggregate short an
   indicator, old-shaped bundle, country collapse, indicator dropped, stale
   years, GDP wiped): it passes the first and rejects the rest with an accurate
   message. Worth re-running after any change to the bundle shape —
   `scripts/` has no harness for it, so extract the `node -e` body from
   `refresh-data.yml` and run it with `node -e` (running it as a *file* changes
   how `require("./…")` resolves and tests something CI never does).

---

## Verifying a change

```bash
npm run dev            # http://localhost:5173
npm run build          # must stay clean
npm run refresh:diff   # after any data change — read the "lost" column AND
                       # the regional-aggregates table under it
```

For UI changes, exercise **all 15 focus metrics in both view levels**. That
sweep has caught real bugs three times (band-metric sorting, region-scale
mismatch, stale "median of the selected countries" copy left in the sidebar
after the aggregates change) and it is cheap. Playwright against
`npm run preview` works well for it; driving the focus `<select>` from the
browser console works too, but note Vite HMR resets React state, so switch
view level *after* your last edit or you will sweep the wrong view.

After a change to region behaviour, check the numbers are aggregates and not
medians — the tell is GDP, where the two differ by three orders of magnitude:

```bash
node -e 'const b=require("./public/data/wdi.json");console.log(b.regionSeries.EAS.gdp.v)'
# ~3.4e13 (the region). If you see ~1.7e10 you are looking at a median country.
```

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
