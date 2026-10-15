"use client";

/**
 * The stock-detail headline quote — regular-session price and move, plus a
 * PRE-MARKET or AFTER HOURS block outside regular hours. Shared by the stock
 * page header and the list+chart panels so both always print the same number
 * for the same ticker.
 */

import { fmt, cls, arr } from "./utils";
import { useBackendMarketStatus } from "./hooks/useBackendMarketStatus";
import { useLiveQuotes } from "./live-quotes-context";
import { useApiResource } from "./hooks/useApiResource";
import type { UseLiveTickResult } from "./hooks/useLiveTick";
import type { OHLCBar } from "./candle-chart";

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
  /** Which extended session the ah* figures belong to. */
  extLabel: "PRE-MARKET" | "AFTER HOURS";
  /** Caption under the regular price: when that price was set ("As of 10:32 AM ET", "At close: Oct 14, 4:00 PM ET"). */
  regAsOf: string | null;
  /** Caption under the extended price: the time of that trade. */
  ahAsOf: string | null;
};

/** "10:32 AM ET" for today (ET), "Oct 14, 4:00 PM ET" for any other day. */
function fmtAsOf(ms: number): string {
  const sameDay = etParts(ms).date === etParts(Date.now()).date;
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    ...(sameDay ? {} : { month: "short", day: "numeric" }),
    hour: "numeric", minute: "2-digit",
  }).format(new Date(ms));
  return `${s} ET`;
}

/** 16:00 ET on the ET calendar date of `ms` — the regular close of that session. */
function closeOf(ms: number): number {
  // Floor to the minute, then shift by the minutes between that and 16:00 ET.
  return ms - (ms % 60_000) + (16 * 60 - etParts(ms).min) * 60_000;
}

/** ET calendar date and minutes past midnight for an epoch-ms instant. */
function etParts(ms: number): { date: string; min: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, min: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10) };
}

/** True when `ms` falls on today's ET date at or after 04:00 ET (pre-market open). */
function isTodayAfter4amET(ms: number | null): boolean {
  if (ms == null) return false;
  const at = etParts(ms);
  return at.date === etParts(Date.now()).date && at.min >= 4 * 60;
}

/**
 * Last extended-hours trade in the 1D intraday bars (Polygon, which carries
 * pre- and post-market prints). Pre-market: today's 04:00–09:30 ET bars; else
 * after hours: bars starting 16:00 ET or later on the last session's date.
 */
function lastExtendedClose(bars: OHLCBar[] | undefined, pre: boolean): { price: number; at: number } | null {
  const last = bars?.[bars.length - 1];
  if (!last) return null;
  const at = etParts(last.t);
  const ok = pre
    ? at.date === etParts(Date.now()).date && at.min >= 4 * 60 && at.min < 9 * 60 + 30
    : at.min >= 16 * 60;
  return ok && last.c > 0 ? { price: last.c, at: last.t } : null;
}

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
  const isPre = mkt.phase === "pre";
  // Outside regular hours the headline is the last regular close, with the
  // extended move made since beside it. 20:00–04:00 and weekends ("closed")
  // still belong to the last session's after-hours.
  const isExtended = !isMarketOpen;

  /*
   * A quote with no session split — /live/snapshot served from FMP
   * (refreshedFrom "fmp-quote"): regularClose, marketStatus and the late/early
   * percentages all come back null, and `price` is the last REGULAR close (GS
   * 13 Oct: 891.91 stamped 16:00:03 ET, while Polygon bars ran on to 892.84 at
   * 19:55). Comparing that price with itself gave a $0 move and hid the block
   * for every ticker. Here the quote price is the base and the extended price
   * comes from the 1D intraday bars instead.
   */
  const noSessionSplit =
    sharedQuote?.price != null && sharedQuote.regularClose == null && sharedQuote.marketStatus == null;
  const barsFallback = isExtended && noSessionSplit;
  // Polled, not fetched once: a page opened before the first pre-market print
  // (or before the close) would otherwise keep yesterday's last bar forever
  // and never show the block.
  const { data: dayBarsDoc } = useApiResource<{ bars?: OHLCBar[] }>(
    barsFallback && sym ? `/live/bars?ticker=${encodeURIComponent(sym)}&tf=1D` : null,
    60_000,
  );
  const dayBars = dayBarsDoc?.bars;

  /*
   * The close the extended move is measured from: pre-market follows the
   * PREVIOUS session's close, after hours follows today's. Both come straight
   * from the quote. The vendor's late/early percentages are deliberately NOT
   * used — in pre-market the late figure still holds the prior evening's move
   * (GS on 13 Oct showed 12 Oct's +0.48% beside a 13 Oct pre-market price,
   * next to a +$36.85 that was really +4.12%), and outside its window it tracks
   * something else entirely (see LiveQuote.latePct).
   */
  const quoteClose = barsFallback
    ? sharedQuote?.price
    : isPre ? sharedQuote?.previousClose : sharedQuote?.regularClose;
  const regPrice = isExtended
    ? (quoteClose ?? (snapshot.price != null && snapshot.price > 0 ? snapshot.price : null) ?? dispPrice ?? 0)
    : (dispPrice ?? snapshot.price ?? 0);

  // After hours the day's move is exact from the two closes; otherwise fall
  // back to the company snapshot's stored move.
  const closesMove =
    isExtended && !isPre &&
    sharedQuote?.regularClose != null && sharedQuote.previousClose != null && sharedQuote.previousClose > 0
      ? ((sharedQuote.regularClose - sharedQuote.previousClose) / sharedQuote.previousClose) * 100
      : null;
  // Pre-market belongs to a NEW trading day whose regular session has not
  // started: the headline is the prior close and its own move is 0.00. The
  // quote's change % at this hour is still yesterday's session (AAPL showed
  // +0.30 at 08:47 ET = 341.27 vs 340.97, the 13 Oct move); today's
  // pre-market move is the PRE-MARKET block beside it.
  const regPct = isPre
    ? 0
    : isExtended
    ? (closesMove ?? (barsFallback ? sharedQuote?.pctChange : null) ?? snapshot.pctChange ?? 0)
    : (sharedQuote?.regularPct ?? dispPct ?? snapshot.pctChange ?? 0);

  const regDollar =
    regPrice > 0 && regPct != null && regPct !== -100
      ? Math.abs(regPrice - regPrice / (1 + regPct / 100))
      : (dispDollar ?? 0);

  /*
   * Extended price and move. The % is derived from the same price and base as
   * the $ figure, so the two can never disagree. In pre-market the quote must
   * be from TODAY's pre-market — before the first pre-market print the vendor
   * still carries last evening's after-hours trade.
   */
  const preMarketQuote = !isPre || isTodayAfter4amET(sharedQuote?.updatedAt ?? null);
  const barExt = barsFallback ? lastExtendedClose(dayBars, isPre) : null;
  const extPrice = barsFallback
    ? (barExt?.price ?? null)
    : isExtended && preMarketQuote ? (sharedQuote?.price ?? live.tick?.price ?? null) : null;
  const extMove = extPrice != null && regPrice > 0 ? extPrice - regPrice : null;
  const ahPrice = extPrice;
  const ahPct = extMove != null ? (extMove / regPrice) * 100 : null;
  const ahDollar = extMove != null ? Math.abs(extMove) : null;

  // No extended trade since the close — or a feed with no session split, whose
  // price IS the close — shows no block rather than a "+0.00" one.
  const showAfterHours = isExtended && extMove != null && Math.abs(extMove) >= 0.005;
  const extLabel = isPre ? "PRE-MARKET" : "AFTER HOURS";

  /*
   * When each price was set. The quote's vendor timestamp is the trade time
   * (≈15 min behind on Polygon), not when we fetched it. Outside hours the
   * headline is a close, so it reads as that session's 4:00 PM; pre-market it
   * is the prior session's close, whose date the quote does not carry.
   */
  const quoteAt = sharedQuote?.updatedAt ?? live.tick?.at ?? null;
  const regAsOf = !isExtended
    ? (quoteAt != null ? `As of ${fmtAsOf(quoteAt)}` : null)
    : isPre
    ? "At prev. close"
    : quoteAt != null ? `At close: ${fmtAsOf(closeOf(quoteAt))}` : "At close";
  const ahAt = barsFallback ? (barExt?.at ?? null) : quoteAt;
  const ahAsOf = showAfterHours && ahAt != null ? fmtAsOf(ahAt) : null;

  return { dispPrice, regPrice, regPct, regDollar, ahPrice, ahPct, ahDollar, showAfterHours, extLabel, regAsOf, ahAsOf };
}

const AS_OF_STYLE = {
  fontFamily: "var(--f-mono)",
  fontSize: ".56rem",
  color: "var(--text-dim-solid)",
  lineHeight: 1.1,
  marginTop: 3,
  whiteSpace: "nowrap",
} as const;

/** Regular-session quote and, after the close, the AFTER HOURS block beside it. */
export function QuoteHeadline({ q }: { q: HeadlineQuote }) {
  const { regPrice, regPct, regDollar, ahPrice, ahPct, ahDollar, showAfterHours, extLabel, regAsOf, ahAsOf } = q;
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
              {regPct !== 0 && <span style={{ fontSize: "0.68rem" }}>{arr(regPct)}</span>}
              <span>{fmt(Math.abs(regDollar ?? 0), 2)}</span>
              <span>({regPct >= 0 ? "" : "-"}{fmt(Math.abs(regPct), 2)}%)</span>
            </span>
          )}
        </div>
        {regAsOf && <div style={AS_OF_STYLE}>{regAsOf}</div>}
      </div>

      {/* PRE-MARKET / AFTER HOURS — only outside regular hours */}
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
            {extLabel}
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
          {ahAsOf && <div style={AS_OF_STYLE}>{ahAsOf}</div>}
        </div>
      )}
    </div>
  );
}
