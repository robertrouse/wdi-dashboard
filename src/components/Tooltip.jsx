import { useState, useRef, useLayoutEffect } from "react";

/* --------------------------------------------------------------------------
   Hover card.

   In the BBOD chapter, hovering a KPI surfaces its definition and the caveats
   that govern how it should be read. That is doing real work here: "adult
   literacy, 2018" and "adult literacy, 2024" sit in the same column, and the
   only place a reader can learn that the column mixes vintages is the tooltip.

   Rendered wide with body-size type — a definition set in 11px is a definition
   nobody reads.
   -------------------------------------------------------------------------- */

export default function Tooltip({ children, content, width = 400 }) {
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
        style={{ display: "inline-flex", alignItems: "center", cursor: "help", outlineOffset: 3 }}
      >
        {children}
      </span>
      {open && content && (
        <div
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.place === "below" ? pos.top : undefined,
            bottom: pos.place === "above" ? window.innerHeight - pos.top : undefined,
            width,
            zIndex: 60,
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
        </div>
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
