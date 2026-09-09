import KpiGlyph from "./KpiGlyph.jsx";
import { PERF } from "../lib/kpi.js";

/* The legend is not decoration — it is the key to the normalization scheme,
   so it sits above the data and is set at readable size, not in fine print.

   It used to carry a running note about the current focus metric's benchmark
   ("Inflation is scored against an explicit target of 2%…"). That is gone: it
   changed on every metric switch, restated what the column header and the row
   tooltips already say, and was the tallest thing in the bar. What remains is
   the part a reader cannot get anywhere else — what the glyph shapes mean. */

/* The "clearly worse" swatch is drawn BELOW the line because that is the case
   a reader meets most: seven of the fifteen metrics improve as they rise, so
   worse sits low on those, against four where worse sits high. A legend should
   show the typical mark, not the instructive one — the quick start already
   teaches that fill and colour are independent, and does it properly by
   showing above-and-good, above-and-bad and below-and-good together. Teaching
   it twice, in the strip that has room for five words, only muddles it. */
const ITEMS = [
  { perf: PERF.STRONG, dev: 0.85, label: "Clearly better", hint: "on the good side of it" },
  { perf: PERF.MID, dev: 0.18, label: "Near the benchmark", hint: "within the middle band" },
  { perf: PERF.WEAK, dev: -0.85, label: "Clearly worse", hint: "on the bad side of it" },
  { perf: PERF.NEUTRAL, dev: 0.7, label: "Neutral", hint: "neither end is better" },
  { perf: PERF.NONE, dev: 0, label: "No recent data", hint: "not measured lately" },
];

export default function Legend() {
  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 26px",
        padding: "14px 18px", background: "var(--white)",
        border: "1px solid var(--rule)", borderRadius: "var(--radius)",
        marginBottom: 22,
      }}
    >
      {ITEMS.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <KpiGlyph perf={it.perf} deviation={it.dev} size={26} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: "15.5px", fontWeight: 500 }}>{it.label}</div>
            <div style={{ fontSize: "13px", color: "var(--warm-grey)" }}>{it.hint}</div>
          </div>
        </div>
      ))}
      <div style={{ fontSize: "14px", color: "var(--warm-grey)", lineHeight: 1.3,
                    borderLeft: "2px solid var(--rule)", paddingLeft: 14 }}>
        Fill shows where the value sits.<br />Colour says whether that is good.
      </div>
    </div>
  );
}
