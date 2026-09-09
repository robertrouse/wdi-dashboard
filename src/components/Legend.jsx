import KpiGlyph from "./KpiGlyph.jsx";
import { PERF } from "../lib/kpi.js";

/* The key to the marks, and nothing else.

   Five swatches, five labels, no second line under any of them. The hints that
   used to sit there ("on the good side of it", "within the middle band") were
   restating the label above in more words, which is the one thing a legend
   cannot afford — it is read in passing, at a glance, or not at all.

   "Clearly worse" is drawn BELOW the line because that is the case a reader
   meets most: seven of the fifteen metrics improve as they rise, so worse sits
   low on those, against four where worse sits high. A legend shows the typical
   mark, not the instructive one. That fill and colour are independent is
   taught in the quick start, which has the room to show above-and-good,
   above-and-bad and below-and-good together. */

const ITEMS = [
  { perf: PERF.STRONG,  dev: 0.85,  label: "Clearly better" },
  { perf: PERF.MID,     dev: 0.18,  label: "Near the benchmark" },
  { perf: PERF.WEAK,    dev: -0.85, label: "Clearly worse" },
  { perf: PERF.NEUTRAL, dev: 0.7,   label: "Neutral" },
  { perf: PERF.NONE,    dev: 0,     label: "No recent data" },
];

export default function Legend() {
  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 28px",
        padding: "11px 18px", background: "var(--white)",
        border: "1px solid var(--rule)", borderRadius: "var(--radius)",
        marginBottom: 18,
      }}
    >
      {ITEMS.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <KpiGlyph perf={it.perf} deviation={it.dev} size={26} />
          <span style={{ fontSize: "16px", fontWeight: 500 }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}
