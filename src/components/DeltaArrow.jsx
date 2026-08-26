/* --------------------------------------------------------------------------
   Change since the previous measurement.

   Two independent facts are shown at once, because they come apart: the arrow
   points the way the NUMBER moved, and the colour says whether that movement
   was GOOD. Falling under-5 mortality is a down arrow in blue; falling life
   expectancy is a down arrow in cerise. Readers who ignore colour still get the
   direction; readers who ignore the arrow still get the judgement.

   Rate-type indicators (anything already in %) report change in percentage
   points, since a percent change of a percent is a well-known way to mislead.
   -------------------------------------------------------------------------- */

export default function DeltaArrow({ d, ind, showLabel = true, size = 15 }) {
  if (!d || d.dir === 0 || d.abs == null) {
    return <span style={{ color: "var(--neutral-grey)", fontSize: "var(--t-small)" }}>—</span>;
  }

  const color =
    d.favorable === true  ? "var(--blue-maven)" :
    d.favorable === false ? "var(--red-cerise)" :
                            "var(--warm-grey)";

  // How a change is best expressed depends on the metric's own units, so the
  // rule is driven by the glossary rather than hard-coded per indicator:
  //   rates (%)          -> percentage points, never "percent of a percent"
  //   huge counts ($, #) -> percent change, because the raw delta is unreadable
  //   everything else    -> the delta in its own units, with its own prefix
  const sign = d.abs >= 0 ? "+" : "\u2212";
  const mag = Math.abs(d.abs);
  let text;
  if (ind.suffix === "%") {
    text = `${sign}${mag.toFixed(mag >= 10 ? 1 : ind.decimals)} pts`;
  } else if (ind.scale === "compact" && d.pct != null) {
    text = `${d.pct >= 0 ? "+" : "\u2212"}${Math.abs(d.pct).toFixed(Math.abs(d.pct) >= 10 ? 0 : 1)}%`;
  } else {
    const body = mag >= 1000 ? Math.round(mag).toLocaleString("en-US") : mag.toFixed(ind.decimals);
    text = `${sign}${ind.prefix ?? ""}${body}${ind.suffix ? " " + ind.suffix : ""}`;
  }

  // A delta that rounds away to zero at the displayed precision is not a change;
  // printing "+0.0" with a coloured arrow claims movement that is not there.
  if (/^[+\u2212][^\d]*0(\.0+)?( |$)/.test(text)) {
    return (
      <span style={{ color: "var(--warm-grey)", fontSize: "var(--t-small)" }}>
        no change
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color, fontWeight: 500, whiteSpace: "nowrap" }}>
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path
          d={d.dir > 0 ? "M8 2.5 L13.5 9.5 L9.6 9.5 L9.6 13.5 L6.4 13.5 L6.4 9.5 L2.5 9.5 Z"
                       : "M8 13.5 L2.5 6.5 L6.4 6.5 L6.4 2.5 L9.6 2.5 L9.6 6.5 L13.5 6.5 Z"}
          fill={color}
        />
      </svg>
      {showLabel && <span className="tabular" style={{ fontSize: "var(--t-small)" }}>{text}</span>}
    </span>
  );
}
