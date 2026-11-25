/**
 * Forward P/E and PEG for the stock page's Key statistics and the dashboard's
 * "Lowest forward P/E", from figures already on hand:
 *  - Forward P/E = price ÷ the next fiscal year's consensus EPS estimate.
 *  - PEG = trailing P/E ÷ expected EPS growth in % (next fiscal year's
 *    estimate vs trailing-twelve-month EPS).
 * Null whenever the figure isn't meaningful (no estimate, a loss, or growth
 * that isn't positive), rather than a misleading number.
 */

/**
 * A forward P/E under a quarter of the trailing P/E means earnings quadrupling
 * in a year, which in practice is an estimate in another currency: FMP gives
 * PDD's EPS estimate in yuan against a dollar price (1.2× forward vs 8.5×
 * trailing, 26 Nov 2026). Such a figure is dropped.
 */
export const MIN_FWD_TO_TRAILING = 0.25;

export function forwardPe(
  price: number | null | undefined,
  nextFyEps: number | null | undefined,
  trailingPe?: number | null,
): number | null {
  if (price == null || !(price > 0) || nextFyEps == null || !(nextFyEps > 0)) return null;
  const pe = price / nextFyEps;
  if (trailingPe != null && trailingPe > 0 && pe < trailingPe * MIN_FWD_TO_TRAILING) return null;
  return pe;
}

export function pegRatio(
  trailingPe: number | null | undefined,
  ttmEps: number | null | undefined,
  nextFyEps: number | null | undefined,
): number | null {
  if (trailingPe == null || !(trailingPe > 0) || ttmEps == null || !(ttmEps > 0) || nextFyEps == null) return null;
  // Same currency guard as forwardPe: growth of 300%+ is a unit mismatch.
  if (nextFyEps / ttmEps > 1 / MIN_FWD_TO_TRAILING) return null;
  const growthPct = (nextFyEps / ttmEps - 1) * 100;
  if (!(growthPct > 0)) return null;
  return trailingPe / growthPct;
}
