/** Mirrors backend's `dividend_history/{ticker}` doc (src/live/ondemand.service.ts's getDividendHistory) — GET /live/dividend-history?ticker=X. */
export interface DividendHistoryDoc {
  ticker: string;
  history: Array<{
    exDividendDate: string | null;
    paymentDate: string | null;
    declarationDate: string | null;
    recordDate: string | null;
    // Nullable: the backend reads Polygon's cash_amount defensively and may
    // emit null when a dividend record has no amount (guard renders).
    amount: number | null;
    dividendType: string | null;
    frequency: number | null;
  }>;
  annualTotals: Array<{ year: number; total: number | null; payments: number }>;
  ttmTotal: number | null;
  ttmPayments: number;
  yieldPct: number | null;
  forwardYieldPct?: number | null;
  forwardPerShare?: number | null;
  trailingYieldPct?: number | null;
  trailingPerShare?: number | null;
  yieldBasisPrice: number | null;
  cagr5yPct: number | null;
  increaseStreakYears: number;
  frequency: number | null;
  /** Absent on docs written before the grace-window flag existed. */
  isPayer?: boolean;
  source: string;
}
