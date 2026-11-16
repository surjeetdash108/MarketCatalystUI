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
  /** Price when the trade was saved; absent on trades saved by an old build. */
  entryPx?: number | null;
  /** ISO time the trade was saved; absent on trades saved by an old build. */
  savedAt?: string;
}

export type TradeSort = "newest" | "oldest" | "most" | "least";

/** Each row is about this tall, and the list scrolls after this many rows. */
const ROW_HEIGHT = 160;
const VISIBLE_ROWS = 5;

/** Profit on the trade so far, in % of the entry price and in the direction of the trade. Null without an entry or a live price. */
export function tradeProfitPct(trade: Pick<TrackedTrade, "entryPx" | "dir">, price: number | null | undefined): number | null {
  if (trade.entryPx == null || !(trade.entryPx > 0) || price == null) return null;
  return ((price - trade.entryPx) / trade.entryPx) * 100 * (trade.dir === "Bull" ? 1 : -1);
}

/**
 * Orders the trades for the list. Newest and oldest go by the time saved (trades
 * from an old build have none and count as the oldest); "most" and "least"
 * profitable go by the profit so far, and a trade with no profit figure always
 * sorts below the ones that have one.
 */
export function sortTrades(trades: TrackedTrade[], mode: TradeSort, priceOf: (ticker: string) => number | null | undefined): TrackedTrade[] {
  const savedMs = (t: TrackedTrade) => {
    const ms = t.savedAt ? Date.parse(t.savedAt) : NaN;
    return Number.isNaN(ms) ? 0 : ms;
  };
  return [...trades].sort((a, b) => {
    if (mode === "newest") return savedMs(b) - savedMs(a);
    if (mode === "oldest") return savedMs(a) - savedMs(b);
    const pa = tradeProfitPct(a, priceOf(a.ticker));
    const pb = tradeProfitPct(b, priceOf(b.ticker));
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return mode === "most" ? pb - pa : pa - pb;
  });
}

/**
 * Trade Tracker's left column: every trade saved in this browser, so a trader
 * with several can switch between them. A stock can appear more than once (a
 * long and a short, or different horizons), each with the date it was saved.
 * Picking a row opens that trade — and its stock if it is another one — and the
 * row of the open trade is highlighted. With more than one trade a SORT menu
 * orders them by date or by how well they are doing. "× DELETE" on a row asks
 * "SURE?" before it removes that trade.
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
  const [sort, setSort] = useState<TradeSort>("newest");
  const ordered = sortTrades(trades, sort, (ticker) => quotes.get(ticker)?.price);

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
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.16em",
          color: "var(--si-accent-light, #a9c6e3)",
          textShadow: "0 0 6px rgba(127, 168, 208, 0.75), 0 0 14px rgba(89, 128, 166, 0.55)",
        }}
      >
        TRACKED TRADES · {trades.length}
      </div>

      {trades.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
          <label htmlFor="si-trk-sort" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "var(--si-text-mid, #93a1af)" }}>
            SORT
          </label>
          <select
            id="si-trk-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as TradeSort)}
            style={{ flex: 1, minWidth: 0, padding: "5px 8px", background: "transparent", color: "var(--si-text-hi, #e8eef4)", border: "1px solid var(--si-border-sec, #2a3a4a)", fontFamily: "'Manrope', sans-serif", fontSize: 12 }}
          >
            <option value="newest">Date · newest first</option>
            <option value="oldest">Date · oldest first</option>
            <option value="most">Most profitable</option>
            <option value="least">Least profitable</option>
          </select>
        </div>
      )}

      <div style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#2a3a4a transparent" }}>
        {ordered.map(t => {
          const active = t.id === activeId;
          const q = quotes.get(t.ticker);
          const bull = t.dir === "Bull";
          const dirCol = bull ? UP : DN;
          const savedAt = formatSavedAt(t.savedAt).replace(" · ", ", ");
          const confirming = confirmId === t.id;
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              className="si-trade-row"
              aria-current={active ? "true" : undefined}
              onClick={() => onSelect(t)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(t);
                }
              }}
              style={{
                boxSizing: "border-box",
                minHeight: ROW_HEIGHT,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                rowGap: 4,
                columnGap: 10,
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
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700, letterSpacing: "0.04em" }}>{t.ticker}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", padding: "2px 7px", color: dirCol, background: `${dirCol}1f` }}>
                  {bull ? "LONG" : "SHORT"}
                </span>
              </span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, textAlign: "right", color: q?.pctChange == null ? undefined : q.pctChange >= 0 ? UP : DN }}>
                {q?.price != null ? usd(q.price) : "—"}
              </span>

              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--si-text-mid, #93a1af)" }}>
                <b style={{ color: "#4fb3ff", fontWeight: 700 }}>{t.hz}</b> · TARGET <b style={{ color: UP, fontWeight: 700 }}>{usd(t.target)}</b>
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, textAlign: "right", color: q?.pctChange == null ? "var(--si-text-mid, #93a1af)" : q.pctChange >= 0 ? UP : DN }}>
                {q?.pctChange != null ? pct(q.pctChange) : ""}
              </span>

              <span style={{ gridColumn: "1 / -1", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--si-text-mid, #93a1af)" }}>
                INVALIDATION <b style={{ color: DN, fontWeight: 700 }}>{usd(t.stop)}</b>
              </span>

              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.04em", color: "var(--si-text-mid, #93a1af)" }}>
                {savedAt ? `Saved on ${savedAt}` : "Saved earlier"}
              </span>
              <span style={{ textAlign: "right" }}>
                <button
                  type="button"
                  aria-label={`Delete ${t.ticker} ${bull ? "long" : "short"} trade`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirming) {
                      setConfirmId(null);
                      onRemove(t);
                    } else {
                      setConfirmId(t.id);
                    }
                  }}
                  onBlur={() => setConfirmId((id) => (id === t.id ? null : id))}
                  style={{
                    cursor: "pointer",
                    padding: "4px 10px",
                    border: `1px solid ${DN}`,
                    background: confirming ? DN : "transparent",
                    color: confirming ? "#ffffff" : DN,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  {confirming ? "SURE?" : "× DELETE"}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
