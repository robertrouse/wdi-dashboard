import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

/* --------------------------------------------------------------------------
   Hover card.

   In the BBOD chapter, hovering a KPI surfaces its definition and the caveats
   that govern how it should be read. That is doing real work here: "adult
   literacy, 2018" and "adult literacy, 2024" sit in the same column, and the
   only place a reader can learn that the column mixes vintages is the tooltip.

   Rendered wide with body-size type — a definition set in 11px is a definition
   nobody reads.

   PORTALLED TO document.body, and that is not optional. The card is
   position:fixed, but a fixed element is still confined to the nearest
   ancestor that creates a stacking context, and the matrix's sticky <thead>
   (position:sticky, z-index:3) is exactly that. Rendered in place, the whole
   tooltip painted at the header's z-index of 3 no matter what z-index it
   carried itself, so the rows below and the filter drawer covered it. A
   portal moves it out of that context entirely; the z-index below then means
   what it says.
   -------------------------------------------------------------------------- */

// Above the filter drawer (80) and the detail modal (90): a tooltip is the
// topmost thing on screen whenever it is open, including inside those.
const TOOLTIP_Z = 200;

export default function Tooltip({ children, content, width = 400, cursor = "help" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, place: "below" });
  const anchorRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const margin = 12;
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    const below = window.innerHeight - r.bottom > 260;
    setPos({ left, top: below ? r.bottom + 8 : r.top - 8, place: below ? "below" : "above" });
  }, [open, width]);

  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        style={{ display: "inline-flex", alignItems: "center", cursor, outlineOffset: 3 }}
      >
        {children}
      </span>
      {open && content && createPortal(
        <div
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.place === "below" ? pos.top : undefined,
            bottom: pos.place === "above" ? window.innerHeight - pos.top : undefined,
            width,
            zIndex: TOOLTIP_Z,
            background: "var(--white)",
            color: "var(--ink)",
            border: "1px solid var(--rule-strong)",
            borderTop: "4px solid var(--blue-maven)",
            borderRadius: "var(--radius)",
            boxShadow: "0 12px 40px rgba(10,16,68,.20)",
            padding: "16px 18px 18px",
            pointerEvents: "none",
            textAlign: "left",
            fontWeight: 300,
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}

/** Standard body for an indicator hover card. */
export function IndicatorCard({ ind, extra }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 2 }}>{ind.group}</div>
      <div style={{ fontWeight: 600, fontSize: "19px", lineHeight: 1.25, marginBottom: 8 }}>
        {ind.fullName}
      </div>
      {extra}
      <div style={{ fontSize: "15.5px", lineHeight: 1.5, color: "var(--ink-soft)", marginTop: 8 }}>
        {ind.definition}
      </div>
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--rule)",
          fontSize: "15px",
          lineHeight: 1.45,
          color: "var(--warm-grey)",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--red-cerise)" }}>Read with care · </span>
        {ind.caveat}
      </div>
      <div style={{ marginTop: 10, fontSize: "13.5px", color: "var(--neutral-grey)" }}>
        {ind.code} · {ind.periodicity || "Annual"} · higher is{" "}
        {ind.direction === "up" ? "better" : ind.direction === "down" ? "worse" : ind.direction === "band" ? `off-target (aim ≈ ${ind.target}%)` : "neither"}
      </div>
    </div>
  );
}
