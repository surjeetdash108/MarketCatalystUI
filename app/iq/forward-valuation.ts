/**
 * Forward P/E and PEG for the stock page's Key statistics, from figures the
 * page already holds:
 *  - Forward P/E = price ÷ the next fiscal year's consensus EPS estimate.
 *  - PEG = trailing P/E ÷ expected EPS growth in % (next fiscal year's
 *    estimate vs trailing-twelve-month EPS).
 * Null whenever the figure isn't meaningful (no estimate, a loss, or growth
 * that isn't positive), rather than a misleading number.
 */
export function forwardPe(price: number | null | undefined, nextFyEps: number | null | undefined): number | null {
  if (price == null || !(price > 0) || nextFyEps == null || !(nextFyEps > 0)) return null;
  return price / nextFyEps;
}

export function pegRatio(
  trailingPe: number | null | undefined,
  ttmEps: number | null | undefined,
  nextFyEps: number | null | undefined,
): number | null {
  if (trailingPe == null || !(trailingPe > 0) || ttmEps == null || !(ttmEps > 0) || nextFyEps == null) return null;
  const growthPct = (nextFyEps / ttmEps - 1) * 100;
  if (!(growthPct > 0)) return null;
  return trailingPe / growthPct;
}
