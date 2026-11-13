"use client";

import { useState } from "react";
import { useLiveQuotes } from "../live-quotes-context";
import { UP, DN, STEEL, usd, pct } from "./data";
import { formatSavedAt } from "./saved-trades";

/** The part of a saved trade the list needs (the full record lives in `si_trades_<TICKER>`). */
export interface TrackedTrade {
  id: string;
  ticker: string;
  dir: "Bull" | "Bear";
  hz: string;
  target: number;
  stop: number;
  /** ISO time the trade was saved; absent on trades saved by an old build. */
  savedAt?: string;
}

/**
 * Trade Tracker's left column: every trade saved in this browser, so a trader
 * with several can switch between them. A stock can appear more than once (a
 * long and a short, or different horizons), each with the date it was saved.
 * Picking a row opens that trade — and its stock if it is another one — and the
 * row of the open trade is highlighted. The ✕ on a row deletes that trade after
 * an inline "Delete?" confirmation.
 *
 * Prices come from the app-wide live quote poll, the same Map the rest of the
 * screen reads, so a row and the open trade's header never disagree.
 */
export function TrackedTradesList({
  trades,
  activeId,
  onSelect,
  onRemove,
}: {
  trades: TrackedTrade[];
  activeId: string | null;
  onSelect: (trade: TrackedTrade) => void;
  onRemove: (trade: TrackedTrade) => void;
}) {
  const quotes = useLiveQuotes(Array.from(new Set(trades.map(t => t.ticker))));
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    // .si-trk-list (iq.css) sizes it, keeps it under the sticky header while the
    // long detail scrolls, and stacks it above the detail on a narrow screen.
    <nav
      aria-label="Tracked trades"
      className="si-trk-list"
      style={{
        border: "1px solid var(--si-border, #1c2733)",
        background: "var(--si-card, rgba(12, 17, 24, 0.9))",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--si-border, #1c2733)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.16em",
          color: "var(--si-accent, #5980a6)",
        }}
      >
        TRACKED TRADES · {trades.length}
      </div>

      {trades.map(t => {
        const active = t.id === activeId;
        const q = quotes.get(t.ticker);
        const bull = t.dir === "Bull";
        const dirCol = bull ? UP : DN;
        const saved = formatSavedAt(t.savedAt).split(" · ")[0];
        const confirming = confirmId === t.id;
        return (
          <div
            key={t.id}
            style={{
              borderBottom: "1px solid var(--si-border, #1c2733)",
              borderLeft: `2px solid ${active ? STEEL : "transparent"}`,
              background: active ? "rgba(89, 128, 166, 0.16)" : undefined,
            }}
          >
            <button
              type="button"
              className="si-trade-row"
              aria-current={active ? "true" : undefined}
              onClick={() => onSelect(t)}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                rowGap: 4,
                columnGap: 10,
                alignItems: "baseline",
                width: "100%",
                padding: "11px 14px 4px 12px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                color: "var(--si-text-hi, #e8eef4)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700, letterSpacing: "0.04em" }}>
                  {t.ticker}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    padding: "2px 6px",
                    color: dirCol,
                    background: `${dirCol}1f`,
                  }}
                >
                  {bull ? "LONG" : "SHORT"}
                </span>
              </span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, textAlign: "right" }}>
                {q?.price != null ? usd(q.price) : "—"}
              </span>

              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--si-text-mid, #93a1af)" }}>
                {t.hz} · TARGET {usd(t.target)}
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: "right",
                  color: q?.pctChange == null ? "var(--si-text-mid, #93a1af)" : q.pctChange >= 0 ? UP : DN,
                }}
              >
                {q?.pctChange != null ? pct(q.pctChange) : ""}
              </span>
            </button>

            {/* Date saved, and delete. Outside the row button so it is not a button inside a button. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 14px 9px 12px", minHeight: 24 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", color: "var(--si-text-mid, #93a1af)" }}>
                {saved ? `SAVED ${saved.toUpperCase()}` : "SAVED EARLIER"}
              </span>
              {confirming ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.06em" }}>
                  <span style={{ color: "#ffd2d2" }}>DELETE?</span>
                  <button
                    type="button"
                    onClick={() => { setConfirmId(null); onRemove(t); }}
                    style={{ padding: "1px 8px", border: "none", background: "#f05656", color: "#fff", fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    style={{ padding: "1px 8px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-mid, #93a1af)", fontFamily: "inherit", fontSize: 10, cursor: "pointer" }}
                  >
                    NO
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Delete ${t.ticker} ${bull ? "long" : "short"} trade`}
                  title="Delete this trade"
                  onClick={() => setConfirmId(t.id)}
                  style={{ padding: "1px 8px", border: "1px solid rgba(240,86,86,0.4)", background: "transparent", color: "#f08a8a", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.06em", cursor: "pointer" }}
                >
                  ✕ DELETE
                </button>
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
