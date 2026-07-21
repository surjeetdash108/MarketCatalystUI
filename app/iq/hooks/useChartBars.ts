"use client";

import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { firebaseDb } from "../../firebase";
import type { OHLCBar } from "../utils";
import { lastSessions } from "../session-bars";

/**
 * Real bars for every chart timeframe.
 *
 * Supersedes the daily-only useOhlcvBars, which served 3M/6M/1Y and returned
 * undefined for everything else so the caller fell back to `genOHLC` — a seeded
 * random walk. 1D/1W/1M were synthetic because daily bars are too coarse for
 * them, and 5Y because only ~300 days had ever been backfilled. Neither was a
 * data-plan limit: intraday aggregates and a five-year daily window are both
 * authorized on the current Polygon plan, and the backend now syncs both
 * (`intraday-bars.job.ts`, and stock-history's backfill raised to the plan edge).
 *
 *   1D · 1W  ← intraday_bars/{ticker}_5min   (sliced to the last N sessions)
 *   1M       ← intraday_bars/{ticker}_30min
 *   3M…5Y    ← ohlcv_bars                    (daily, limited per timeframe)
 */

interface OhlcvBarDoc {
  open: number; high: number; low: number; close: number; volume: number;
}

interface IntradayBar {
  t: number; o: number; h: number; l: number; c: number; v: number;
}

/**
 * Trading days to render per timeframe. Doubles as the Firestore `limit` for
 * daily reads — without one, a 5-year backfill means every chart mount
 * downloads ~1250 documents even to draw a 3-month window.
 */
const DAILY_BARS: Record<string, number> = {
  "3M": 64,
  "6M": 128,
  "1Y": 252,
  "5Y": 1300,
};

/** Intraday resolution and how many sessions of it each timeframe shows. */
const INTRADAY: Record<string, { resolution: "5min" | "30min"; sessions: number }> = {
  "1D": { resolution: "5min", sessions: 1 },
  "1W": { resolution: "5min", sessions: 5 },
  "1M": { resolution: "30min", sessions: 22 },
};

/** Daily bars from `ohlcv_bars`, oldest-first, capped to the timeframe's window. */
function useDailyBars(sym: string, tf: string): OHLCBar[] | undefined {
  const [bars, setBars] = useState<OHLCBar[]>([]);

  useEffect(() => {
    const want = DAILY_BARS[tf];
    if (!want || !sym) {
      setBars([]);
      return;
    }
    // DESC + limit reuses the deployed (ticker ASC, barDate DESC) composite
    // index and takes the NEWEST N rows; an ASC order would need its own index
    // AND would limit to the oldest N, which is the wrong end of the history.
    const q = query(
      collection(firebaseDb, "ohlcv_bars"),
      where("ticker", "==", sym),
      orderBy("barDate", "desc"),
      limit(want),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setBars(
          snap.docs
            .slice()
            .reverse() // newest→oldest from the query; charts plot oldest→newest
            .map(d => {
              const b = d.data() as OhlcvBarDoc;
              return { o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume };
            }),
        );
      },
      err => {
        console.error(`Firestore ohlcv_bars query failed for ${sym}:`, err);
        setBars([]);
      },
    );
    return () => unsub();
  }, [sym, tf]);

  return bars.length > 1 ? bars : undefined;
}

/** Intraday bars from the single per-ticker/resolution document. */
function useIntradayBars(sym: string, tf: string): OHLCBar[] | undefined {
  const [bars, setBars] = useState<OHLCBar[]>([]);

  useEffect(() => {
    const spec = INTRADAY[tf];
    if (!spec || !sym) {
      setBars([]);
      return;
    }
    // One document holds the whole array — see intraday-bars.job.ts for why the
    // series is not stored a document per bar.
    const ref = doc(firebaseDb, "intraday_bars", `${sym}_${spec.resolution}`);
    const unsub = onSnapshot(
      ref,
      snap => {
        const raw = (snap.data()?.bars ?? []) as IntradayBar[];
        setBars(
          lastSessions(raw, spec.sessions).map(b => ({
            o: b.o, h: b.h, l: b.l, c: b.c, v: b.v,
          })),
        );
      },
      err => {
        console.error(`Firestore intraday_bars read failed for ${sym}:`, err);
        setBars([]);
      },
    );
    return () => unsub();
  }, [sym, tf]);

  return bars.length > 1 ? bars : undefined;
}

/**
 * Real bars for `tf`, or undefined when none have synced yet — callers keep
 * their existing fallback so a ticker outside the synced universe still renders
 * something rather than an empty pane.
 */
export function useChartBars(sym: string, tf: string): OHLCBar[] | undefined {
  const daily = useDailyBars(sym, tf);
  const intraday = useIntradayBars(sym, tf);
  return INTRADAY[tf] ? intraday : daily;
}

/** True when this timeframe is served by real bars — for the "live data" badge. */
export function isRealBarTimeframe(tf: string): boolean {
  return tf in DAILY_BARS || tf in INTRADAY;
}
