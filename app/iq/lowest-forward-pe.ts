/**
 * The dashboard's "Lowest forward P/E": companies ranked by price ÷ next
 * fiscal year's consensus EPS (nextFyEps, stored by the backend's
 * forward-estimates job for S&P 500 and Nasdaq-100 members). Losses (no
 * positive estimate) are left out, as is anything under a 1× multiple, which
 * is a bad estimate or a stale price rather than a bargain.
 */
export interface ForwardPeSource {
  ticker?: string | null;
  name?: string | null;
  price?: number | null;
  nextFyEps?: number | null;
  marketCap?: number | null;
}

export interface ForwardPeRow {
  ticker: string;
  name: string | null;
  price: number;
  forwardPe: number;
}

export function lowestForwardPe(companies: readonly ForwardPeSource[], limit = 10): ForwardPeRow[] {
  const seen = new Set<string>();
  const out: ForwardPeRow[] = [];
  for (const c of companies) {
    const t = (c.ticker ?? "").trim().toUpperCase();
    if (!t || seen.has(t)) continue;
    if (c.price == null || !(c.price > 0) || c.nextFyEps == null || !(c.nextFyEps > 0)) continue;
    const pe = c.price / c.nextFyEps;
    if (!(pe >= 1)) continue;
    seen.add(t);
    out.push({ ticker: t, name: c.name ?? null, price: c.price, forwardPe: pe });
  }
  return out.sort((a, b) => a.forwardPe - b.forwardPe).slice(0, limit);
}
