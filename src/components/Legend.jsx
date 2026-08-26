import KpiGlyph from "./KpiGlyph.jsx";
import { PERF } from "../lib/kpi.js";

/* The legend is not decoration — it is the key to the normalization scheme,
   so it sits above the data and is set at readable size, not in fine print. */

const ITEMS = [
  { perf: PERF.STRONG, dev: 0.85, label: "Clearly better", hint: "top of the peer set" },
  { perf: PERF.MID, dev: 0.18, label: "Near the benchmark", hint: "within the middle band" },
  { perf: PERF.WEAK, dev: -0.85, label: "Clearly worse", hint: "bottom of the peer set" },
  { perf: PERF.NEUTRAL, dev: 0, label: "No direction", hint: "bigger is neither good nor bad" },
  { perf: PERF.NONE, dev: 0, label: "No recent data", hint: "not measured lately" },
];

export default function Legend({ benchmarkNote }) {
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
      <div
        style={{
          marginLeft: "auto", fontSize: "14px", color: "var(--warm-grey)",
          maxWidth: 330, lineHeight: 1.35, borderLeft: "2px solid var(--cool-grey)", paddingLeft: 16,
        }}
      >
        {benchmarkNote}
      </div>
    </div>
  );
}
