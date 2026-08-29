/* ==========================================================================
   Links back to the World Bank.

   Every number on this page is somebody else's measurement, and a reader who
   wants to check one should not have to guess where it came from. These build
   the canonical data.worldbank.org URLs.

   `?locations=` takes the 2-CHARACTER code, not the 3-letter one used as the
   series key: BR, not BRA; Z4 for East Asia & Pacific; 1W for the World. The
   bundle carries `iso2` on every country and `aggIso2` for the aggregates for
   exactly this reason.
   ========================================================================== */

const WDI = "https://data.worldbank.org";

/** The Bank's page for one indicator, scoped to one economy where known. */
export function indicatorUrl(ind, iso2) {
  const base = `${WDI}/indicator/${encodeURIComponent(ind.code)}`;
  return iso2 ? `${base}?locations=${encodeURIComponent(iso2)}` : base;
}

/** The Bank's page for one country or aggregate. */
export function economyUrl(iso2) {
  return iso2 ? `${WDI}/country/${encodeURIComponent(iso2)}` : WDI;
}

/** Where the dataset as a whole lives. */
export const DATASET_URL = `${WDI}/products/wdi`;
