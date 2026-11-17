"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "../backend";
import type { Bar } from "../alpha-intraday";

interface BarsResponse {
  ticker: string;
  bars: Bar[];
  asOf?: string;
}

export interface TickerBars {
  bars: Bar[];
  /** Backend freshness stamp of the stored bars (ISO), when given. */
  asOf: string | null;
  /** When this browser last read them, epoch ms. */
  fetchedAt: number;
}

/**
 * 5-minute bars for a set of tickers (Alpha Signals intraday scan).
 *
 * All tickers are read in parallel. With `pollMs` set, every ticker is re-read
 * on that cadence; a round is skipped while the previous one is still running
 * (never two overlapping rounds). When the ticker set changes, only tickers
 * not read yet are fetched straight away — the rest wait for the next round —
 * and data for tickers that stay in the set is kept. A failed read keeps the
 * ticker's last good bars.
 */
export function useIntradayBars(tickers: string[], pollMs: number | null) {
  const [data, setData] = useState<Map<string, TickerBars>>(() => new Map());
  const [loading, setLoading] = useState(tickers.length > 0);
  const [lastRound, setLastRound] = useState<number | null>(null);
  /** The round in flight (one at a time), or null. */
  const running = useRef<object | null>(null);
  const have = useRef<Map<string, TickerBars>>(new Map());
  const key = tickers.join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    let cancelled = false;
    if (list.length === 0) {
      queueMicrotask(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }

    async function read(syms: string[]) {
      const results = await Promise.allSettled(
        syms.map(s => apiGet<BarsResponse>(`/live/bars?ticker=${encodeURIComponent(s)}&interval=5m`)),
      );
      if (cancelled) return;
      const now = Date.now();
      const next = new Map<string, TickerBars>();
      for (const s of list) {
        const prev = have.current.get(s);
        if (prev) next.set(s, prev);
      }
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && Array.isArray(r.value?.bars)) {
          next.set(syms[i], { bars: r.value.bars, asOf: r.value.asOf ?? null, fetchedAt: now });
        }
      });
      have.current = next;
      setData(next);
      setLastRound(now);
      setLoading(false);
    }

    async function round(syms: string[]) {
      if (running.current || syms.length === 0) return;
      const token = {};
      running.current = token;
      try {
        await read(syms);
      } finally {
        if (running.current === token) running.current = null;
      }
    }

    const missing = list.filter(s => !have.current.has(s));
    if (missing.length) {
      queueMicrotask(() => { if (!cancelled && have.current.size === 0) setLoading(true); });
      void round(missing);
    }
    const timer = pollMs ? setInterval(() => void round(list), pollMs) : undefined;
    return () => {
      cancelled = true;
      running.current = null;
      if (timer) clearInterval(timer);
    };
  }, [key, pollMs]);

  return { data, loading, lastRound };
}
