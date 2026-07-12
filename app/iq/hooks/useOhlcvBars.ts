"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { firebaseDb } from "../../firebase";
import type { OHLCBar } from "../utils";

interface OhlcvBarDoc {
  open: number; high: number; low: number; close: number; volume: number;
}

// Real daily bars only cover what stock-history.job.ts backfills (~300
// trading days) — enough for 3M/6M/1Y, not deep enough for 5Y, and not
// fine-grained enough (daily only, no intraday) for 1D/1W.
const REAL_DATA_TIMEFRAMES = new Set(["3M", "6M", "1Y"]);

/**
 * Real OHLCV bars for one ticker, scoped server-side by a Firestore query
 * (NOT a full-collection read — ohlcv_bars grows without bound as more
 * tickers/days accumulate, so filtering client-side the way useCollection()
 * does elsewhere would mean downloading every ticker's whole history on
 * every page load). Returns undefined when the timeframe or ticker has no
 * usable real data yet, so callers fall back to the simulated generator.
 *
 * This where()+orderBy() combination needs a Firestore composite index. The
 * only one deployed for ohlcv_bars is (ticker ASC, barDate DESC) — declared in
 * `firestore.indexes.json` at the repo root, the direction
 * backend/src/sync/rs-rating.job.ts's query needs. Contrary to an earlier
 * assumption, Firestore does NOT serve an `orderBy('barDate','asc')` query from
 * that DESC index (it fails with FAILED_PRECONDITION — verified against the live
 * DB) — a barDate-ASC orderBy would require its own separate index. So we query
 * DESC to reuse the deployed index, then reverse the docs in memory to hand the
 * chart chronological (ascending) bars. That keeps one index covering both call
 * sites without a second deploy.
 */
export function useOhlcvBars(sym: string, tf: string): OHLCBar[] | undefined {
  const [bars, setBars] = useState<OHLCBar[]>([]);

  useEffect(() => {
    if (!REAL_DATA_TIMEFRAMES.has(tf)) {
      setBars([]);
      return;
    }
    const q = query(
      collection(firebaseDb, "ohlcv_bars"),
      where("ticker", "==", sym),
      orderBy("barDate", "desc"), // matches the deployed (ticker ASC, barDate DESC) index — see docblock
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        // Query returns newest→oldest; reverse to chronological (oldest→newest)
        // so the candle chart plots left-to-right in time.
        setBars(
          snap.docs
            .slice()
            .reverse()
            .map((d) => {
              const b = d.data() as OhlcvBarDoc;
              return { o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume };
            }),
        );
      },
      (err) => {
        console.error(`Firestore ohlcv_bars query failed for ${sym}:`, err);
        setBars([]);
      },
    );
    return () => unsub();
  }, [sym, tf]);

  return bars.length > 1 ? bars : undefined;
}
