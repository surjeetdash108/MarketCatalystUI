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

/** One fiscal-year row from the backend `annual` array (actuals only). */
export interface AnnualFinancials {
  fiscalYear: string | null;
  endDate: string | null;
  revenue: number | null;
  epsActual: number | null;
  netIncome: number | null;
}

export interface FinancialsDoc {
  id: string;
  ticker: string;
  quarters: QuarterFinancials[];
  annual?: AnnualFinancials[];
}

/**
 * One EPS + Sales history row (a quarter or a fiscal year), with year-over-year
 * change. Backs the Quarterly / Yearly tabs — actuals only, Polygon.
 */
export interface EarningsPeriodRow {
  label: string;      // "Aug '24" | "FY 2024"
  eps: number | null;
  epsChg: number | null;   // YoY %; null when it can't be shown (loss year, or non-positive base)
  salesM: number | null;   // revenue in $ millions
  salesChg: number | null; // YoY %
}

/**
 * EPS %CHG rule (mirrors how earnings vendors present it): a loss year shows no
 * growth %, and growth is measured off the magnitude of the prior figure so a
 * recovery from a loss reads as a positive %. Sales is always positive, so its
 * %CHG is a plain ratio.
 */
function epsPctChange(cur: number | null, prior: number | null): number | null {
  if (cur == null || cur < 0) return null;          // into a loss → no %
  if (prior == null || prior === 0) return null;    // no base to grow from
  return ((cur - prior) / Math.abs(prior)) * 100;
}
function salesPctChange(cur: number | null, prior: number | null): number | null {
  if (cur == null || prior == null || prior <= 0) return null;
  return ((cur - prior) / prior) * 100;
}

export type IncRow = { c: string; rev: number; cogs: number; gp: number; opex: number; oi: number; ni: number; eps: number };

/** Short quarter label, e.g. "Q2 26". */
function label(q: QuarterFinancials): string {
  const yr = q.fiscalYear ? `'${q.fiscalYear.slice(-2)}` : "";
  return `${q.fiscalPeriod ?? "Q"} ${yr}`.trim();
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Calendar month-year label from the period end, e.g. "Aug '24" (matches the
 *  earnings-history table). Falls back to the fiscal-period label. */
function qLabel(q: QuarterFinancials): string {
  if (q.endDate && /^\d{4}-\d{2}-\d{2}$/.test(q.endDate)) {
    const mo = MON[Number(q.endDate.slice(5, 7)) - 1] ?? "";
    return `${mo} '${q.endDate.slice(2, 4)}`;
  }
  return label(q);
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

    // ── Quarterly EPS + Sales history (newest-first) with YoY %CHG ──────────
    // YoY compares against the same quarter one year back (index +4 in a
    // newest-first array), which is the correct basis for seasonal businesses.
    const q = quarters; // newest-first
    const quarterlyHistory: EarningsPeriodRow[] = q.map((row, i) => {
      const prior = q[i + 4]; // same quarter, prior year
      const salesM = row.revenue != null ? row.revenue / 1e6 : null;
      const priorSalesM = prior?.revenue != null ? prior.revenue / 1e6 : null;
      return {
        label: qLabel(row),
        eps: row.epsActual,
        epsChg: epsPctChange(row.epsActual, prior?.epsActual ?? null),
        salesM,
        salesChg: salesPctChange(salesM, priorSalesM),
      };
    });

    // ── Annual (fiscal-year) history (newest-first) with YoY %CHG ───────────
    const annual = (doc?.annual ?? []).filter((a) => a.epsActual != null || a.revenue != null);
    const annualHistory: EarningsPeriodRow[] = annual.map((row, i) => {
      const prior = annual[i + 1]; // prior fiscal year
      const salesM = row.revenue != null ? row.revenue / 1e6 : null;
      const priorSalesM = prior?.revenue != null ? prior.revenue / 1e6 : null;
      return {
        label: row.fiscalYear ? `FY ${row.fiscalYear}` : "FY",
        eps: row.epsActual,
        epsChg: epsPctChange(row.epsActual, prior?.epsActual ?? null),
        salesM,
        salesChg: salesPctChange(salesM, priorSalesM),
      };
    });

    return {
      hasData,
      quarters,
      epsHistory,
      incomeRows,
      balanceRows,
      quarterlyHistory,
      annualHistory,
      hasAnnual: annualHistory.length > 0,
      /** Separate from hasData: a ticker can have income rows but no balance sheet. */
      hasBalanceSheet: balanceRows.length > 0,
    };
  }, [data, sym]);
}
