"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDb } from "../../firebase";

/**
 * Real dividend history for one ticker, from `dividend_history/{ticker}`
 * (corporate-actions.job.ts).
 *
 * Replaces the client-side extrapolations that took the single current yield and
 * invented everything else from it: quarterly amounts as `annual / 4` decayed by
 * a hardcoded 6.5% a year, ex-dates as `6 + sym.charCodeAt(0) % 22`, and a
 * "5-yr dividend growth" that was the literal constant +6.5% for every company.
 */

export interface DividendPayment {
  exDividendDate: string | null;
  paymentDate: string | null;
  declarationDate: string | null;
  recordDate: string | null;
  amount: number;
  dividendType: string | null;
  frequency: number | null;
}

export interface DividendHistoryDoc {
  ticker: string;
  /** Newest first. */
  history: DividendPayment[];
  annualTotals: Array<{ year: number; total: number; payments: number }>;
  ttmTotal: number | null;
  ttmPayments: number;
  yieldPct: number | null;
  cagr5yPct: number | null;
  increaseStreakYears: number;
  frequency: number | null;
  isPayer: boolean;
  updatedAt: string;
}

export function useDividendHistory(sym: string): DividendHistoryDoc | undefined {
  const [data, setData] = useState<DividendHistoryDoc | undefined>(undefined);

  useEffect(() => {
    if (!sym) {
      setData(undefined);
      return;
    }
    const unsub = onSnapshot(
      doc(firebaseDb, "dividend_history", sym),
      snap => setData(snap.exists() ? (snap.data() as DividendHistoryDoc) : undefined),
      err => {
        console.error(`Firestore dividend_history/${sym} read failed:`, err);
        setData(undefined);
      },
    );
    return () => unsub();
  }, [sym]);

  return data;
}

/** "Q2'25"-style label for a payment, derived from its real ex-date. */
export function quarterLabel(isoDate: string | null): string {
  if (!isoDate) return "—";
  const [y, m] = isoDate.split("-");
  const q = Math.floor((Number(m) - 1) / 3) + 1;
  return `Q${q}'${y.slice(2)}`;
}

/** "Apr 11"-style short ex-date. */
export function shortDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Whole days until an upcoming date, or null if it is in the past/absent. */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  const days = Math.ceil((target - Date.now()) / 86_400_000);
  return days >= 0 ? days : null;
}
