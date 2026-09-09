import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import KpiGlyph from "./KpiGlyph.jsx";
import { PERF } from "../lib/kpi.js";

/* --------------------------------------------------------------------------
   First-run quick start.

   Two blocks: what the icons mean, and what is clickable. Phrases, not
   sentences — a reader dismissing a modal to get at a dashboard does not read
   prose, and the chapter this dashboard comes from praises the original for
   being figure-out-able without instructions. Anything that needs a paragraph
   belongs in a hover card or in "Notes on reading this", not here.

   The icon rows use the real KpiGlyph rather than a picture of one, so what is
   shown here is literally what the reader meets in the table.

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

/* Apple-Tips terse: the swatch carries the colour, so the words carry only the
   meaning. Naming the colour beside a picture of it spends a word to say what
   the reader can already see.

   Position still gets named on the two rows that have one — "above the line",
   "below". Colour is never the only channel in the table, and an explanation
   that leaned on the swatch alone would quietly make it the only channel here. */
/* Shows the combinations, not the channels one at a time. An earlier cut had a
   cerise "Below it" row sitting above a cerise "high, and bad" row: the same
   colour teaching two different lessons, the first of them the old rule this
   convention just replaced. Above-and-good, above-and-bad, below-and-good is
   the minimum set that makes fill and colour visibly independent. */
const ICONS = [
  { perf: PERF.STRONG,  deviation: 0.8,  text: "Above the benchmark, and good" },
  { perf: PERF.WEAK,    deviation: 0.8,  text: "Above, but bad \u2014 where less is better" },
  { perf: PERF.STRONG,  deviation: -0.8, text: "Below, and good" },
  { perf: PERF.NEUTRAL, deviation: 0.7,  text: "Neither better nor worse" },
  { perf: PERF.NONE,    deviation: 0,    text: "No recent data" },
];

const CLICKS = [
  "Hover for metric details",
  "Click a heading to focus it",
  "Click a row for country detail",
  "Filters to change the view",
];

export default function QuickStart({ onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Open at the top, always.
     The dismiss button used to carry autoFocus, and focusing an element scrolls
     it into view — it sits at the BOTTOM of a panel that can overflow, so on a
     short viewport the modal opened already scrolled past its own heading. The
     dialog takes focus instead, with preventScroll, which keeps the keyboard
     entry point inside the modal without moving it. */
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    el.scrollTop = 0;
    el.focus({ preventScroll: true });
  }, []);

  return createPortal(
    <div
      onClick={onClose}
      className="scrim"
      style={{
        zIndex: 120,
        display: "grid", placeItems: "center", padding: 20,
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qs-title"
        onClick={(e) => e.stopPropagation()}
        className="panel-in"
        style={{
          background: "var(--white)", borderRadius: 14, maxWidth: 540, width: "100%",
          maxHeight: "88vh", overflowY: "auto", outline: "none",
          boxShadow: "0 24px 70px rgba(10,16,68,.35)",
        }}
      >
        <div style={{ background: "var(--blue-raven)", color: "var(--white)",
                      padding: "18px 28px 20px", position: "relative" }}>
          {/* Escape, the backdrop and "Start exploring" all dismiss this, but a
              modal with no visible way out still reads as a trap on first
              sight — and first sight is the only time this one is shown. */}
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              position: "absolute", top: 14, right: 14,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, padding: 0,
              background: "transparent", border: "none", borderRadius: 8,
              color: "var(--blue-ice)", cursor: "pointer", lineHeight: 0,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <h2 id="qs-title" style={{ fontSize: "25px", lineHeight: 1.15, paddingRight: 34 }}>
            How to Use This Dashboard
          </h2>
          {/* Says what the reader is looking at, not what is clever about how
              it was built. "Fifteen metrics, one scale" was the latter — a
              description of the technique, which belongs in a write-up about
              the dashboard rather than in the dashboard. Someone opening this
              wants to know it is about countries and how they are doing. */}
          <p style={{ margin: "5px 0 0", fontSize: "16px", fontWeight: 300, color: "var(--cool-grey)" }}>
            How countries and regions compare, across fifteen measures of development.
          </p>
        </div>

        <div style={{ padding: "20px 28px 4px" }}>
          <div className="eyebrow" style={{ color: "var(--blue-maven)" }}>How to read the icons</div>
          <div style={{ marginTop: 10 }}>
            {ICONS.map((r) => (
              <div key={r.text} style={{ display: "flex", alignItems: "center", gap: 14, padding: "6px 0" }}>
                <KpiGlyph perf={r.perf} deviation={r.deviation} size={30} />
                <span style={{ fontSize: "17px", lineHeight: 1.3 }}>{r.text}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "16px", color: "var(--warm-grey)", marginTop: 8, lineHeight: 1.4 }}>
            Fill = position. Colour = verdict. More fill, further away.
          </div>

          <div className="eyebrow" style={{ color: "var(--blue-maven)", marginTop: 24 }}>What to click</div>
          <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
            {CLICKS.map((c) => (
              <li key={c} style={{ display: "flex", gap: 11, padding: "5px 0", fontSize: "17px", lineHeight: 1.3 }}>
                <span aria-hidden="true" style={{ color: "var(--blue-maven)", flexShrink: 0 }}>&bull;</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ padding: "4px 28px 24px", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "var(--blue-maven)", color: "var(--white)", border: "none",
              borderRadius: 9, padding: "12px 26px", fontSize: "17px", fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

QuickStart.markSeen = markSeen;
