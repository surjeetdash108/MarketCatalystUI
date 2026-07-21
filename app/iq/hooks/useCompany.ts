"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDb } from "../../firebase";

/**
 * One company document, read by id.
 *
 * Deliberately not useCollection("companies"): that subscribes to the WHOLE
 * collection and filters in the browser, which is fine for a screen that
 * genuinely ranks every ticker but wasteful for a panel that needs a single
 * symbol's indicators. This is one document read per selected ticker.
 */

export interface CompanyDoc {
  ticker?: string;
  name?: string | null;
  price?: number | null;
  pctChange?: number | null;
  marketCap?: number | null;
  peRatio?: number | null;
  eps?: number | null;
  beta?: number | null;
  sector?: string | null;
  industry?: string | null;
  exchange?: string | null;
  description?: string | null;

  /** Peers from Polygon /v1/related-companies (was a sector-filtered mock list). */
  peers?: string[] | null;
  dividendYield?: number | null;
  dividendPerShare?: number | null;

  // ── technical-indicators.job.ts ──
  rsi14?: number | null;
  /** Rolling RSI(14) line; the pane drew a seeded sine walk without it. */
  rsi14Series?: number[] | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHistogram?: number | null;
  rvol?: number | null;
  sma50?: number | null;
  sma200?: number | null;
  aboveSma50?: boolean | null;
  aboveSma200?: boolean | null;
  week5ChangePct?: number | null;
  /** SMA/EMA keyed by period ("10","20","30","50","100","200"). */
  smaLadder?: Record<string, number | null> | null;
  emaLadder?: Record<string, number | null> | null;
  vwap?: number | null;
  high52?: number | null;
  low52?: number | null;
  pctFromHigh52?: number | null;
  pctFromLow52?: number | null;
  avgVolume20?: number | null;
  avgVolume50?: number | null;
  barsAnalyzed?: number | null;

  rsRating?: number | null;
  techRating?: number | null;
  sectorRank?: number | null;
  sectorRankTotal?: number | null;
}

export function useCompany(sym: string): CompanyDoc | undefined {
  const [data, setData] = useState<CompanyDoc | undefined>(undefined);

  useEffect(() => {
    if (!sym) {
      setData(undefined);
      return;
    }
    const unsub = onSnapshot(
      doc(firebaseDb, "companies", sym),
      snap => setData(snap.exists() ? (snap.data() as CompanyDoc) : undefined),
      err => {
        console.error(`Firestore companies/${sym} read failed:`, err);
        setData(undefined);
      },
    );
    return () => unsub();
  }, [sym]);

  return data;
}
