import { splitValue, unitGap } from "../lib/format.js";

/* --------------------------------------------------------------------------
   A number and its unit.

   The percent sign is set at the number's own size, weight and face: "3.2%" is
   one token a reader takes in at once, and shrinking the sign turns it into an
   annotation hanging off the figure rather than part of it.

   Every other unit — "per 1,000", "yrs", "t CO₂e" — genuinely IS an
   annotation. It qualifies the number without being part of it, it is words
   rather than a symbol, and at full size it competes with the figure and
   crowds the column ("110.7 per 1,000" set entirely at 22px runs to ~170px).
   Those step down and go grey.
   -------------------------------------------------------------------------- */

export default function Value({
  v, ind,
  size = "var(--t-value)",
  unitSize = "var(--t-small)",
  weight = 500,
  lineHeight = 1.1,
}) {
  const { num, unit } = splitValue(v, ind);
  const isPct = unit === "%";
  const missing = v == null || Number.isNaN(v);

  return (
    /* Line-height is tight on purpose. Kanit's default line box for a 22px
       figure is 33px — eleven pixels of it below the digits — and that slack
       reads as a gap between the number and whatever is captioned under it. */
    <span style={{ whiteSpace: "nowrap", lineHeight,
                   color: missing ? "var(--neutral-grey)" : "var(--ink)" }}>
      <span className="tabular" style={{ fontSize: size, fontWeight: weight }}>{num}</span>
      {unit && (isPct ? (
        // Same size, same weight, same tabular face — closed up against the
        // digits — unitGap() returns nothing for a percent sign.
        <span className="tabular" style={{ fontSize: size, fontWeight: weight }}>
          {unitGap(unit)}{unit}
        </span>
      ) : (
        <span style={{ fontSize: unitSize, fontWeight: 400, color: "var(--warm-grey)", marginLeft: 4 }}>
          {unit}
        </span>
      ))}
    </span>
  );
}
