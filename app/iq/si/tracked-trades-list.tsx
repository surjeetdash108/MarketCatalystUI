"use client";

import { useLiveQuotes } from "../live-quotes-context";
import { UP, DN, STEEL, usd, pct } from "./data";

/** The part of a saved trade the list needs (the full record lives in `si_thesis_<TICKER>`). */
export interface TrackedTrade {
  ticker: string;
  dir: "Bull" | "Bear";
  hz: string;
  target: number;
  stop: number;
}

/**
 * Trade Tracker's left column: every trade saved in this browser, one per
 * stock, so a trader with several can switch between them. Picking a row opens
 * that stock — the tracker's detail on the right follows the open stock — and
 * the row for the open stock is highlighted.
 *
 * Prices come from the app-wide live quote poll, the same Map the rest of the
 * screen reads, so a row and the open trade's header never disagree.
 */
export function TrackedTradesList({
  trades,
  activeTicker,
  onSelect,
}: {
  trades: TrackedTrade[];
  activeTicker: string | null;
  onSelect: (ticker: string) => void;
}) {
  const quotes = useLiveQuotes(trades.map(t => t.ticker));

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
        const active = t.ticker === activeTicker;
        const q = quotes.get(t.ticker);
        const bull = t.dir === "Bull";
        const dirCol = bull ? UP : DN;
        return (
          <button
            key={t.ticker}
            type="button"
            className="si-trade-row"
            aria-current={active ? "true" : undefined}
            onClick={() => onSelect(t.ticker)}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              rowGap: 4,
              columnGap: 10,
              alignItems: "baseline",
              width: "100%",
              padding: "11px 14px 11px 12px",
              border: "none",
              borderBottom: "1px solid var(--si-border, #1c2733)",
              borderLeft: `2px solid ${active ? STEEL : "transparent"}`,
              background: active ? "rgba(89, 128, 166, 0.16)" : undefined,
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
        );
      })}
    </nav>
  );
}
