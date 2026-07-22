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

  // Balance sheet + cash flow. These arrive on the SAME vendor response that
  // already served the income statement — financials.job used to discard them
  // while the UI fabricated the corresponding panels.
  costOfRevenue: number | null;
  operatingExpenses: number | null;
  researchAndDevelopment: number | null;
  sellingGeneralAndAdministrative: number | null;
  incomeTaxExpense: number | null;
  dilutedAverageShares: number | null;

  totalAssets: number | null;
  currentAssets: number | null;
  totalLiabilities: number | null;
  currentLiabilities: number | null;
  equity: number | null;
  inventory: number | null;
  longTermDebt: number | null;

  netCashFlow: number | null;
  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;

  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  currentRatio: number | null;
  filingDate: string | null;
}

/** One balance-sheet / cash-flow column, in $B to match the UI's scale. */
export type BalanceRow = {
  c: string;
  assets: number | null;
  currentAssets: number | null;
  liabilities: number | null;
  currentLiabilities: number | null;
  equity: number | null;
  longTermDebt: number | null;
  inventory: number | null;
  opCF: number | null;
  invCF: number | null;
  finCF: number | null;
  netCF: number | null;
  currentRatio: number | null;
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
};

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

    // Balance sheet + cash flow, newest-first like `quarters`. Scaled to $B for
    // the same reason incomeRows is: every existing panel renders in billions.
    const b = (v: number | null) => (v == null ? null : v / 1e9);
    const balanceRows: BalanceRow[] = quarters
      .filter((q) => q.totalAssets != null || q.operatingCashFlow != null)
      .map((q) => ({
        c: label(q),
        assets: b(q.totalAssets),
        currentAssets: b(q.currentAssets),
        liabilities: b(q.totalLiabilities),
        currentLiabilities: b(q.currentLiabilities),
        equity: b(q.equity),
        longTermDebt: b(q.longTermDebt),
        inventory: b(q.inventory),
        opCF: b(q.operatingCashFlow),
        invCF: b(q.investingCashFlow),
        finCF: b(q.financingCashFlow),
        netCF: b(q.netCashFlow),
        currentRatio: q.currentRatio,
        grossMarginPct: q.grossMarginPct,
        operatingMarginPct: q.operatingMarginPct,
        netMarginPct: q.netMarginPct,
      }));

    return {
      hasData,
      quarters,
      epsHistory,
      incomeRows,
      balanceRows,
      /** Separate from hasData: a ticker can have income rows but no balance sheet. */
      hasBalanceSheet: balanceRows.length > 0,
    };
  }, [data, sym]);
}
