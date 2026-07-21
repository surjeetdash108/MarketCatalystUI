"use client";

import { useMemo } from "react";
import { useCollection } from "./useCollection";
import type { EarnQ } from "../utils";

/**
 * Real quarterly financials from the backend `financials` collection
 * (financials.job → Polygon /vX/reference/financials). Replaces the fabricated
 * earnHistory()/earnIncome() generators on Stock Detail and the Earnings Hub.
 */

export interface QuarterFinancials {
  fiscalPeriod: string | null;
  fiscalYear: string | null;
  endDate: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  epsActual: number | null;
  epsEstimate: number | null;
}

export interface FinancialsDoc {
  id: string;
  ticker: string;
  quarters: QuarterFinancials[];
}

export type IncRow = { c: string; rev: number; cogs: number; gp: number; opex: number; oi: number; ni: number; eps: number };

/** Short quarter label, e.g. "Q2 26". */
function label(q: QuarterFinancials): string {
  const yr = q.fiscalYear ? `'${q.fiscalYear.slice(-2)}` : "";
  return `${q.fiscalPeriod ?? "Q"} ${yr}`.trim();
}

export function useFinancials(sym: string) {
  const { data } = useCollection<FinancialsDoc>("financials");
  return useMemo(() => {
    const doc = data.find((d) => (d.ticker ?? d.id) === sym);
    // Quarters arrive newest-first from the vendor; keep that for tables,
    // reverse for left-to-right charts.
    const quarters = doc?.quarters ?? [];
    const hasData = quarters.length > 0;

    // EPS history (EarnQ) — real actual vs estimate; `mv` (price reaction) has
    // no source, so it is 0 rather than fabricated.
    const epsHistory: EarnQ[] = quarters
      .filter((q) => q.epsActual != null)
      .map((q) => {
        const a = q.epsActual ?? 0;
        const e = q.epsEstimate ?? a; // no estimate → surprise 0, not invented
        const surp = e !== 0 ? ((a - e) / Math.abs(e)) * 100 : 0;
        return { q: label(q), e, a, surp, mv: 0 };
      })
      .reverse();

    // Income-statement rows (IncRow) from real revenue/GP/OI/NI/EPS.
    const incomeRows: IncRow[] = quarters
      .filter((q) => q.revenue != null)
      .map((q) => {
        const rev = (q.revenue ?? 0) / 1e9; // → $B to match the UI's scale
        const gp = (q.grossProfit ?? 0) / 1e9;
        const oi = (q.operatingIncome ?? 0) / 1e9;
        const ni = (q.netIncome ?? 0) / 1e9;
        return {
          c: label(q),
          rev,
          cogs: rev - gp,
          gp,
          opex: gp - oi,
          oi,
          ni,
          eps: q.epsActual ?? 0,
        };
      });

    return { hasData, quarters, epsHistory, incomeRows };
  }, [data, sym]);
}
