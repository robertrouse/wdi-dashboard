/* --------------------------------------------------------------------------
   Sparkline.

   Each line is scaled to its OWN min/max, not to a shared axis. That is the
   point: shape is comparable across metrics even when magnitude is not. A
   country whose life expectancy rose 3 years and one whose GDP rose $2T can
   both be read as "rising" at a glance.

   Consequence the reader must be told (and is, in the tooltip): the vertical
   extent of a sparkline says nothing about the size of the change. Only the
   direction and the shape are comparable. Where a target exists it is drawn as
   a dashed reference line, matching the detail view in the BBOD chapter.
   -------------------------------------------------------------------------- */

export default function Sparkline({
  points,
  width = 168,
  height = 40,
  color = "var(--warm-grey)",
  dotColor,
  target = null,
  showDots = false,
}) {
  if (!points || points.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
              stroke="var(--neutral-grey)" strokeWidth="1.5" strokeDasharray="2 4" />
      </svg>
    );
  }

  const pad = 5;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const vals = target == null ? ys : [...ys, target];
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...vals), y1 = Math.max(...vals);
  const spanX = x1 - x0 || 1;
  const spanY = y1 - y0 || Math.abs(y1) || 1;

  const sx = (x) => pad + ((x - x0) / spanX) * (width - pad * 2);
  const sy = (y) => height - pad - ((y - y0) / spanY) * (height - pad * 2);

  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ");
  const area = `${d} L${sx(x1).toFixed(1)},${height - pad} L${sx(x0).toFixed(1)},${height - pad} Z`;
  const last = points.at(-1);
  const gid = `sg-${Math.round(x0)}-${Math.round(spanY * 1000) % 99999}-${width}`;

  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {target != null && (
        <line x1={pad} y1={sy(target)} x2={width - pad} y2={sy(target)}
              stroke="var(--blue-raven)" strokeWidth="1.25" strokeDasharray="4 3" opacity="0.5" />
      )}
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2.25"
            strokeLinejoin="round" strokeLinecap="round" />
      {showDots && points.map((p, i) => (
        <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="2.25" fill={color} opacity="0.55" />
      ))}
      <circle cx={sx(last[0])} cy={sy(last[1])} r="4"
              fill={dotColor || color} stroke="var(--white)" strokeWidth="1.75" />
    </svg>
  );
}
