import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import Legend from "./components/Legend.jsx";
import Matrix from "./components/Matrix.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import FilterPanel from "./components/FilterPanel.jsx";
import { buildScalesFromRows, regionRecord, worldRecord, score, PERF } from "./lib/kpi.js";

/* Default country set: three to five per World Bank region, chosen for regional
   balance rather than economic weight, so the region grouping actually carries
   information instead of restating the GDP ranking. */
const DEFAULT_SET = [
  "USA", "CAN",                                  // North America
  "CHN", "JPN", "IDN", "AUS",                    // East Asia & Pacific
  "DEU", "GBR", "FRA", "RUS", "TUR",             // Europe & Central Asia
  "BRA", "MEX", "ARG", "COL",                    // Latin America & Caribbean
  "SAU", "ARE", "EGY", "ISR",                    // Middle East & North Africa
  "IND", "PAK", "BGD",                           // South Asia
  "NGA", "ZAF", "KEN", "ETH",                    // Sub-Saharan Africa
];

const PRESETS = [
  { id: "balanced", label: "Balanced 26", hint: "Three to five countries per region" },
  { id: "g20", label: "G20", hint: "G20 member states" },
  { id: "gdp20", label: "Top 20 by GDP", hint: "Largest economies in the data" },
  { id: "pop20", label: "Top 20 by population", hint: "Most populous countries" },
];

const G20 = ["ARG","AUS","BRA","CAN","CHN","FRA","DEU","IND","IDN","ITA","JPN","MEX","RUS","SAU","ZAF","KOR","TUR","GBR","USA"];

export default function App() {
  const [bundle, setBundle] = useState(null);
  const [err, setErr] = useState(null);

  const [view, setView] = useState("country");
  const [selected, setSelected] = useState(DEFAULT_SET);
  const [activePreset, setActivePreset] = useState("balanced");
  const [activeRegions, setActiveRegions] = useState(null);   // null == all
  const [activeIndicatorIds, setActiveIndicatorIds] = useState(null);
  const [focusId, setFocusId] = useState("gdppc");
  const [onlyWeak, setOnlyWeak] = useState(false);
  const [detailRowId, setDetailRowId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    // no-cache forces a revalidation against the server's ETag rather than
    // serving a stale copy from disk. The JS bundle is content-hashed so it
    // busts itself, but wdi.json keeps its name across refreshes — without
    // this, a returning visitor could see last month's data for as long as
    // the CDN max-age lasts.
    fetch(`${import.meta.env.BASE_URL}data/wdi.json`, { cache: "no-cache" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setBundle)
      .catch((e) => setErr(e.message));
  }, []);

  // Escape backs out one layer at a time: the detail modal sits above the
  // filter drawer, so it is the one that closes first.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (detailRowId) setDetailRowId(null);
      else if (filtersOpen) setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailRowId, filtersOpen]);

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

  const visibleCodes = useMemo(() => {
    if (!bundle) return [];
    const inSet = selected.filter((c) => byCode[c]);
    const regionsOn = activeRegions ?? bundle.regions.map((_, i) => i);
    return inSet.filter((c) => regionsOn.includes(byCode[c].r));
  }, [bundle, selected, activeRegions, byCode]);

  /* Rows are built in three passes so the scales can be derived from the rows
     themselves rather than from the raw data:
       1. build every data row for the current view level
       2. compute per-indicator scales from those rows
       3. apply the "below benchmark" filter and insert region group headers  */

  const dataRows = useMemo(() => {
    if (!bundle || !focus) return [];

    if (view === "region") {
      const regionsOn = activeRegions ?? bundle.regions.map((_, i) => i);
      return regionsOn
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
  }, [bundle, view, visibleCodes, byCode, focus, indicators, activeRegions]);

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
      // The aggregate leads the section: it is the line the members below are
      // being read against, so it wants to be seen before them, not found after.
      out.push({ kind: "groupHeader", label: bundle.regions[ri], count: kids.length });
      out.push(aggregateRow(ri));
      out.push(...kids);
    }
    return out;
  }, [dataRows, view, focus, onlyWeak, scales, bundle, indicators]);

  const detailRow = rows.find((r) => r.id === detailRowId) ?? null;

  function applyPreset(id) {
    setActivePreset(id);
    if (id === "balanced") return setSelected(DEFAULT_SET);
    if (id === "g20") return setSelected(G20.filter((c) => byCode[c]));
    const key = id === "gdp20" ? "gdp" : "pop";
    const ranked = (bundle?.countries ?? [])
      .map((c) => ({ c: c.c, v: bundle.series[c.c]?.[key]?.v ?? -Infinity }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 20)
      .map((x) => x.c);
    setSelected(ranked);
  }

  if (err) return <Fatal msg={`Could not load the data bundle (${err}).`} />;
  if (!bundle || !focus) return <Loading />;


  // How many controls are away from their default — shown on the button so a
  // collapsed panel cannot hide the fact that the view is filtered.
  const activeFilterCount =
    (activeRegions && activeRegions.length < bundle.regions.length ? 1 : 0) +
    (activeIndicatorIds && activeIndicatorIds.length < indicators.length ? 1 : 0) +
    (onlyWeak ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Header
        actions={
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

      {filtersOpen && (
        <div
          onClick={() => setFiltersOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 75, background: "rgba(10,16,68,.28)" }}
        >
          <FilterPanel
            bundle={bundle}
            onClose={() => setFiltersOpen(false)}
            view={view} setView={(v) => { setView(v); setDetailRowId(null); }}
            regions={bundle.regions}
            activeRegions={activeRegions ?? bundle.regions.map((_, i) => i)}
            toggleRegion={(i) => {
              const cur = activeRegions ?? bundle.regions.map((_, j) => j);
              setActiveRegions(cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort());
            }}
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
    <section style={{ marginTop: 44, maxWidth: 900, fontSize: "16px", lineHeight: 1.6, color: "var(--ink-soft)" }}>
      <h3 style={{ fontSize: "21px", marginBottom: 10 }}>How to read this</h3>
      <p style={{ marginTop: 0 }}>
        The number in each row stays in its own units — dollars, percent, years, deaths per
        thousand. The <strong>glyph</strong> beside it does not: it reports where that value
        sits relative to the benchmark, on a scale every indicator shares. That is what makes
        a $29&nbsp;trillion economy and a 2.1% inflation rate comparable in the same glance.
      </p>
      <p>
        Each <strong>sparkline</strong> is scaled to its own range, so height is never
        comparable between rows — only shape is. Where a metric can be judged better or
        worse, the dotted line is the peer benchmark for that row (a country against its
        region, a region against the World, inflation against its target band), and the
        trace is coloured by which side of it that year fell on. Hover any point for the
        year, the value and the benchmark it is being read against.
      </p>
      <p>
        Three metrics carry no dotted line. GDP, population and net migration aggregate by
        summing their members, so a country is below its region's figure by definition and
        the comparison has only one answer; urbanisation has no favourable direction to
        colour. Those keep a plain self-scaled trace rather than a benchmark that would
        mean nothing. Arrows point the way the number moved and are coloured by whether that
        movement was good — falling under-5 mortality and rising life expectancy are both blue.
      </p>
      <p>
        <strong>Change</strong> is a percentage change for every metric except those already
        measured in percent, which report percentage <em>points</em> instead. A percent change
        of a percent is a well-known way to mislead: unemployment moving from 4.0% to 4.4% is
        not "up 10%". One rule for everything else is deliberate — a column mixing "+$520",
        "+0.3 yrs" and "−1.2 per 1,000" cannot be read down the page.
      </p>
      <p>
        Rows are ordered by <strong>GDP, descending</strong> — regions, and countries within
        each region — rather than by whichever metric is in focus. Ranking by the focus metric
        reshuffled the whole table on every switch, which makes two metrics impossible to
        compare by scanning the same row position. Click any metric name across the top to make
        it the focus metric; the order does not move.
      </p>
      <p>
        Every section opens with its <strong>regional aggregate</strong> — the Bank's published
        subtotal for that region, and in region view the World. It is the line the rows beneath
        it are being read against. It is shown but deliberately excluded from the benchmark
        maths: letting a region's total into the median of its own members would move the very
        line the row exists to illustrate.
      </p>
      <p style={{ fontSize: "14.5px", color: "var(--warm-grey)", borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
        Source: {bundle.source}. Bundle generated {bundle.generated}. Values are each country's
        most recent available observation, which is not always the same year — the year is
        printed beneath every value for that reason.
      </p>
      <p style={{ fontSize: "14.5px", color: "var(--warm-grey)", marginTop: -6 }}>
        Regions are the World Bank's own classification as shipped in the WDI
        metadata. That grouping was revised in 2024 — Pakistan and Afghanistan
        moved out of South Asia into the Middle East, North Africa, Afghanistan
        &amp; Pakistan group, which is why South Asia looks smaller here than it
        once did.
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
          : "Add countries or re-enable a region in the panel on the right."}
      </div>
    </Center>
  );
}
function Center({ children, style }) {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", ...style }}>{children}</div>
  );
}
