/* --------------------------------------------------------------------------
   Change since the previous measurement.

   Two independent facts are shown at once, because they come apart: the arrow
   points the way the NUMBER moved, and the colour says whether that movement
   was GOOD. Falling under-5 mortality is a down arrow in blue; falling life
   expectancy is a down arrow in cerise. Readers who ignore colour still get the
   direction; readers who ignore the arrow still get the judgement.

   The magnitude is a PERCENTAGE CHANGE for every metric except those already
   measured in percent, which report percentage POINTS instead — a percent
   change of a percent is a well-known way to mislead ("unemployment up 10%"
   when it moved from 4.0% to 4.4%).

   One rule for everything else is the point: a Change column that mixes
   "+$520", "+0.3 yrs" and "−1.2 per 1,000" cannot be read down, and this
   dashboard exists to argue that normalising the comparison is what makes
   incompatible units legible. Percent change is that normalisation.
   -------------------------------------------------------------------------- */

/* Sized to sit level with the KPI value it belongs to. The change is not
   secondary information — "how did it move" is half of what this dashboard is
   asked, so it is set at the same weight as "where is it now" rather than
   whispered underneath. */
export default function DeltaArrow({ d, ind, showLabel = true, size = 20, fontSize = "var(--t-value)" }) {
  // No previous reading at all is a different statement from "it did not move".
  if (!d || d.abs == null) {
    return <span style={{ color: "var(--neutral-grey)", fontSize }}>—</span>;
  }

  const color =
    d.favorable === true  ? "var(--blue-maven)" :
    d.favorable === false ? "var(--red-cerise)" :
                            "var(--warm-grey)";

  // Driven by the glossary, never hard-coded per indicator.
  const sign = d.abs >= 0 ? "+" : "\u2212";
  const mag = Math.abs(d.abs);
  const nativeDelta = () => {
    const body = mag >= 1000 ? Math.round(mag).toLocaleString("en-US") : mag.toFixed(ind.decimals);
    return `${sign}${ind.prefix ?? ""}${body}${ind.suffix ? " " + ind.suffix : ""}`;
  };

  let text, shown;
  if (ind.suffix === "%") {
    // Already a percentage: report points.
    const digits = mag >= 10 ? 1 : ind.decimals;
    shown = Number(mag.toFixed(digits));
    text = `${sign}${mag.toFixed(digits)} pts`;
  } else if (d.pct == null || d.p === 0 || (d.p != null && d.v != null && Math.sign(d.p) !== Math.sign(d.v))) {
    // Percent change needs a stable, same-signed baseline. Net migration
    // crosses zero, and "+150%" for a swing from −100k to +50k is not a fact
    // about migration — it is an artefact of dividing by a negative. Those
    // rare rows fall back to the change in native units.
    const digits = mag >= 1000 ? 0 : ind.decimals;
    shown = Number(mag.toFixed(digits));
    text = nativeDelta();
  } else {
    const a = Math.abs(d.pct);
    const digits = a >= 10 ? 0 : 1;
    shown = Number(a.toFixed(digits));
    text = `${d.pct >= 0 ? "+" : "\u2212"}${a.toFixed(digits)}%`;
  }

  // A delta that rounds away to zero at the displayed precision is not a change;
  // printing "−0.0%" beside a coloured arrow claims movement that is not there.
  // Checked on the rounded number rather than by pattern-matching the string,
  // which is how "−0.0%" slipped through once the unit moved to the end.
  if (shown === 0) {
    return (
      // Set a step down: "no change" is a sentence, not a number, and at full
      // value size it shouted louder than the movements around it.
      <span style={{ color: "var(--warm-grey)", fontSize: "var(--t-small)", whiteSpace: "nowrap" }}>
        no change
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color, fontWeight: 500, whiteSpace: "nowrap" }}>
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path
          d={d.dir > 0 ? "M8 2.5 L13.5 9.5 L9.6 9.5 L9.6 13.5 L6.4 13.5 L6.4 9.5 L2.5 9.5 Z"
                       : "M8 13.5 L2.5 6.5 L6.4 6.5 L6.4 2.5 L9.6 2.5 L9.6 6.5 L13.5 6.5 Z"}
          fill={color}
        />
      </svg>
      {showLabel && <span className="tabular" style={{ fontSize }}>{text}</span>}
    </span>
  );
}
