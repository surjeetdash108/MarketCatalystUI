"use client";

import { useState } from "react";
import { useTickerSearch } from "./hooks/useTickerSearch";
import { useLivePrices } from "./live-prices";

/**
 * Reusable ticker entry with a LIVE ticker + company-name typeahead
 * (useTickerSearch over the full ~10k-ticker universe). Used by the Watchlist
 * and Portfolio "add" modals so a user can find a stock by name — e.g. typing
 * "apple" surfaces AAPL — instead of having to know the exact symbol
 * (delivery-plan R17: search by ticker AND company name everywhere).
 */
export function TickerSearchInput({
  value,
  onChange,
  onPick,
  placeholder = "Ticker or company name",
  autoFocus,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (ticker: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const results = useTickerSearch(value);
  const show = focused && value.trim().length > 0 && results.length > 0;

  // Live delayed prices for the (at most 8) visible suggestions. Keyed on the
  // stable ticker SET inside the hook, so it only polls while the dropdown is
  // open and re-polls only when the visible set changes — not on every keystroke
  // character. The static `companies` EOD price is the fallback.
  const visible = show ? results.slice(0, 8) : [];
  const snaps = useLivePrices(visible.map((r) => r.ticker));

  return (
    <div style={{ position: "relative" }}>
      <input
        autoFocus={autoFocus}
        style={{
          width: "100%", background: "var(--surface-3)", border: "1px solid var(--border-soft)",
          borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: ".9rem",
        }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setFocused(true); }}
        onFocus={() => setFocused(true)}
        // Delay blur so an onMouseDown pick registers before the list unmounts.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Enter picks the top suggestion if the typed value isn't an exact
            // ticker, otherwise submits as-is.
            const top = results[0];
            if (top && top.ticker.toUpperCase() !== value.trim().toUpperCase()) {
              onPick(top.ticker);
              setFocused(false);
            } else {
              onEnter?.();
            }
          }
        }}
      />
      {show && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 3, zIndex: 30,
          background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 10,
          boxShadow: "0 8px 26px rgba(0,0,0,.4)", overflow: "hidden", maxHeight: 260, overflowY: "auto",
        }}>
          {visible.map((r) => {
            const q = snaps.get(r.ticker.toUpperCase());
            const px = q?.price ?? r.price;
            return (
            <div
              key={r.ticker}
              // Pick the ticker AND close the dropdown, so it stops covering the
              // "Add" button directly below the input (the dropdown is absolutely
              // positioned over it). Without this, the next click lands on the
              // still-open list and re-picks instead of submitting.
              onMouseDown={(e) => { e.preventDefault(); onPick(r.ticker); setFocused(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <span style={{ fontFamily: "var(--f-mono)", fontWeight: 700, color: "var(--text-hi)", fontSize: ".82rem" }}>{r.ticker}</span>
              {r.name && (
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name}
                </span>
              )}
              {px != null && (
                <span style={{ marginLeft: "auto", fontFamily: "var(--f-mono)", fontSize: ".72rem", color: q?.changePct != null ? (q.changePct >= 0 ? "var(--up)" : "var(--down)") : "var(--text-dim-solid)" }}>
                  ${px.toFixed(2)}
                </span>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
