/** Price axis for the Alpha Signals detail chart: the bars' high/low range (close when a bar has none). */
export function priceAxis(bars: Array<{ h?: number | null; l?: number | null; c: number }>): { hi: number; lo: number } {
  const fin = (v: number | null | undefined, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  let hi = -Infinity, lo = Infinity;
  for (const b of bars) {
    hi = Math.max(hi, fin(b.h, b.c), b.c);
    lo = Math.min(lo, fin(b.l, b.c), b.c);
  }
  return { hi, lo };
}

/** After this long without data the chart says it is still trying. */
export const PRICE_CHART_SLOW_MS = 8000;

export type PriceChartState = "ready" | "loading" | "slow" | "failed" | "empty";

/** What the chart shows: the line, a loading line (then a slow one), a failure, or no data. */
export function priceChartState(x: { loading: boolean; error: string | null; waitedMs: number; points: number }): PriceChartState {
  if (x.points >= 3) return "ready";
  if (x.loading) return x.waitedMs >= PRICE_CHART_SLOW_MS ? "slow" : "loading";
  if (x.error) return "failed";
  return "empty";
}
