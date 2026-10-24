/** Mirrors backend's `financials/{ticker}` doc (src/sync/financials.job.ts + src/live/ondemand.service.ts's getFinancials) — GET /live/financials?ticker=X. */
/** FMP consensus-basis (non-GAAP) EPS actual for a quarter — the beat/miss and
 * NASDAQ/IBD basis. Polygon GAAP diluted EPS is a display-only fallback when FMP
 * has no reported figure. Use this for every EPS display + beat/miss, never the
 * raw `epsActual`. */
export function reportedQuarterEps(q: QuarterFinancials): number | null {
  return q.epsActualReported ?? q.epsActual ?? null;
}

/**
 * THE surprise-% derivation — `(actual − estimate) / |estimate| × 100`.
 *
 * This was hand-written at half a dozen call sites with three different
 * near-zero guards (`!== 0`, `< 0.005`, `< 0.05`), so the same quarter could
 * render a number on one screen and "—" on another. One definition now.
 *
 * Two guards, both there to stop a mathematically-correct-but-useless number
 * reaching the screen:
 *
 *  - `|estimate| < MIN_ESTIMATE` (5c): dividing by a near-zero estimate explodes.
 *    A live audit found 37 stored rows above ±500%, e.g. AGPU actual 1.1471 vs
 *    estimate 0.009 = +12,646%. A penny-estimate quarter is a rounding artifact,
 *    not a 12,000% beat.
 *  - `|surprise| > MAX_SURPRISE` (500%): a real beat this large is essentially
 *    always a bad/stale estimate rather than a genuine result.
 *
 * Both return null, so callers show "—" instead of a fabricated headline.
 */
const MIN_ESTIMATE = 0.05;
const MAX_SURPRISE = 500;

export function surprisePct(
  actual: number | null | undefined,
  estimate: number | null | undefined,
): number | null {
  if (actual == null || estimate == null || Math.abs(estimate) < MIN_ESTIMATE) return null;
  const pct = ((actual - estimate) / Math.abs(estimate)) * 100;
  return Math.abs(pct) > MAX_SURPRISE ? null : pct;
}

/** Matched-pair EPS surprise % (FMP reported actual vs the estimate from the same
 * surprise row, split-normalized). null when there's no matched pair. */
export function quarterEpsSurprisePct(q: QuarterFinancials): number | null {
  return surprisePct(q.epsActualReported, q.epsEstimateReported);
}

/** One quarter of the deep FMP reported-EPS history (non-GAAP, split-normalized,
 * ~10yr). Mirrors backend `financials/{ticker}.epsHistory` (financials.job.ts). */
export interface EpsHistoryRow {
  fiscalYear: number;
  fiscalPeriod: string;
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
}

/** Non-GAAP annual EPS = sum of the fiscal year's four quarterly reported EPS
 * from the deep FMP `epsHistory` (matches IBD/NASDAQ, works for every year FMP
 * covers, not just the ~10 recent Polygon quarters). Falls back to the GAAP
 * annual figure when the four quarters aren't all present. */
export function reportedAnnualEps(
  fiscalYear: string | number | null,
  epsHistory: EpsHistoryRow[] | undefined,
  gaapAnnual: number | null,
): number | null {
  if (fiscalYear == null) return gaapAnnual;
  const byQ = new Map<string, number>();
  for (const h of epsHistory ?? []) {
    if (String(h.fiscalYear) === String(fiscalYear) && h.epsActual != null) {
      byQ.set(h.fiscalPeriod, h.epsActual); // dedupe by fiscal quarter
    }
  }
  if (byQ.size >= 4)
    return Math.round([...byQ.values()].reduce((s, v) => s + v, 0) * 100) / 100;
  return gaapAnnual;
}

/** Non-GAAP annual EPS *estimate* = sum of the fiscal year's four quarterly
 * analyst estimates from the deep FMP `epsHistory` (parallels reportedAnnualEps,
 * which sums the actuals). Returns null unless all four quarters carry an
 * estimate, so the annual estimate is only shown when it's a true full-year sum. */
export function estimatedAnnualEps(
  fiscalYear: string | number | null,
  epsHistory: EpsHistoryRow[] | undefined,
): number | null {
  if (fiscalYear == null) return null;
  const byQ = new Map<string, number>();
  for (const h of epsHistory ?? []) {
    if (String(h.fiscalYear) === String(fiscalYear) && h.epsEstimate != null) {
      byQ.set(h.fiscalPeriod, h.epsEstimate); // dedupe by fiscal quarter
    }
  }
  if (byQ.size >= 4)
    return Math.round([...byQ.values()].reduce((s, v) => s + v, 0) * 100) / 100;
  return null;
}

/**
 * Calculates Free Cash Flow for a single quarter.
 * Requires either a valid finite provider-sourced freeCashFlow, or both finite
 * operatingCashFlow and capitalExpenditures (operating - abs(CapEx)).
 * Returns null if required data is missing or non-finite.
 */
export function computeQuarterFcf(q: {
  freeCashFlow?: number | null;
  operatingCashFlow?: number | null;
  capitalExpenditures?: number | null;
}): number | null {
  // Operating cash flow minus capex, computed here whenever both are known.
  // FMP's own freeCashFlow is OCF + capex, so a period where FMP stored capex
  // with the wrong sign comes out inflated (AEP Q2 2026: capex +$2.79B → FCF
  // +$4.6B instead of −$1.0B; SO likewise). Capex is spending either way.
  if (
    q.operatingCashFlow != null &&
    typeof q.operatingCashFlow === "number" &&
    Number.isFinite(q.operatingCashFlow) &&
    q.capitalExpenditures != null &&
    typeof q.capitalExpenditures === "number" &&
    Number.isFinite(q.capitalExpenditures)
  ) {
    return q.operatingCashFlow - Math.abs(q.capitalExpenditures);
  }
  if (
    q.freeCashFlow != null &&
    typeof q.freeCashFlow === "number" &&
    Number.isFinite(q.freeCashFlow)
  ) {
    return q.freeCashFlow;
  }
  return null;
}

/**
 * Calculates TTM Free Cash Flow over the most recent 4 quarters.
 * Strictly requires 4 valid, distinct quarterly periods.
 * If any quarter lacks sufficient data or is non-finite, returns null (unavailable)
 * rather than silently substituting zero.
 */
export function computeTtmFcf(
  quarters: Array<{
    fiscalPeriod?: string | null;
    fiscalYear?: string | null;
    endDate?: string | null;
    freeCashFlow?: number | null;
    operatingCashFlow?: number | null;
    capitalExpenditures?: number | null;
  }> | null | undefined,
): number | null {
  if (!quarters || quarters.length < 4) return null;
  const recent4 = quarters.slice(-4);
  const periods = new Set<string>();
  for (const q of recent4) {
    const key = (q.fiscalYear && q.fiscalPeriod)
      ? `${q.fiscalYear}-${q.fiscalPeriod}`
      : (q.endDate || null);
    if (!key) return null;
    periods.add(key);
  }
  if (periods.size !== 4) return null;

  let sum = 0;
  for (const q of recent4) {
    const f = computeQuarterFcf(q);
    if (f == null || !Number.isFinite(f)) {
      return null;
    }
    sum += f;
  }
  return Number.isFinite(sum) ? sum : null;
}

export interface QuarterFinancials {
  fiscalPeriod: string | null;
  fiscalYear: string | null;
  endDate: string | null;
  filingDate: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  epsActual: number | null;
  epsEstimate: number | null;
  /** FMP reported (non-GAAP) EPS actual, matched to the quarter. Paired with
   * epsEstimateReported for beat/miss. Absent on pre-existing docs. */
  epsActualReported?: number | null;
  /** FMP estimate from the SAME surprise row as epsActualReported — the two are
   * compared for beat/miss so they share a basis. Absent on pre-existing docs. */
  epsEstimateReported?: number | null;
  /** FMP consensus revenue estimate from the quarter's report (raw dollars),
   * paired with `revenue` for the sales %surp. Absent on pre-existing docs. */
  revenueEstimateReported?: number | null;
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
  totalDebt?: number | null;
  cashAndCashEquivalents?: number | null;
  netCashFlow: number | null;
  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;
  freeCashFlow?: number | null;
  capitalExpenditures?: number | null;
  ebitda?: number | null;
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  currentRatio: number | null;
}

export interface AnnualFinancials {
  fiscalYear: string | null;
  endDate: string | null;
  filingDate: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  epsActual: number | null;
  netIncome: number | null;
}

/** Forward analyst estimate for a future fiscal year (the `*YYYY` rows). Only
 *  present when an estimates vendor (FMP) is wired; empty/absent otherwise. */
export interface AnnualEstimate {
  fiscalYear: string;
  epsEstimate: number | null;
  /** Raw dollars — divide by 1e6 for the "Sales (M)" column, like reported. */
  revenueEstimate: number | null;
}

export interface FinancialsDoc {
  ticker: string;
  quarters: QuarterFinancials[];
  annual: AnnualFinancials[];
  annualEstimates?: AnnualEstimate[];
  /** Deep (~10yr) FMP reported quarterly EPS history — drives annual EPS. */
  epsHistory?: EpsHistoryRow[];
}
