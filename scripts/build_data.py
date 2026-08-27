#!/usr/bin/env python3
"""
Build the dashboard's data bundle from the World Bank bulk WDI extract.

This is the *seed* path, used when a local copy of the bulk CSV is available.
The recurring refresh path is scripts/refresh_data.mjs, which pulls the same
shape from the World Bank REST API.

    python3 scripts/build_data.py --tall ../WDI_CSV_tall.csv \
        --country ../WDI_EXCEL_Country_prepared.csv \
        --out public/data/wdi.json

Output shape (deliberately compact - this file ships to the browser):

    {
      "generated": "2026-08-26",
      "yearSpan": [2015, 2024],
      "regions":     ["East Asia & Pacific", ...],
      "regionCodes": ["EAS", ...],          # parallel to regions; None if unmapped
      "indicators": [ ...contents of data/indicators.json... ],
      "countries":  [{"c":"USA","n":"United States","r":0,"i":"High income"}, ...],
      "series": {
         "USA": { "gdp": {"y": 2024, "v": 29184890000000, "p": 27720700000000,
                          "t": [[2015, 18...], ...] }, ... }
      },
      "regionSeries": {                     # the Bank's own regional subtotals
         "EAS": { "gdp": {"y": 2025, "v": 33657..., ...}, ... }
      },
      "worldSeries": { "gdp": {...}, ... }   # WLD; the reference a REGION row's
                                             # sparkline is drawn against
    }

    y = year of most recent observation      p = previous observation's value
    v = most recent value                    t = [year, value] trend pairs

`regionSeries` records have exactly the same shape as country records. They are
the OFFICIAL World Bank aggregates, not anything this script computes: each
indicator is aggregated the way that indicator should be (a sum for population,
a population-weighted average for life expectancy, UNODC's method for
homicides), which no single roll-up rule of ours could reproduce.
"""
import argparse, csv, json, sys
from datetime import date
from pathlib import Path

TREND_YEARS = 10          # length of the sparkline window
MAX_STALENESS = 8         # ignore a "latest" observation older than this many years

def load_indicators(path):
    return json.loads(Path(path).read_text(encoding="utf8"))

def norm(s):
    """Collapse whitespace so region labels compare equal across data vintages."""
    return " ".join(str(s or "").split())

def load_regions(path):
    """Region label -> official World Bank aggregate code.

    See data/regions.json for why this is a list of accepted names rather than
    a single one.
    """
    spec = json.loads(Path(path).read_text(encoding="utf8"))
    by_name = {}
    for agg in spec["aggregates"]:
        for n in agg["names"]:
            by_name[norm(n)] = agg["code"]
    world = (spec.get("world") or {}).get("code")
    return by_name, [a["code"] for a in spec["aggregates"]], world

def load_countries(path):
    rows = []
    with open(path, encoding="utf8", newline="") as f:
        for r in csv.DictReader(f):
            if (r.get("Region") or "").strip():        # blank Region == aggregate, not a country
                rows.append({
                    "c": r["Country Code"],
                    "n": r["Country Name"],
                    "region": r["Region"],
                    "i": (r.get("Income Group") or "").strip(),
                    "iso2": (r.get("2-alpha code") or "").strip(),
                })
    return rows

def scan_tall(tall_path, wanted_codes, country_codes, min_year):
    """Single streaming pass over the (very large) tall CSV.

    Returns {country_code: {indicator_code: {year: value}}}. The file is 1+ GB,
    so it is never read into memory whole and rows are discarded as early as
    possible. `country_codes` includes the official regional aggregate codes,
    so the region benchmarks come out of the same single pass.
    """
    obs = {}
    csv.field_size_limit(10_000_000)
    with open(tall_path, encoding="utf8", newline="") as f:
        rdr = csv.reader(f)
        header = next(rdr, None)
        for row in rdr:
            if len(row) < 8:
                continue
            cc, icode, yr, val = row[2], row[4], row[5], row[7]
            if icode not in wanted_codes or cc not in country_codes:
                continue
            try:
                y = int(yr); v = float(val)
            except ValueError:
                continue
            if y < min_year:
                continue
            obs.setdefault(cc, {}).setdefault(icode, {})[y] = v
    return obs

def condense(by_year, latest_year):
    """Turn {year: value} into the compact latest / previous / trend record."""
    if not by_year:
        return None
    years = sorted(by_year)
    y = years[-1]
    if latest_year - y > MAX_STALENESS:
        return None
    prev = years[-2] if len(years) > 1 else None
    window = [yy for yy in years if yy > y - TREND_YEARS]
    return {
        "y": y,
        "v": round(by_year[y], 6),
        "p": round(by_year[prev], 6) if prev is not None else None,
        "py": prev,
        "t": [[yy, round(by_year[yy], 6)] for yy in window],
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tall", required=True)
    ap.add_argument("--country", required=True)
    ap.add_argument("--indicators", default="data/indicators.json")
    ap.add_argument("--regions", default="data/regions.json")
    ap.add_argument("--out", default="public/data/wdi.json")
    ap.add_argument("--min-year", type=int, default=2010)
    a = ap.parse_args()

    inds = load_indicators(a.indicators)
    code2id = {i["code"]: i["id"] for i in inds}
    countries = load_countries(a.country)
    ccodes = {c["c"] for c in countries}
    agg_by_name, agg_codes, world_code = load_regions(a.regions)
    pull = set(agg_codes) | ({world_code} if world_code else set())

    print(f"[build] scanning {a.tall} …", file=sys.stderr)
    obs = scan_tall(a.tall, set(code2id), ccodes | pull, a.min_year)
    agg_obs = {k: obs.pop(k) for k in pull if k in obs}
    print(f"[build] {len(obs)} countries carry at least one selected indicator", file=sys.stderr)

    latest_year = max(
        (yy for per_c in obs.values() for per_i in per_c.values() for yy in per_i),
        default=date.today().year,
    )

    series, kept = {}, []
    for c in countries:
        per_c = obs.get(c["c"])
        if not per_c:
            continue
        rec = {}
        for code, by_year in per_c.items():
            cond = condense(by_year, latest_year)
            if cond:
                rec[code2id[code]] = cond
        if rec:
            series[c["c"]] = rec
            kept.append(c)

    regions = sorted({c["region"] for c in kept})
    ridx = {r: i for i, r in enumerate(regions)}

    # Parallel to `regions`: the official aggregate code for each, or None if
    # the region has no published subtotal (that region then reads NA, never a
    # silently substituted figure computed some other way).
    region_codes = [agg_by_name.get(norm(r)) for r in regions]
    for r, code in zip(regions, region_codes):
        if not code:
            print(f"[build] WARNING: no official aggregate mapped for region {r!r}", file=sys.stderr)

    region_series = {}
    for code in filter(None, region_codes):
        per = agg_obs.get(code)
        if not per:
            print(f"[build] WARNING: no observations for aggregate {code}", file=sys.stderr)
            continue
        rec = {}
        for icode, by_year in per.items():
            cond = condense(by_year, latest_year)
            if cond:
                rec[code2id[icode]] = cond
        region_series[code] = rec
    # The World aggregate: the reference a REGION row is drawn against, the way
    # a country row is drawn against its region. Not a region, so not a row.
    world_series = {}
    if world_code:
        per = agg_obs.get(world_code)
        if per:
            for icode, by_year in per.items():
                cond = condense(by_year, latest_year)
                if cond:
                    world_series[code2id[icode]] = cond
        else:
            print(f"[build] WARNING: no observations for the world aggregate {world_code}", file=sys.stderr)

    print("[build] regional aggregates: " + " ".join(
        f"{c or '??'}={len(region_series.get(c, {}))}" for c in region_codes
    ) + f" world={len(world_series)} of {len(inds)} indicators", file=sys.stderr)

    bundle = {
        "generated": date.today().isoformat(),
        "source": "World Bank World Development Indicators (bulk CSV extract)",
        "yearSpan": [latest_year - TREND_YEARS + 1, latest_year],
        "regions": regions,
        "regionCodes": region_codes,
        "indicators": inds,
        "countries": [{"c": c["c"], "n": c["n"], "r": ridx[c["region"]],
                       "i": c["i"], "iso2": c["iso2"]} for c in kept],
        "series": series,
        "regionSeries": region_series,
        "worldSeries": world_series,
    }

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, separators=(",", ":"), ensure_ascii=False), encoding="utf8")
    kb = out.stat().st_size / 1024
    print(f"[build] wrote {out} — {len(kept)} countries × {len(inds)} indicators, {kb:.0f} KB", file=sys.stderr)

if __name__ == "__main__":
    main()
