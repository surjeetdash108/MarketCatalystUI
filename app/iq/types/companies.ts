/**
 * Mirrors backend's `companies` collection (src/market-data/companies.controller.ts)
 * — GET /market-data/companies. Union of every field a screen reads off this
 * doc today (Heatmap/Themes: price/pctChange/marketCap/name; Movers: rvol;
 * Screener: peRatio, rsRating, techRating, revenueGrowthYoY, epsGrowthYoY,
 * grossMargin; Stock Detail: dividendYield, beta, sector, rsi14, macd fields,
 * sectorRank fields, source) — one shared type instead of each screen
 * redefining an overlapping subset locally.
 */
/** Classic pivot support/resistance levels (technical-indicators.job). */
export interface PivotLevels {
  pivot: number | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
}

export interface CompanyDoc {
  id: string;
  ticker: string;
  name: string | null;
  // Polygon company profile blurb + IR homepage (from /v3/reference/tickers),
  // populated on-demand by /live/company. Absent on bulk-synced docs.
  description?: string | null;
  homepageUrl?: string | null;
  price: number | null;
  pctChange: number | null;
  marketCap: number | null;
  rvol?: number | null;
  peRatio: number | null;
  // Latest reported EPS (eps) and trailing-twelve-month EPS (epsTtm), written
  // by /live/company (ondemand.service). Absent on bulk-synced docs.
  eps?: number | null;
  epsTtm?: number | null;
  // 1-99 composite scores from rs-rating.job/tech-rating.job — null until
  // those jobs have run for this ticker.
  rsRating: number | null;
  techRating: number | null;
  // Decimals (0.064 = 6.4%) from fundamentals-growth.job.
  revenueGrowthYoY: number | null;
  epsGrowthYoY: number | null;
  grossMargin: number | null;
  dividendYield: number | null;
  beta: number | null;
  sector: string | null;
  // FMP profile industry (e.g. "Consumer Electronics") when FMP is wired,
  // else the Polygon SIC description. Shown next to Sector on the detail page.
  industry: string | null;
  // Real technicals from technical-indicators.job (null until it has run).
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  // Price vs 50/200-day SMA, precomputed by technical-indicators.job so the
  // screener can filter without refetching bars.
  aboveSma50?: boolean | null;
  aboveSma200?: boolean | null;
  // Rolling 52-week high/low from technical-indicators.job — lets the recap
  // count new highs/lows without a dedicated breadth job.
  high52?: number | null;
  low52?: number | null;
  sma50?: number | null;
  sma200?: number | null;
  // Support/resistance — classic pivot points computed from prior daily and
  // prior-complete-weekly bars (technical-indicators.job).
  keyLevels?: {
    daily?: PivotLevels | null;
    weekly?: PivotLevels | null;
  } | null;
  // More technicals from technical-indicators.job: true 5-session change,
  // Stochastic %K, Wilder ADX(14). beta (above) is now computed there too.
  week5ChangePct?: number | null;
  /** The close week5ChangePct is measured FROM, so the move can be
   *  re-measured to the live price instead of to a stale bar. */
  week5BaseClose?: number | null;
  stochK?: number | null;
  adx14?: number | null;
  /** Annualized 30-day realized volatility (%) — the Macro "30d Vol" column. */
  realizedVol30?: number | null;
  /** Session VWAP from technical-indicators.job (Technical Rating drawer). */
  vwap?: number | null;
  /** Distance from the 52-week high, negative (e.g. -7.89 = 7.89% below it). */
  pctFromHigh52?: number | null;
  /** Distance above the 52-week low, positive. */
  pctFromLow52?: number | null;
  /** 20-session average volume from technical-indicators.job's computeIndicators
   *  (same helper /live/company/summary uses) — the stock-detail Key Stats card
   *  reads this as a fallback before its own year-of-bars computation is ready. */
  avgVolume20?: number | null;
  /** Forward-annualized dividend per share (pairs with dividendYield). */
  dividendPerShare?: number | null;
  /** Only ever set by /live/company/summary — the full doc has no earnings-date
   *  field of its own (Next ER comes from the separate /market-data/earnings
   *  feed instead). Declared here, always undefined on a real full doc, so
   *  `CompanyDoc | CompanySummary` key-stats code can read it off either
   *  without a type guard. */
  nextEarningsDate?: string | null;
  /** Trailing RSI(14) history, oldest→newest — powers the RSI sparkline. */
  rsi14Series?: number[] | null;
  // FMP 13F institutional-ownership rollup (stock-detail Institutional card).
  /** % of shares outstanding held by 13F institutions (0-100). */
  instOwnershipPct?: number | null;
  /** Number of institutions holding (13F filers). */
  inst13FHolders?: number | null;
  /** QoQ change in holder count. */
  inst13FHoldersChange?: number | null;
  inst13FShares?: number | null;
  inst13FSharesChange?: number | null;
  instTotalInvested?: number | null;
  instPutCallRatio?: number | null;
  /** Rollup period, e.g. "Q1 2026". */
  instAsOf?: string | null;
  // Sector rank from tech-rating.job; source records which vendor served the profile.
  sectorRank: number | null;
  sectorRankTotal: number | null;
  // Real related companies from Polygon /v1/related-companies (AAPL → MSFT,
  // AMZN, GOOGL, NVDA…) — algorithmic peers, not just same-sector.
  peers: string[] | null;
  source: string | null;
}

/**
 * GET /live/company/summary?ticker=X — a fast (~1-3s) key-stats-only read for
 * a ticker whose company doc isn't in Firestore yet, served alongside the
 * ~30-45s /live/company full-doc build so the stock-detail Key Stats card
 * doesn't have to wait on peers/institutional-ownership/technicals it doesn't
 * need. Field names match CompanyDoc wherever both carry the field, so the
 * card can read either without knowing which one it got.
 *
 * `partial` is true for a genuine summary; the endpoint can instead hand back
 * the full doc (no `partial` field) when this server instance already had it
 * in memory — callers should treat that the same as a full CompanyDoc.
 */
export interface CompanySummary {
  ticker: string;
  name: string | null;
  price: number | null;
  pctChange: number | null;
  prevClose: number | null;
  volume: number | null;
  marketCap: number | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  peRatio: number | null;
  eps: number | null;
  epsTtm: number | null;
  nextEarningsDate: string | null;
  dividendYield: number | null;
  dividendPerShare: number | null;
  high52: number | null;
  low52: number | null;
  pctFromHigh52: number | null;
  pctFromLow52: number | null;
  avgVolume20: number | null;
  partial?: boolean;
  source: string | null;
}
