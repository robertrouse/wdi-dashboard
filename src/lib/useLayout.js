import { useEffect, useState } from "react";

/* --------------------------------------------------------------------------
   Which layout the viewport can carry.

   Breakpoints are measured, not guessed. Rendered at its natural minimum the
   full table is 1214px wide — fifteen 44px glyph columns plus country, value,
   change and a 168px sparkline — and with 24px of page padding either side it
   needs 1262px before it stops being a horizontal scroll. A horizontal scroll
   is the one thing this table must never be, because scanning ACROSS a row is
   the whole reading.

   So LG sits at 1280, the first common screen width that clears 1262.

   MD keeps the matrix and gives up the sparkline instead. The trend line and
   the wider country, value and change columns are worth ~250px between them,
   which buys the glyph matrix another 270px of range — enough to cover 1024
   and 1152 laptops and iPad landscape, where dropping fifteen columns to save
   one sparkline would be a bad trade.

   Below 1010 the matrix is dropped rather than squeezed. The focus metric
   columns still answer "how is this doing?" for one metric at a time, and the
   metric picker in the drawer becomes the way to move between them — slower
   than fifteen columns at a glance, but honest, where a sideways scrollbar
   hides two-thirds of the data and does not admit it.

   Below 560 the sparkline goes too: country, value and change fit a phone at
   readable sizes, and a trend line does not.

   Measured clean at 375px and up. A 320px viewport (iPhone SE, 2016) still
   overflows by ~26px, which is the width of the country and value columns at
   their readable floor — a small nudge, not a hidden table.
   -------------------------------------------------------------------------- */

export const LG = "lg";   // full matrix + trend
export const MD = "md";   // full matrix, no trend
export const SM = "sm";   // focus columns + trend
export const XS = "xs";   // focus columns only

export default function useLayout() {
  const get = () =>
    typeof window === "undefined" ? LG
      : window.innerWidth >= 1280 ? LG
      : window.innerWidth >= 1010 ? MD
      : window.innerWidth >= 560 ? SM
      : XS;

  const [layout, setLayout] = useState(get);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setLayout(get()));
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(frame); };
  }, []);

  return layout;
}
