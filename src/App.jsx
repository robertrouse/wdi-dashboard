import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import Legend from "./components/Legend.jsx";
import Matrix from "./components/Matrix.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import FilterPanel from "./components/FilterPanel.jsx";
import { buildScalesFromRows, regionRecord, score, PERF } from "./lib/kpi.js";
import { formatValue } from "./lib/format.js";

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
      sub: byCode[c].i,
      region: byCode[c].r,
      get: (id) => bundle.series[c]?.[id] ?? null,
    }));
  }, [bundle, view, visibleCodes, byCode, focus, indicators, activeRegions]);

  const scales = useMemo(
    () => buildScalesFromRows(dataRows, indicators),
    [dataRows, indicators]
  );

  const rows = useMemo(() => {
    if (!focus) return [];

    const keep = (r) => {
      if (!onlyWeak) return true;
      const s = score(r.get(focus.id), focus, scales[focus.id]);
      return s.perf === PERF.WEAK || s.perf === PERF.NONE;
    };

    if (view === "region") return dataRows.filter(keep);

    const byRegion = new Map();
    for (const r of dataRows.filter(keep)) {
      if (!byRegion.has(r.region)) byRegion.set(r.region, []);
      byRegion.get(r.region).push(r);
    }

    const out = [];
    const ordered = [...byRegion.entries()].sort((a, b) =>
      bundle.regions[a[0]].localeCompare(bundle.regions[b[0]])
    );
    for (const [ri, kids] of ordered) {
      // Within a region, rank by the focus metric so the best and worst
      // performers sit at the ends rather than in alphabetical noise.
      kids.sort((a, b) => {
        // Target-band metrics have no meaningful high-to-low order — 0.2% and
        // 12% inflation are both off a 2% target — so they sort by score.
        if (focus.direction === "band") {
          const ag = score(a.get(focus.id), focus, scales[focus.id]).goodness ?? -1;
          const bg = score(b.get(focus.id), focus, scales[focus.id]).goodness ?? -1;
          return bg - ag;
        }
        const av = a.get(focus.id)?.v ?? -Infinity;
        const bv = b.get(focus.id)?.v ?? -Infinity;
        return focus.direction === "down" ? av - bv : bv - av;
      });
      out.push({ kind: "groupHeader", label: bundle.regions[ri], count: kids.length });
      out.push(...kids);
    }
    return out;
  }, [dataRows, view, focus, onlyWeak, scales, bundle]);

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

  const scale = scales[focus.id];
  const rowCount = rows.filter((r) => r.kind !== "groupHeader").length;
  const benchmarkNote =
    focus.direction === "band"
      ? `${focus.label} is scored against an explicit target of ${focus.target}% — the only indicator here that has one.`
      : scale?.benchmark != null
      ? view === "region"
        // Region rows are the Bank's published subtotals, so they do not move
        // with the country filter. Only which regions are shown does.
        ? `Rows are the World Bank's own regional aggregates. Glyphs compare each to the median of the ${rowCount} regions on screen — ${formatValue(scale.benchmark, focus)} for ${focus.label}. Show or hide a region and the benchmark moves; filtering countries does not change what a region reports.`
        : `Glyphs compare each row to the median of the ${rowCount} countries on screen — ${formatValue(scale.benchmark, focus)} for ${focus.label}. Change the selection and the benchmark moves with it.`
      : "No benchmark available for the current selection.";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        <Header bundle={bundle} countryCount={visibleCodes.length} indicatorCount={activeInds.length} />

        <div style={{ padding: "26px 34px 70px" }}>
          <Legend benchmarkNote={benchmarkNote} />

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
            />
          )}

          {detailRow && (
            <DetailPanel
              row={detailRow}
              indicators={indicators}
              scales={scales}
              bundle={bundle}
              onClose={() => setDetailRowId(null)}
            />
          )}

          <Method bundle={bundle} />
        </div>
      </main>

      <FilterPanel
        bundle={bundle}
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
