"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDb } from "../../firebase";

/**
 * Split history for one ticker, from `splits/{ticker}` (corporate-actions.job).
 *
 * Worth surfacing rather than leaving as background data: `stock-history.job`
 * refetches bars with `adjusted=true`, so a split silently REWRITES price
 * history. Without this, a user comparing a chart to a screenshot from last
 * month sees different prices and no explanation. Showing the split makes the
 * adjustment legible instead of looking like a data error.
 */

export interface SplitEvent {
  executionDate: string;
  splitFrom: number;
  splitTo: number;
}

export interface SplitsDoc {
  ticker: string;
  splits: SplitEvent[];
  latestSplit: SplitEvent | null;
  updatedAt: string;
}

export function useSplits(sym: string): SplitsDoc | undefined {
  const [data, setData] = useState<SplitsDoc | undefined>(undefined);

  useEffect(() => {
    if (!sym) {
      setData(undefined);
      return;
    }
    const unsub = onSnapshot(
      doc(firebaseDb, "splits", sym),
      snap => setData(snap.exists() ? (snap.data() as SplitsDoc) : undefined),
      err => {
        console.error(`Firestore splits/${sym} read failed:`, err);
        setData(undefined);
      },
    );
    return () => unsub();
  }, [sym]);

  return data;
}

/** "10-for-1" from {splitFrom: 1, splitTo: 10}. */
export function splitRatio(s: SplitEvent): string {
  return `${s.splitTo}-for-${s.splitFrom}`;
}

/** Splits on or after `sinceIso` — i.e. those affecting the visible chart window. */
export function splitsSince(doc: SplitsDoc | undefined, sinceIso: string): SplitEvent[] {
  return (doc?.splits ?? []).filter(s => s.executionDate >= sinceIso);
}
