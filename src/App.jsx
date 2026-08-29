import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import Legend from "./components/Legend.jsx";
import Matrix from "./components/Matrix.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import FilterPanel from "./components/FilterPanel.jsx";
import QuickStart, { hasSeenQuickStart } from "./components/QuickStart.jsx";
import { buildScalesFromRows, regionRecord, worldRecord, score, PERF } from "./lib/kpi.js";

/* Country presets.

   Two shapes, and the difference between them is the point. G20 is a list
   somebody else drew — it is the set a business audience already argues about,
   and it is deliberately lopsided (six European members, one African). "Top 5
   per region" is drawn from the data itself and is balanced by construction,
   so the region grouping carries information rather than restating the GDP
   ranking. Switching between them is the fastest way to see that a benchmark
   is a property of the comparison set, not of the world: every glyph on screen
   re-scores when the set changes. */

const G20 = [
  "ARG", "AUS", "BRA", "CAN", "CHN", "FRA", "DEU", "IND", "IDN", "ITA",
  "JPN", "MEX", "RUS", "SAU", "ZAF", "KOR", "TUR", "GBR", "USA",
];

const PER_REGION = 5;

const PRESETS = [
  { id: "gdp5",  label: "Top 5 per region · GDP",        hint: `The ${PER_REGION} largest economies in each World Bank region` },
  { id: "pop5",  label: "Top 5 per region · population", hint: `The ${PER_REGION} most populous countries in each World Bank region` },
  { id: "g20",   label: "G20",                           hint: "G20 member states" },
];

const DEFAULT_PRESET = "gdp5";

/** The top N countries per region on `key`, flattened. */
function topPerRegion(bundle, key, n = PER_REGION) {
  const byRegion = new Map();
  for (const c of bundle.countries) {
    const v = bundle.series[c.c]?.[key]?.v;
    if (v == null) continue;
    if (!byRegion.has(c.r)) byRegion.set(c.r, []);
    byRegion.get(c.r).push({ c: c.c, v });
  }
  return [...byRegion.values()].flatMap((list) =>
    list.sort((a, b) => b.v - a.v).slice(0, n).map((x) => x.c)
  );
}

export default function App() {
  const [bundle, setBundle] = useState(null);
  const [err, setErr] = useState(null);

  const [view, setView] = useState("country");
  const [selected, setSelected] = useState([]);
  const [activePreset, setActivePreset] = useState(DEFAULT_PRESET);
  const [activeIndicatorIds, setActiveIndicatorIds] = useState(null);
  const [focusId, setFocusId] = useState("gdp");
  const [onlyWeak, setOnlyWeak] = useState(false);
  const [detailRowId, setDetailRowId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Read once at mount rather than on every render — localStorage access can
  // throw, and the guard lives in the component that owns the key.
  const [quickStart, setQuickStart] = useState(() => !hasSeenQuickStart());

  useEffect(() => {
    // no-cache forces a revalidation against the server's ETag rather than
    // serving a stale copy from disk. The JS bundle is content-hashed so it
    // busts itself, but wdi.json keeps its name across refreshes — without
    // this, a returning visitor could see last month's data for as long as
    // the CDN max-age lasts.
    fetch(`${import.meta.env.BASE_URL}data/wdi.json`, { cache: "no-cache" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((b) => {
        setBundle(b);
        // The default set is derived from the data, so it cannot be a static
        // constant — it is seeded once the bundle arrives.
        setSelected(topPerRegion(b, "gdp"));
      })
      .catch((e) => setErr(e.message));
  }, []);

  // Escape backs out one layer at a time: the detail modal sits above the
  // filter drawer, so it is the one that closes first.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (quickStart) return;            // owns its own Escape handler
      if (detailRowId) setDetailRowId(null);
      else if (filtersOpen) setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailRowId, filtersOpen, quickStart]);

  const indicators = bundle?.indicators ?? [];
  const activeInds = useMemo(
    () => (activeIndicatorIds ? indicators.filter((i) => activeIndicatorIds.includes(i.id)) : indicators),
    [indicators, activeIndicatorIds]
  );
  const focus = indicators.find((i) => i.id === focusId) ?? indicators[0];

  const byCode = useMemo(
    () => Object.fromEntries((bundle?.countries ?? []).map((c) => [c.c, c])),
    [bundle]
  );

  const visibleCodes = useMemo(
    () => (bundle ? selected.filter((c) => byCode[c]) : []),
    [bundle, selected, byCode]
  );

  /* Rows are built in three passes so the scales can be derived from the rows
     themselves rather than from the raw data:
       1. build every data row for the current view level
       2. compute per-indicator scales from those rows
       3. apply the "below benchmark" filter and insert region group headers  */

  const dataRows = useMemo(() => {
    if (!bundle || !focus) return [];

    if (view === "region") {
      return bundle.regions
        .map((_, i) => i)
        .map((ri) => {
          // The country filter still decides which regions are worth showing,
          // but it no longer decides what they say: the row reports the World
          // Bank's published subtotal for the whole region, not a roll-up of
          // the reader's selection. Saying "N selected" here would imply the
          // number moves with the filter, and it does not.
          const members = visibleCodes.filter((c) => byCode[c].r === ri);
          if (!members.length) return null;
          const cache = {};
          const code = bundle.regionCodes?.[ri];
          return {
            kind: "region",
            id: `r${ri}`,
            label: bundle.regions[ri],
            sub: code
              ? `World Bank aggregate ${code} · every economy in the region`
              : "No official aggregate published for this region",
            get: (id) => (cache[id] ??= regionRecord(bundle, ri, indicators.find((i) => i.id === id))),
          };
        })
        .filter(Boolean);
    }

    return visibleCodes.map((c) => ({
      kind: "country",
      id: c,
      label: byCode[c].n,
      region: byCode[c].r,
      get: (id) => bundle.series[c]?.[id] ?? null,
    }));
  }, [bundle, view, visibleCodes, byCode, focus, indicators]);

  const scales = useMemo(
    () => buildScalesFromRows(dataRows, indicators),
    [dataRows, indicators]
  );

  /* Aggregate rows are built here rather than in `dataRows`, and that placement
     is load-bearing: `scales` is derived from dataRows, so an aggregate row can
     be shown WITHOUT joining the peer set it is meant to be compared against.
     Letting a region's total into the country median would move the very
     benchmark the row exists to illustrate. It is scored against that scale,
     it just does not help set it. */
  const rows = useMemo(() => {
    if (!focus) return [];

    const findInd = (id) => indicators.find((i) => i.id === id);
    const aggregateRow = (ri) => {
      const cache = {};
      const code = bundle.regionCodes?.[ri];
      return {
        kind: "aggregate",
        id: `agg-${ri}`,
        label: bundle.regions[ri].trim(),
        sub: code
          ? `Regional aggregate ${code} · every economy in the region`
          : "No official aggregate published for this region",
        region: ri,
        get: (id) => (cache[id] ??= regionRecord(bundle, ri, findInd(id))),
      };
    };
    const worldRow = () => {
      const cache = {};
      return {
        kind: "world",
        id: "agg-world",
        label: "World",
        sub: "World aggregate WLD · every economy the Bank counts",
        get: (id) => (cache[id] ??= worldRecord(bundle, findInd(id))),
      };
    };

    const keep = (r) => {
      if (!onlyWeak) return true;
      const s = score(r.get(focus.id), focus, scales[focus.id]);
      return s.perf === PERF.WEAK || s.perf === PERF.NONE;
    };

    /* Everything is ordered by GDP, descending — regions, and countries within
       each region. Economic weight is the ordering this audience already
       carries in its head, so the largest economies sit where the eye lands
       first.

       It is deliberately NOT the focus metric. Ranking rows by whatever metric
       happens to be in focus meant the whole table reshuffled on every metric
       switch, which destroys the reader's map of where a country lives and
       makes two metrics impossible to compare by scanning the same row
       position. A fixed order costs a little ranking convenience and buys a
       stable page. Missing GDP sorts last rather than first. */
    const gdpInd = findInd("gdp");
    const gdpOf = (row) => row.get(gdpInd.id)?.v ?? null;
    const byGdpDesc = (a, b) => (gdpOf(b) ?? -Infinity) - (gdpOf(a) ?? -Infinity);

    if (view === "region") return [worldRow(), ...dataRows.filter(keep).sort(byGdpDesc)];

    const byRegion = new Map();
    for (const r of dataRows.filter(keep)) {
      if (!byRegion.has(r.region)) byRegion.set(r.region, []);
      byRegion.get(r.region).push(r);
    }

    const out = [];
    // Sections are ordered by the region's own published GDP aggregate, not by
    // the sum of whichever members the reader has selected.
    const regionGdp = (ri) => regionRecord(bundle, ri, gdpInd)?.v ?? -Infinity;
    const ordered = [...byRegion.entries()].sort((a, b) => regionGdp(b[0]) - regionGdp(a[0]));
    for (const [ri, kids] of ordered) {
      kids.sort(byGdpDesc);
      /* The aggregate row IS the section head — it carries the region's name,
         set apart by tint and rule, and it is the line the members below are
         read against. A separate all-caps heading above it repeated the name
         and added a country count that described the reader's SELECTION rather
         than the region, directly next to a row whose whole point is that it
         covers every economy in the region. Two labels, one of them false. */
      out.push(aggregateRow(ri));
      out.push(...kids);
    }
    return out;
  }, [dataRows, view, focus, onlyWeak, scales, bundle, indicators]);

  const detailRow = rows.find((r) => r.id === detailRowId) ?? null;

  function applyPreset(id) {
    setActivePreset(id);
    if (id === "g20") return setSelected(G20.filter((c) => byCode[c]));
    setSelected(topPerRegion(bundle, id === "pop5" ? "pop" : "gdp"));
  }

  if (err) return <Fatal msg={`Could not load the data bundle (${err}).`} />;
  if (!bundle || !focus) return <Loading />;


  // How many controls are away from their default — shown on the button so a
  // collapsed panel cannot hide the fact that the view is filtered.
  const activeFilterCount =
    (activeIndicatorIds && activeIndicatorIds.length < indicators.length ? 1 : 0) +
    (onlyWeak ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Header
        actions={
          <>
          <button
            onClick={() => setQuickStart(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "transparent", color: "var(--blue-ice)",
              border: "1.5px solid transparent", borderRadius: 8,
              padding: "6px 10px", fontSize: "15px", fontWeight: 400,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path d="M6.1 6.1a1.95 1.95 0 1 1 2.3 2.5v1" fill="none" stroke="currentColor"
                    strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11.6" r=".85" fill="currentColor" />
            </svg>
            How to read
          </button>
          <button
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", color: "var(--blue-ice)",
              border: "1.5px solid var(--blue-ice)", borderRadius: 8,
              padding: "6px 14px", fontSize: "15px", fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M1 3h14M4 8h8M6.5 13h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span style={{
                background: "var(--blue-ice)", color: "var(--blue-raven)",
                borderRadius: 999, fontSize: "12px", fontWeight: 600,
                minWidth: 18, textAlign: "center", padding: "1px 5px",
              }}>{activeFilterCount}</span>
            )}
          </button>
          </>
        }
      />

      {/* Scrolls in BOTH axes. The matrix used to own its own horizontal
          scroller, but an element with overflow-x:auto is a scroll container in
          its own right, and a sticky <thead> inside one sticks to that box —
          which scrolls away with the page — instead of to the viewport. One
          scroller is what makes the column headers stay put. */}
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <div style={{ padding: "18px 24px 70px" }}>
          <Legend />

          {rows.length === 0 ? (
            <Empty onlyWeak={onlyWeak} />
          ) : (
            <Matrix
              rows={rows}
              indicators={activeInds}
              focus={focus}
              scales={scales}
              bundle={bundle}
              selectedRow={detailRowId}
              onSelectRow={(r) => setDetailRowId(detailRowId === r.id ? null : r.id)}
              onFocusMetric={setFocusId}
            />
          )}

          <Method bundle={bundle} />
        </div>
      </main>

      {detailRow && (
        <DetailPanel
          row={detailRow}
          indicators={indicators}
          scales={scales}
          bundle={bundle}
          onClose={() => setDetailRowId(null)}
        />
      )}

      {quickStart && (
        <QuickStart onClose={() => { QuickStart.markSeen(); setQuickStart(false); }} />
      )}

      {filtersOpen && (
        <div
          onClick={() => setFiltersOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 75, background: "rgba(10,16,68,.28)" }}
        >
          <FilterPanel
            bundle={bundle}
            onClose={() => setFiltersOpen(false)}
            view={view} setView={(v) => { setView(v); setDetailRowId(null); }}
            indicators={indicators}
            activeIndicatorIds={activeIndicatorIds ?? indicators.map((i) => i.id)}
            toggleIndicator={(id) => {
              const cur = activeIndicatorIds ?? indicators.map((i) => i.id);
              const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
              setActiveIndicatorIds(next.length ? next : cur);
            }}
            focusId={focus.id} setFocus={setFocusId}
            countries={bundle.countries}
            selected={selected}
            setSelected={(s) => { setSelected(s); setActivePreset(null); }}
            onlyWeak={onlyWeak} setOnlyWeak={setOnlyWeak}
            presets={PRESETS} applyPreset={applyPreset} activePreset={activePreset}
          />
        </div>
      )}
    </div>
  );
}

function Method({ bundle }) {
  return (
    <section style={{ marginTop: 40, maxWidth: 860, fontSize: "16px", lineHeight: 1.6, color: "var(--ink-soft)" }}>
      <h3 style={{ fontSize: "21px", marginBottom: 10 }}>Notes on reading this</h3>
      <p style={{ marginTop: 0 }}>
        Values stay in their own units; the <strong>glyph</strong> beside them does not — it
        reports position against the benchmark on a scale every metric shares. Where a metric
        can be judged better or worse, a <strong>sparkline's</strong> dotted line is that row's
        benchmark and the trace is coloured by which side of it each year fell on. Sparklines
        are self-scaled, so shape is comparable between rows but height never is.
      </p>
      <p>
        <strong>Change</strong> is a percentage change, except for metrics already measured in
        percent, which report percentage <em>points</em> — unemployment moving 4.0% to 4.4% is
        not "up 10%". Rows are ordered by <strong>GDP descending</strong> rather than by the
        focus metric, so switching metrics never reshuffles the table and two metrics can be
        compared by scanning the same row. Each section opens with the Bank's published
        <strong> regional aggregate</strong>, shown for reference but excluded from the
        benchmark maths — letting a region's total into the median of its own members would
        move the very line it exists to illustrate.
      </p>
      <p>
        <strong>Inflation is scored against a target band</strong>, not against its peers, so
        it reads red on <em>both</em> sides: 0.1% and 3.2% are both misses — one too cold, one
        too hot — and they score identically. Two countries moving in opposite directions can
        therefore both be red. Hover the value and it names which side of the band it fell on.
        A hairline separates the metric columns wherever the category changes; each column's
        hover card opens with the category it belongs to.
      </p>
      <p style={{ fontSize: "14.5px", color: "var(--warm-grey)", borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
        Source: {bundle.source}. Bundle generated {bundle.generated}. Values are each country's
        most recent available observation — not always the same year, which is why the year is
        printed beneath every value. Regions follow the World Bank's own classification, revised
        in 2024 when Pakistan and Afghanistan moved out of South Asia.
      </p>
    </section>
  );
}

function Loading() {
  return <Center><div className="eyebrow">Loading indicators…</div></Center>;
}
function Fatal({ msg }) {
  return (
    <Center>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: "21px", fontWeight: 500, marginBottom: 8 }}>{msg}</div>
        <div style={{ color: "var(--warm-grey)", fontSize: "16px" }}>
          Run <code>npm run refresh</code> to rebuild <code>public/data/wdi.json</code>.
        </div>
      </div>
    </Center>
  );
}
function Empty({ onlyWeak }) {
  return (
    <Center style={{ height: 260 }}>
      <div style={{ textAlign: "center", color: "var(--warm-grey)" }}>
        <div style={{ fontSize: "19px", marginBottom: 6 }}>Nothing to show</div>
        {onlyWeak
          ? "No selected row is below the benchmark on this metric — which is itself an answer."
          : "Add countries, or pick a preset, in Filters."}
      </div>
    </Center>
  );
}
function Center({ children, style }) {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", ...style }}>{children}</div>
  );
}
