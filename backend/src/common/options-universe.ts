/**
 * Curated tickers to sync options reference/pricing for — an editorial
 * choice (which underlyings have active enough options markets to be
 * worth the request budget), same pattern as FUND_UNIVERSE/MACRO_SERIES.
 * Kept small: each ticker costs ~1 contracts-reference call + up to
 * CONTRACTS_PER_TICKER aggs calls, paced under Polygon's free-tier rate cap.
 */
export const OPTIONS_UNIVERSE: string[] = [
  'AAPL',
  'MSFT',
  'NVDA',
  'TSLA',
  'AMZN',
  'META',
  'SPY',
  'QQQ',
];
