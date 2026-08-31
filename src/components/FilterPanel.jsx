import { useMemo, useState } from "react";

/* --------------------------------------------------------------------------
   Control rail, as a drawer.

   Carries the same controls as the right-hand filter column of the original
   dashboard — view level, group membership, metric selection, and a "show only
   the ones in trouble" escape hatch.

   There is deliberately no "regions shown" control. Region is how the table is
   GROUPED, not a facet to switch off, and hiding a region silently moved every
   benchmark on screen — the peer median is computed from the visible rows — so
   a control that read as "show less" quietly rescored the whole view. Choosing
   the country set does that job honestly, because changing the set is visibly
   changing the comparison. One structure serving many questions is
   the whole argument of the chapter: every control here changes what the same
   components render rather than switching to a different sheet.

   It sits behind a button rather than permanently on screen because it cost
   318px of width that the glyph matrix wanted — with it open the rightmost
   metric columns fell off into the horizontal scroller. The button carries a
   count of anything set away from its default, so a collapsed panel can never
   hide the fact that the view is filtered.
   -------------------------------------------------------------------------- */

const S = {
  section: { marginBottom: 26 },
  h: {
    fontSize: "13px", fontWeight: 600, letterSpacing: "0.14em",
    textTransform: "uppercase", color: "var(--blue-maven)",
    marginBottom: 10, display: "block",
  },
  radioRow: {
    display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
    cursor: "pointer", fontSize: "16px", lineHeight: 1.3,
  },
  chip: (on) => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 12px", borderRadius: 999, cursor: "pointer",
    fontSize: "14.5px", fontWeight: on ? 500 : 300,
    border: `1.5px solid ${on ? "var(--blue-maven)" : "var(--rule-strong)"}`,
    background: on ? "var(--blue-maven)" : "var(--white)",
    color: on ? "var(--white)" : "var(--ink-soft)",
    transition: "all .12s ease",
  }),
  btn: {
    padding: "6px 10px", fontSize: "14px", borderRadius: 6, cursor: "pointer",
    border: "1.5px solid var(--rule-strong)", background: "var(--white)", color: "var(--ink-soft)",
  },
};

function Radio({ name, value, checked, onChange, label, hint }) {
  return (
    <label style={S.radioRow}>
      <input type="radio" name={name} value={value} checked={checked}
             onChange={() => onChange(value)}
             style={{ accentColor: "var(--blue-maven)", width: 17, height: 17, flexShrink: 0 }} />
      <span>
        <span style={{ fontWeight: checked ? 500 : 300 }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: "13.5px", color: "var(--warm-grey)", lineHeight: 1.3 }}>{hint}</span>}
      </span>
    </label>
  );
}

export default function FilterPanel({
  bundle, view, setView,
  indicators, activeIndicatorIds, toggleIndicator, focusId, setFocus,
  countries, selected, setSelected, onlyWeak, setOnlyWeak, presets, applyPreset, activePreset,
  onClose,
}) {
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);

  /* The address bar already carries the view, but nobody looks there. The
     button is the part that makes it a feature. Clipboard access can be
     refused outright (insecure context, permissions policy), and the honest
     fallback is to say so rather than to claim a copy that did not happen —
     the URL is still there to select by hand. */
  const [copyFailed, setCopyFailed] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  };
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return countries.filter((c) => c.n.toLowerCase().includes(t)).slice(0, 8);
  }, [q, countries]);

  return (
    <aside
      aria-label="Filters"
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 340, maxWidth: "92vw",
        zIndex: 80, background: "var(--white)", borderLeft: "1px solid var(--rule)",
        boxShadow: "-14px 0 44px rgba(10,16,68,.18)",
        padding: "0 24px 60px", overflowY: "auto",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sticky so the way out is always in reach on a long filter list. */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 1, background: "var(--white)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "18px 0 12px", marginBottom: 4,
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <span style={{ fontSize: "19px", fontWeight: 600 }}>Filters</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={copyLink}
          title="Copy a link to this exact view — countries, metric, filters and all"
          style={{
            background: copied ? "var(--blue-maven)" : "transparent",
            border: `1.5px solid ${copied ? "var(--blue-maven)" : "var(--rule-strong)"}`,
            color: copied ? "var(--white)" : "var(--ink)",
            borderRadius: 8, padding: "6px 12px", fontSize: "15px",
            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            transition: "background .12s ease, color .12s ease",
          }}
        >
          {copied ? "Copied" : copyFailed ? "Copy failed" : "Copy link"}
        </button>
        <button
          onClick={onClose}
          aria-label="Close filters"
          style={{
            background: "transparent", border: "1.5px solid var(--rule-strong)",
            borderRadius: 8, padding: "6px 14px", fontSize: "15px",
            color: "var(--ink)", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Done
        </button>
        </div>
      </div>
      {copyFailed && (
        <p style={{ fontSize: "14px", color: "var(--warm-grey)", margin: "0 0 14px", lineHeight: 1.4 }}>
          The browser refused clipboard access — the link is in the address bar.
        </p>
      )}
      {/* First, because it is the control that changes the most and the one
          a reader reaches for again and again — everything else in here is
          set once per session. The column headers set it too, but only for
          metrics currently in the matrix. */}
      <div style={S.section}>
        <span style={S.h}>Focus metric</span>
        <select value={focusId} onChange={(e) => setFocus(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", fontSize: "16px", fontWeight: 500,
            border: "1.5px solid var(--blue-maven)", borderRadius: 8,
            background: "var(--white)", color: "var(--blue-raven)", cursor: "pointer",
          }}>
          {indicators.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
        <p style={{ fontSize: "13.5px", color: "var(--warm-grey)", margin: "8px 0 0", lineHeight: 1.4 }}>
          The focus metric gets the value, change and trend columns. All other
          metrics stay visible as glyphs.
        </p>
      </div>

      <div style={S.section}>
        <span style={S.h}>View level</span>
        <Radio name="view" value="country" checked={view === "country"} onChange={setView}
               label="Countries" hint="One row per country, grouped by region" />
        <Radio name="view" value="region" checked={view === "region"} onChange={setView}
               label="Regions" hint="The World Bank's own published subtotal for each region" />
      </div>

      <div style={S.section}>
        <span style={S.h}>Country set</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
          {presets.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
                    style={S.chip(activePreset === p.id)} title={p.hint}>
              {p.label}
            </button>
          ))}
        </div>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Add a country…"
          style={{
            width: "100%", padding: "9px 12px", fontSize: "15.5px",
            border: "1.5px solid var(--rule-strong)", borderRadius: 8,
            background: "var(--background)",
          }}
        />
        {matches.length > 0 && (
          <div style={{ border: "1px solid var(--rule)", borderRadius: 8, marginTop: 6, overflow: "hidden" }}>
            {matches.map((c) => {
              const on = selected.includes(c.c);
              return (
                <button key={c.c}
                  onClick={() => { setSelected(on ? selected.filter((x) => x !== c.c) : [...selected, c.c]); setQ(""); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                    border: "none", borderBottom: "1px solid var(--rule)",
                    background: on ? "var(--surface-alt)" : "var(--white)",
                    fontSize: "15.5px", cursor: "pointer",
                  }}>
                  {on ? "✓ " : "+ "}{c.n}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: "14px", color: "var(--warm-grey)" }}>
          {selected.length} countries selected
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} style={{ ...S.btn, marginLeft: 8, padding: "3px 8px" }}>clear</button>
          )}
        </div>
      </div>


      <div style={S.section}>
        <span style={S.h}>Metrics in the matrix</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {indicators.map((i) => (
            <button key={i.id} onClick={() => toggleIndicator(i.id)}
                    style={S.chip(activeIndicatorIds.includes(i.id))} title={i.fullName}>
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div style={S.section}>
        <span style={S.h}>Attention filter</span>
        <label style={S.radioRow}>
          <input type="checkbox" checked={onlyWeak} onChange={(e) => setOnlyWeak(e.target.checked)}
                 style={{ accentColor: "var(--red-cerise)", width: 17, height: 17, flexShrink: 0 }} />
          <span>
            <span style={{ fontWeight: onlyWeak ? 500 : 300 }}>Only rows below benchmark</span>
            <span style={{ display: "block", fontSize: "13.5px", color: "var(--warm-grey)", lineHeight: 1.3 }}>
              on the focus metric
            </span>
          </span>
        </label>
      </div>
    </aside>
  );
}
