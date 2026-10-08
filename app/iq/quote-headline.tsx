"use client";

/**
 * The stock-detail headline quote — regular-session price and move, plus an
 * AFTER HOURS block once the regular session has closed. Shared by the stock
 * page header and the list+chart panels so both always print the same number
 * for the same ticker.
 */

import { fmt, cls, arr } from "./utils";
import { useBackendMarketStatus } from "./hooks/useBackendMarketStatus";
import { useLiveQuotes, extendedSession } from "./live-quotes-context";
import type { UseLiveTickResult } from "./hooks/useLiveTick";

export type HeadlineQuote = {
  /** Best current price (shared quote → live tick → snapshot); null when none. */
  dispPrice: number | null;
  regPrice: number;
  regPct: number;
  regDollar: number;
  ahPrice: number | null;
  ahPct: number | null;
  ahDollar: number | null;
  showAfterHours: boolean;
};

/**
 * @param live     the caller's useLiveTick(sym) result (it already holds one
 *                 for the chart overlay, so this never opens a second stream)
 * @param snapshot the company snapshot price / % change — the regular-session
 *                 close once the market has shut
 */
export function useHeadlineQuote(
  sym: string,
  live: UseLiveTickResult,
  snapshot: { price: number | null; pctChange: number | null },
): HeadlineQuote {
  // Headline price/%: prefer the SHARED app-wide quote so this shows the exact
  // same number as the heatmap tile / movers row for the same ticker.
  const sharedQuote = useLiveQuotes([sym]).get(sym);
  const mkt = useBackendMarketStatus();

  const p = snapshot.price ?? 0;
  const dollar = snapshot.pctChange != null ? Math.abs((snapshot.pctChange / 100) * p) : null;

  const livePrice = sharedQuote?.price ?? live.tick?.price ?? null;
  const dispPrice = livePrice ?? snapshot.price;
  const dispPct = sharedQuote?.pctChange ?? live.pct ?? snapshot.pctChange;

  const sharedDollar =
    sharedQuote?.price != null && sharedQuote.pctChange != null
      ? Math.abs(sharedQuote.price - sharedQuote.price / (1 + sharedQuote.pctChange / 100))
      : null;
  const dispDollar = sharedDollar ?? (live.change != null ? Math.abs(live.change) : dollar);

  const isMarketOpen = mkt.phase === "open";

  /*
   * Extended-session detection. Only active after regular hours have closed:
   * market status is after/closed, or the Polygon snapshot reports late
   * trading / a non-zero lateTradingChangePct.
   */
  const isAfterHours =
    !isMarketOpen &&
    (mkt.phase === "after" ||
      mkt.phase === "closed" ||
      sharedQuote?.marketStatus === "late_trading" ||
      (sharedQuote?.latePct != null && sharedQuote.latePct !== 0) ||
      extendedSession(sharedQuote) === "after hours");

  /*
   * Regular-session price and move. After hours the snapshot price is the
   * regular close; without one, reconstruct it from the after-hours quote.
   */
  const regPrice =
    isAfterHours && snapshot.price != null && snapshot.price > 0
      ? snapshot.price
      : isAfterHours && sharedQuote?.latePct != null && sharedQuote?.price != null
        ? sharedQuote.price / (1 + sharedQuote.latePct / 100)
        : (dispPrice ?? snapshot.price ?? 0);

  const regPct =
    isAfterHours && snapshot.pctChange != null
      ? snapshot.pctChange
      : (sharedQuote?.regularPct ?? dispPct ?? snapshot.pctChange ?? 0);

  const regDollar =
    regPrice > 0 && regPct != null && regPct !== -100
      ? Math.abs(regPrice - regPrice / (1 + regPct / 100))
      : (dispDollar ?? 0);

  /* After-hours price and move. */
  const ahPct =
    sharedQuote?.latePct ??
    (isAfterHours && sharedQuote?.pctChange != null && sharedQuote.pctChange !== regPct
      ? sharedQuote.pctChange
      : null);

  const ahPrice =
    isAfterHours && sharedQuote?.price != null && (sharedQuote.latePct != null || sharedQuote.price !== regPrice)
      ? sharedQuote.price
      : (ahPct != null && regPrice > 0 ? regPrice * (1 + ahPct / 100) : null);

  const ahDollar =
    ahPrice != null && regPrice > 0
      ? Math.abs(ahPrice - regPrice)
      : (ahPct != null && regPrice > 0 ? Math.abs((ahPct / 100) * regPrice) : null);

  const showAfterHours = !isMarketOpen && isAfterHours && ahPrice != null && ahPct != null;

  return { dispPrice, regPrice, regPct, regDollar, ahPrice, ahPct, ahDollar, showAfterHours };
}

/** Regular-session quote and, after the close, the AFTER HOURS block beside it. */
export function QuoteHeadline({ q }: { q: HeadlineQuote }) {
  const { regPrice, regPct, regDollar, ahPrice, ahPct, ahDollar, showAfterHours } = q;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "nowrap", flexShrink: 0 }}>
      {/* REGULAR MARKET CLOSE */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", whiteSpace: "nowrap", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap" }}>
          <span
            className="p"
            style={{
              fontFamily: "var(--f-mono)",
              fontSize: "1.05rem",
              fontWeight: 800,
              color: "var(--text-hi)",
              lineHeight: 1.1,
              letterSpacing: "-.02em",
            }}
          >
            ${fmt(regPrice, 2)}
          </span>

          {regPct != null && (
            <span
              className={`c ${cls(regPct)}`}
              style={{
                fontFamily: "var(--f-mono)",
                fontSize: "0.76rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "baseline",
                gap: 4,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: "0.68rem" }}>{arr(regPct)}</span>
              <span>{fmt(Math.abs(regDollar ?? 0), 2)}</span>
              <span>({regPct >= 0 ? "" : "-"}{fmt(Math.abs(regPct), 2)}%)</span>
            </span>
          )}
        </div>
      </div>

      {/* AFTER HOURS — ONLY SHOWN AFTER REGULAR MARKET CLOSE */}
      {showAfterHours && ahPrice != null && ahPct != null && (
        <div
          style={{
            borderLeft: `2.5px solid ${regPct >= 0 ? "var(--up)" : "var(--down)"}`,
            paddingLeft: 8,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: ".54rem",
              fontWeight: 800,
              color: "var(--text-hi)",
              letterSpacing: ".03em",
              textTransform: "uppercase",
              lineHeight: 1.1,
              marginBottom: 2,
              whiteSpace: "nowrap",
            }}
          >
            AFTER HOURS
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 4, lineHeight: 1.1, whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: "0.78rem", fontWeight: 800, color: "var(--text-hi)" }}>
              ${fmt(ahPrice, 2)}
            </span>

            <span
              className={`c ${cls(ahPct)}`}
              style={{
                fontFamily: "var(--f-mono)",
                fontSize: ".65rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "baseline",
                gap: 3,
                whiteSpace: "nowrap",
              }}
            >
              <span>{ahPct >= 0 ? "+" : "-"}{fmt(ahDollar ?? 0, 2)}</span>
              <span style={{ fontSize: ".58rem" }}>{arr(ahPct)}</span>
              <span>{ahPct >= 0 ? `+${fmt(ahPct, 2)}%` : `${fmt(ahPct, 2)}%`}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
