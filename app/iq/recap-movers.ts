/**
 * Top gainers / top losers for the Recap screen: today's biggest moves among
 * companies of at least $1B market cap (the Movers screen's default floor),
 * leveraged and inverse products left out.
 */
export interface RecapMoverRow {
  ticker: string;
  name: string | null;
  price: number | null;
  pctChange: number;
}

export interface RecapMoverSource {
  ticker?: string | null;
  name?: string | null;
  price?: number | null;
  pctChange?: number | null;
  marketCap?: number | null;
}

export const RECAP_MOVER_MIN_CAP = 1e9;

export function recapMovers(
  companies: readonly RecapMoverSource[],
  isLeveraged: (name: string) => boolean,
  limit = 10,
): { gainers: RecapMoverRow[]; losers: RecapMoverRow[] } {
  const seen = new Set<string>();
  const rows: RecapMoverRow[] = [];
  for (const c of companies) {
    const t = (c.ticker ?? "").trim().toUpperCase();
    if (!t || seen.has(t)) continue;
    if (c.pctChange == null || !Number.isFinite(c.pctChange) || c.pctChange === 0) continue;
    if (c.marketCap == null || c.marketCap < RECAP_MOVER_MIN_CAP) continue;
    if (isLeveraged(c.name ?? "")) continue;
    seen.add(t);
    rows.push({ ticker: t, name: c.name ?? null, price: c.price ?? null, pctChange: c.pctChange });
  }
  const gainers = rows.filter(r => r.pctChange > 0).sort((a, b) => b.pctChange - a.pctChange).slice(0, limit);
  const losers = rows.filter(r => r.pctChange < 0).sort((a, b) => a.pctChange - b.pctChange).slice(0, limit);
  return { gainers, losers };
}
