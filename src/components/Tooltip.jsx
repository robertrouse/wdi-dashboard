import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { excerpt } from "../lib/format.js";
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

/* A touch screen has no hover, so it synthesises one on tap — and this card
   takes the pointer (it has to, so it can be scrolled and its text selected).
   The result on a phone is that the first tap opens a card that then swallows
   the second, which is how a header stops being tappable. On a coarse pointer
   the card is simply not shown: tapping a heading does the thing it advertises
   instead, and the definitions are still reachable in the row detail. */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: coarse)");
    if (!mq) return;
    const on = (e) => setCoarse(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return coarse;
}

export default function Tooltip({ children, content, width = 400, cursor = "help" }) {
  const coarse = useCoarsePointer();
  const [open, setOpen] = useState(false);
  /* No grace period, and the card does not take the pointer. Both existed so
     a long card could be scrolled, which mattered when it carried the Bank's
     full limitations text; it carries a short written summary now. What they
     cost was worth more: crossing fifteen glyph columns, every card lingered
     140ms and the card itself sat under the cursor, so moving to the next icon
     fought the last one. Hover in, hover out, immediately. */
  const hold = () => { if (!coarse) setOpen(true); };
  const release = () => setOpen(false);
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
        onMouseEnter={hold}
        onMouseLeave={release}
        onFocus={hold}
        onBlur={release}
        tabIndex={0}
        style={{ display: "inline-flex", alignItems: "center", cursor: coarse ? "pointer" : cursor, outlineOffset: 3 }}
      >
        {children}
      </span>
      {open && !coarse && content && createPortal(
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
            /* The card is short by construction — a written definition and a
               written caveat, never the Bank's full text — so it does not need
               to scroll and does not take the pointer. The cap is a backstop,
               nothing more. */
            maxHeight: "72vh",
            overflow: "hidden",
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
      {/* The Bank's own definition where it is already short, a written one
          where it runs long or repeats boilerplate — the three GDP entries
          share an opening paragraph and each end by restating that they are in
          current US dollars. Ten of the fifteen are still verbatim here. */}
      <div style={{ fontSize: "15.5px", lineHeight: 1.5, color: "var(--ink-soft)", marginTop: 8 }}>
        {ind.definitionShort || ind.definition}
      </div>
      {/* Only when the World Bank publishes one. Three of the fifteen have no
          "Limitations and exceptions" entry at all, and an empty "Read with
          care ·" was asserting a caveat that does not exist. */}
      {ind.caveat && (() => {
        /* A written summary, not a quotation. The Bank's own limitations text
           runs to 3,295 characters and mechanically excerpting it took whatever
           its opening sentence happened to be, which is not reliably the part
           that matters for reading the metric. These are authored — hence the
           line pointing at the Bank's wording, so nothing here is mistaken for
           it. `caveatShort` is required alongside every `caveat`; the excerpt
           is a fallback so a newly added indicator degrades rather than breaks. */
        const short = ind.caveatShort || excerpt(ind.caveat).text + "…";
        return (
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
            {short}
          </div>
        );
      })()}

      {/* Shown whenever anything on this card is a summary rather than the
          source's text — which is either field, since a caveat is always
          summarised here when one exists. */}
      {(ind.definitionShort || ind.caveat) && (
        <div style={{ marginTop: 9, fontSize: "13.5px", color: "var(--neutral-grey)" }}>
          The Bank’s own wording is in the row detail.
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: "13.5px", color: "var(--neutral-grey)" }}>
        {ind.code} · {ind.periodicity || "Annual"} · higher is{" "}
        {ind.direction === "up" ? "better" : ind.direction === "down" ? "worse" : ind.direction === "band" ? `off-target (aim ≈ ${ind.target}%)` : "neither"}
      </div>
    </div>
  );
}
