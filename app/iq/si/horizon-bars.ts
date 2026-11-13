// Trade Builder → Market History: the card's Return / High / Low / Max
// drawdown / Volatility must describe the horizon the user picked (1M, 3M, 6M,
// 12M), not a fixed window with a changing label.

const HORIZON_MONTHS: Record<string, number> = { "1M": 1, "3M": 3, "6M": 6, "12M": 12, "1Y": 12 };

/** Calendar months covered by a Trade Builder horizon button. Unknown → 6. */
export function horizonMonths(hz: string): number {
  return HORIZON_MONTHS[hz] ?? 6;
}

/**
 * Keep the bars whose timestamp (ms) falls within the horizon, counted back
 * from the latest bar. Bars are expected oldest → newest.
 */
export function sliceBarsToHorizon<T extends { t: number }>(bars: T[], hz: string): T[] {
  if (bars.length === 0) return bars;
  const cutoff = new Date(bars[bars.length - 1].t);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - horizonMonths(hz));
  const from = cutoff.getTime();
  return bars.filter((b) => b.t >= from);
}

/**
 * Pick the bars for a horizon: the 1Y series covers every horizon; the 6M
 * series is only acceptable for horizons it fully spans (never for 12M, which
 * would silently show 6 months under a "12 MONTHS" heading). Returns null when
 * nothing usable is loaded.
 */
export function barsForHorizon<T extends { t: number }>(
  hz: string,
  yearBars: T[] | undefined,
  sixMonthBars: T[] | undefined,
  minBars = 10,
): T[] | null {
  const candidates: (T[] | undefined)[] = horizonMonths(hz) > 6 ? [yearBars] : [yearBars, sixMonthBars];
  for (const src of candidates) {
    if (!src || src.length < 2) continue;
    const sliced = sliceBarsToHorizon(src, hz);
    if (sliced.length >= minBars) return sliced;
  }
  return null;
}
