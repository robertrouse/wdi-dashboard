import { useEffect } from "react";
import { createPortal } from "react-dom";
import KpiGlyph from "./KpiGlyph.jsx";
import { PERF } from "../lib/kpi.js";

/* --------------------------------------------------------------------------
   First-run quick start.

   Terse on purpose. The chapter this dashboard comes from praises the original
   for being figure-out-able without instructions, so a tutorial that has to
   explain the whole thing would be an admission of failure. Four lines: what
   the glyph means, what the sparkline does not mean, that the benchmark moves,
   and where to change things. Everything else stays discoverable on hover.

   Shown once per browser. localStorage can throw outright (Safari private
   mode, blocked site data), so every access is guarded and a failure just
   means the reader sees it again — an annoyance, never a broken page.
   -------------------------------------------------------------------------- */

const SEEN_KEY = "wdi-quickstart-seen-v1";

export function hasSeenQuickStart() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage unavailable — the modal simply shows again next visit */
  }
}

const STEPS = [
  {
    glyph: { perf: PERF.STRONG, deviation: 0.8 },
    title: "The circle is the comparison",
    body: "Filled above the midline means better than the benchmark; below means worse. How much is filled is how far. Every metric uses this one scale, which is what lets a $29T economy and a 2.1% inflation rate be read side by side.",
  },
  {
    glyph: { perf: PERF.NEUTRAL, deviation: -0.6 },
    title: "Grey means no verdict",
    body: "Population and urbanisation are filled the same way — position is still a fact — but they carry no colour, because being more populous than your neighbours is neither good nor bad.",
  },
  {
    glyph: { perf: PERF.NONE, deviation: 0 },
    title: "Numbers stay in their own units",
    body: "The printed value is never rescaled, and the year beneath it is the year that reading is from — often not the same year across countries. Sparklines are scaled to their own range, so shape is comparable but height is not.",
  },
];

export default function QuickStart({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 120,
        background: "rgba(10,16,68,.45)",
        display: "grid", placeItems: "center", padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qs-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--white)", borderRadius: 14, maxWidth: 620, width: "100%",
          maxHeight: "88vh", overflowY: "auto",
          boxShadow: "0 24px 70px rgba(10,16,68,.35)",
        }}
      >
        <div style={{ background: "var(--blue-raven)", color: "var(--white)", padding: "22px 28px" }}>
          <div className="eyebrow" style={{ color: "var(--blue-ice)" }}>Quick start</div>
          <h2 id="qs-title" style={{ fontSize: "27px", lineHeight: 1.15, marginTop: 2 }}>
            Fifteen metrics, one scale
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: "16px", fontWeight: 300, color: "var(--cool-grey)", lineHeight: 1.4 }}>
            These indicators are measured in dollars, percentages, years, rates and
            raw counts. Here is how they are made comparable.
          </p>
        </div>

        <div style={{ padding: "6px 28px 4px" }}>
          {STEPS.map((s) => (
            <div
              key={s.title}
              style={{
                display: "flex", gap: 16, alignItems: "flex-start",
                padding: "18px 0", borderBottom: "1px solid var(--rule)",
              }}
            >
              <div style={{ flexShrink: 0, paddingTop: 2 }}>
                <KpiGlyph perf={s.glyph.perf} deviation={s.glyph.deviation} size={34} />
              </div>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 600, lineHeight: 1.25 }}>{s.title}</div>
                <div style={{ fontSize: "16px", lineHeight: 1.5, color: "var(--ink-soft)", marginTop: 3 }}>
                  {s.body}
                </div>
              </div>
            </div>
          ))}

          <p style={{ fontSize: "16px", lineHeight: 1.5, color: "var(--ink-soft)", padding: "16px 0 4px" }}>
            <strong>Hover a column heading</strong> for what a metric means and how to read
            it. <strong>Click one</strong> to move it into the value, change and trend
            columns. <strong>Click a row</strong> for that country in full. Everything else
            lives under <strong>Filters</strong> — including which countries you are
            comparing, which moves every benchmark on screen.
          </p>
        </div>

        <div style={{ padding: "4px 28px 24px", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            autoFocus
            style={{
              background: "var(--blue-maven)", color: "var(--white)", border: "none",
              borderRadius: 9, padding: "12px 26px", fontSize: "17px", fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Start exploring
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

QuickStart.markSeen = markSeen;
