"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Polls the backend's cached snapshot. The scalable counterpart to
 * useLiveQuote's SSE stream.
 *
 * WHY POLLING WINS HERE
 * Every client in a refresh window receives a byte-identical response, so a CDN
 * (or the browser cache) collapses them to roughly one origin request per
 * interval — user count barely affects backend load. Measured locally: 500
 * requests produced 1 upstream vendor call.
 *
 * The SSE path cannot do this. It holds a connection per user (~156 KB RSS
 * each), occupies one of Cloud Run's 80 concurrent slots per instance, and
 * depends on a single Polygon socket that only one instance may own.
 *
 * Freshness cost is negligible: the feed is already ~15 minutes delayed, so a
 * 10-second poll makes it 910s stale instead of 900s.
 */

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "http://localhost:4100";

export interface SnapshotQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  dayVolume: number | null;
  dayVwap: number | null;
  minuteClose: number | null;
  minuteAt: number | null;
  vendorUpdatedAt: number | null;
  /**
   * Extended-hours session moves, from the v3 universal snapshot. Null outside
   * the relevant session. The Premarket / After-Hours feeds rendered hardcoded
   * copy before these existed on the response.
   */
  earlyTradingChangePct: number | null;
  lateTradingChangePct: number | null;
  regularTradingChangePct: number | null;
  marketStatus: string | null;
}

export interface SnapshotState {
  quote: SnapshotQuote | null;
  /** How stale the server's cached copy was when it answered. */
  cacheAgeMs: number | null;
  /** Round-trip time of the last poll. */
  latencyMs: number | null;
  /** True when the server answered 304 — no body transferred. */
  notModified: boolean;
  polls: number;
  /** Polls answered 304, i.e. served with no payload. */
  cacheHits: number;
  error: string | null;
  /** Vendor delay in seconds, from the snapshot's own clock. */
  feedLagSeconds: number | null;
}

const EMPTY: SnapshotState = {
  quote: null, cacheAgeMs: null, latencyMs: null, notModified: false,
  polls: 0, cacheHits: 0, error: null, feedLagSeconds: null,
};

/**
 * Live (delayed) prices for a LIST of tickers in one shared poll — the batched
 * counterpart to useSnapshotQuote. Backs the Watchlist, Portfolio and Search,
 * whose prices previously came only from the once-a-day `market-quotes` EOD
 * write on `companies` and so never moved intraday.
 *
 * One request per interval covers every ticker (the `?tickers=` cap is 50),
 * returns a byte-identical body for the same set (CDN/cache-collapsible), and
 * the backend still makes one Polygon call per refresh regardless of how many
 * browsers ask. Returns a Map keyed by upper-case ticker; missing tickers are
 * simply absent, so callers fall back to their EOD value.
 */
const MAX_SNAPSHOT_TICKERS = 50;
const EMPTY_SNAPSHOTS: Map<string, SnapshotQuote> = new Map();

export function useSnapshotQuotes(tickers: string[], intervalMs = 15_000): Map<string, SnapshotQuote> {
  const [quotes, setQuotes] = useState<Map<string, SnapshotQuote>>(new Map());
  // Stable, deduped, capped key so the effect only re-subscribes when the SET of
  // tickers changes — not on every render or price tick.
  const key = [...new Set(tickers.map((t) => t.toUpperCase()).filter(Boolean))]
    .sort()
    .slice(0, MAX_SNAPSHOT_TICKERS)
    .join(",");
  const etag = useRef<string | null>(null);

  useEffect(() => {
    // No tickers: don't poll and don't setState here (the hook returns the
    // stable EMPTY_SNAPSHOTS below instead — avoids a setState-in-effect).
    if (!key) return;
    etag.current = null;
    let cancelled = false;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND}/live/snapshot?tickers=${encodeURIComponent(key)}`, {
          signal: controller.signal,
          headers: etag.current ? { "If-None-Match": etag.current } : {},
        });
        if (cancelled || res.status === 304) return; // 304 → keep last map
        if (!res.ok) return; // keep last good prices rather than blanking
        const tag = res.headers.get("ETag");
        if (tag) etag.current = tag;
        const body = await res.json();
        const next = new Map<string, SnapshotQuote>();
        for (const q of (body.quotes ?? []) as SnapshotQuote[]) {
          if (q.ticker) next.set(q.ticker.toUpperCase(), q);
        }
        if (!cancelled) setQuotes(next);
      } catch {
        // Network blip — keep the last good prices.
      }
    };

    void poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [key, intervalMs]);

  // When there are no tickers, return the stable empty map (not stale `quotes`).
  return key ? quotes : EMPTY_SNAPSHOTS;
}

export function useSnapshotQuote(ticker: string | null, intervalMs = 10_000) {
  const [state, setState] = useState<SnapshotState>(EMPTY);
  // Kept in a ref so the polling effect doesn't re-run when the ETag changes,
  // which would restart the interval on every successful poll.
  const etag = useRef<string | null>(null);
  const counters = useRef({ polls: 0, hits: 0 });

  useEffect(() => {
    if (!ticker) return;
    etag.current = null;
    counters.current = { polls: 0, hits: 0 };
    setState(EMPTY);

    let cancelled = false;
    const controller = new AbortController();

    const poll = async () => {
      const started = performance.now();
      try {
        const res = await fetch(
          `${BACKEND}/live/snapshot?tickers=${encodeURIComponent(ticker)}`,
          {
            signal: controller.signal,
            // Conditional request: an unchanged interval costs a 304 with no
            // body, which is what makes frequent polling cheap.
            headers: etag.current ? { "If-None-Match": etag.current } : {},
          },
        );
        if (cancelled) return;
        const latencyMs = Math.round(performance.now() - started);
        counters.current.polls += 1;

        if (res.status === 304) {
          counters.current.hits += 1;
          setState((s) => ({
            ...s,
            latencyMs,
            notModified: true,
            polls: counters.current.polls,
            cacheHits: counters.current.hits,
            error: null,
          }));
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const tag = res.headers.get("ETag");
        if (tag) etag.current = tag;
        const body = await res.json();
        const quote: SnapshotQuote | null = body.quotes?.[0] ?? null;

        setState({
          quote,
          cacheAgeMs: body.cacheAgeMs ?? null,
          latencyMs,
          notModified: false,
          polls: counters.current.polls,
          cacheHits: counters.current.hits,
          error: null,
          feedLagSeconds:
            quote?.vendorUpdatedAt != null
              ? Math.round((Date.now() - quote.vendorUpdatedAt) / 1000)
              : null,
        });
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        setState((s) => ({ ...s, error: (err as Error).message }));
      }
    };

    void poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [ticker, intervalMs]);

  return state;
}
