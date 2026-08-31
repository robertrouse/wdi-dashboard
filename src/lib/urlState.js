/* ==========================================================================
   The view, in the address bar.

   A dashboard whose whole argument is "change the comparison set and watch
   every glyph re-score" is one people will want to hand each other mid-argument
   — "look at this with the G20 swapped for top-5-per-region". That is only
   possible if the URL carries the view.

   Two rules keep the links short enough to paste into a message:

     · DEFAULTS ARE OMITTED. A fresh load leaves the URL clean, so a link with
       parameters in it is a link somebody actually changed something to make.
     · THE COUNTRY SET IS A PRESET WHERE IT CAN BE. `set=g20` rather than
       nineteen ISO codes; the explicit list only appears once the reader has
       edited the selection away from a named set.

   Everything is validated against the bundle on the way in. A stale link — a
   metric that has since been renamed, a country the Bank has stopped
   publishing — degrades to the default for that one field rather than throwing
   the whole view away.
   ========================================================================== */

export const DEFAULTS = {
  view: "country",
  metric: "gdp",
  set: "g20",
  weak: false,
};

/** Parse the current query string. Returns only what is present and valid. */
export function readUrlState(bundle, presetIds) {
  const q = new URLSearchParams(window.location.search);
  const out = {};

  const view = q.get("view");
  if (view === "country" || view === "region") out.view = view;

  const metric = q.get("metric");
  if (metric && bundle.indicators.some((i) => i.id === metric)) out.metric = metric;

  const set = q.get("set");
  if (set && presetIds.includes(set)) out.set = set;

  // An explicit list wins over a preset: it is the more specific statement.
  const countries = q.get("countries");
  if (countries) {
    const known = new Set(bundle.countries.map((c) => c.c));
    const codes = countries.split(",").map((c) => c.trim().toUpperCase()).filter((c) => known.has(c));
    if (codes.length) { out.countries = codes; out.set = null; }
  }

  const show = q.get("show");
  if (show) {
    const known = new Set(bundle.indicators.map((i) => i.id));
    const ids = show.split(",").map((s) => s.trim()).filter((s) => known.has(s));
    // All of them is the same as none of them; keep the URL and the state honest.
    if (ids.length && ids.length < bundle.indicators.length) out.show = ids;
  }

  if (q.get("weak") === "1") out.weak = true;

  return out;
}

/**
 * Write the view back to the address bar.
 *
 * replaceState, not pushState: these are filter toggles, not navigation, and
 * pushing every checkbox would turn the back button into an undo stack nobody
 * asked for.
 */
export function writeUrlState({ view, metric, set, countries, show, weak, indicatorCount }) {
  const q = new URLSearchParams();

  if (view !== DEFAULTS.view) q.set("view", view);
  if (metric !== DEFAULTS.metric) q.set("metric", metric);

  if (set) {
    if (set !== DEFAULTS.set) q.set("set", set);
  } else if (countries?.length) {
    q.set("countries", countries.join(","));
  }

  if (show && show.length && show.length < indicatorCount) q.set("show", show.join(","));
  if (weak) q.set("weak", "1");

  /* Commas back to literal. URLSearchParams escapes them to %2C, which is
     correct and legal but turns `show=gdp,life,u5mort` into something nobody
     wants to paste into a message. A comma is a permitted query character. */
  const search = q.toString().replace(/%2C/g, ",");
  const url = window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
  window.history.replaceState(null, "", url);
}
