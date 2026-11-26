/**
 * Four-quarter averages and peer averages for the Stock Intelligence scores, from the redesign. Growth is measured
 * against the same fiscal quarter a year earlier, each quarter's growth is capped at +-100% so one hypergrowth
 * quarter cannot dominate, and a peer average needs at least three competitors with data.
 */

/** The parts of a reported quarter these averages read. */
export type FactQuarter = {
  endDate?: string | null;
  fiscalPeriod?: string | null;
  fiscalYear?: string | number | null;
  revenue?: number | null;
  epsActual?: number | null;
  operatingIncome?: number | null;
  grossProfit?: number | null;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const mean = (xs: ReadonlyArray<number>): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Newest first, quarters without an end date left out. */
const newestFirst = (quarters: ReadonlyArray<FactQuarter> | null | undefined) =>
  [...(quarters ?? [])].filter((q) => q.endDate).sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));

const yearAgoOf = (list: ReadonlyArray<FactQuarter>, q: FactQuarter) =>
  list.find((o) => o.fiscalPeriod === q.fiscalPeriod && Number(o.fiscalYear) === Number(q.fiscalYear) - 1);

/**
 * Year-over-year growth, in percent, of each of the latest four quarters whose year-ago figure is above `minBase`
 * (so a zero or negative base, or EPS within 5 cents of zero, is skipped), each capped at +-100%.
 */
export function yoyGrowths(quarters: ReadonlyArray<FactQuarter> | null | undefined, value: (q: FactQuarter) => number | null | undefined, minBase = 0): number[] {
  const list = newestFirst(quarters);
  const out: number[] = [];
  for (const q of list.slice(0, 4)) {
    const now = value(q);
    const before = value(yearAgoOf(list, q) ?? {});
    if (finite(now) && finite(before) && before > minBase) out.push(Math.max(-100, Math.min(100, ((now - before) / before) * 100)));
  }
  return out;
}

export const revenueGrowths = (q: ReadonlyArray<FactQuarter> | null | undefined) => yoyGrowths(q, (x) => x.revenue);
export const epsGrowths = (q: ReadonlyArray<FactQuarter> | null | undefined) => yoyGrowths(q, (x) => x.epsActual, 0.05);

/** Operating income as a percent of revenue, for each of the latest four quarters that have both. */
export function operatingMargins(quarters: ReadonlyArray<FactQuarter> | null | undefined): number[] {
  return newestFirst(quarters)
    .slice(0, 4)
    .flatMap((q) => (finite(q.revenue) && q.revenue > 0 && finite(q.operatingIncome) ? [(q.operatingIncome / q.revenue) * 100] : []));
}

/** Gross profit as a percent of revenue, for each of the latest four quarters that have both. */
export function grossMargins(quarters: ReadonlyArray<FactQuarter> | null | undefined): number[] {
  return newestFirst(quarters)
    .slice(0, 4)
    .flatMap((q) => (finite(q.revenue) && q.revenue > 0 && finite(q.grossProfit) ? [(q.grossProfit / q.revenue) * 100] : []));
}

export type PeerStats = {
  tickers: string[];
  revGrowth: number | null;
  epsGrowth: number | null;
  opMargin: number | null;
  grossMargin: number | null;
};

/**
 * The peers' average of each peer's own four-quarter average. With fewer than three peers that have reported
 * quarters there is no peer average at all (null).
 */
export function peerStats(byTicker: Record<string, ReadonlyArray<FactQuarter> | null | undefined>): PeerStats | null {
  const tickers: string[] = [];
  const rev: number[] = [];
  const eps: number[] = [];
  const op: number[] = [];
  const gross: number[] = [];
  for (const [ticker, quarters] of Object.entries(byTicker)) {
    if (!quarters?.length) continue;
    tickers.push(ticker);
    const r = mean(revenueGrowths(quarters));
    const e = mean(epsGrowths(quarters));
    const o = mean(operatingMargins(quarters));
    const g = mean(grossMargins(quarters));
    if (r != null) rev.push(r);
    if (e != null) eps.push(e);
    if (o != null) op.push(o);
    if (g != null) gross.push(g);
  }
  if (tickers.length < 3) return null;
  return { tickers, revGrowth: mean(rev), epsGrowth: mean(eps), opMargin: mean(op), grossMargin: mean(gross) };
}

/** The average of the positive values, and how many there were, once at least three peers have one. */
export function peerAverage(values: Record<string, number | null | undefined>): { avg: number; n: number } | null {
  const v = Object.values(values).filter((x): x is number => finite(x) && x > 0);
  return v.length >= 3 ? { avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null;
}

/** The top analysts' targets: the latest target from each of up to five distinct firms, newest first. */
export function analystTargetList(
  grades: ReadonlyArray<{ date?: string | null; firm?: string | null; priceTarget?: number | null }> | null | undefined,
): number[] | null {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const g of [...(grades ?? [])].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))) {
    const target = finite(g.priceTarget) ? g.priceTarget : null;
    const firm = (g.firm ?? "").toLowerCase();
    if (target == null || target <= 0 || !firm || seen.has(firm)) continue;
    seen.add(firm);
    out.push(target);
    if (out.length === 5) break;
  }
  return out.length ? out : null;
}
