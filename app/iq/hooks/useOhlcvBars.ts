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
 * This where()+orderBy() combination needs a Firestore composite index —
 * tracked in `firestore.indexes.json` at the repo root (deployed via
 * `firebase deploy --only firestore:indexes`), NOT managed ad hoc in the
 * Firebase console. That file declares (ticker ASC, barDate DESC) — the
 * direction backend/src/sync/rs-rating.job.ts's query needs — but Firestore
 * composite indexes are bidirectional: the same index also serves this
 * hook's ASC query by scanning in reverse, so one index entry correctly
 * covers both call sites; it does not need a second entry for ASC.
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
      orderBy("barDate", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBars(
          snap.docs.map((d) => {
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
