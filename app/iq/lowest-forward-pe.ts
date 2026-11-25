/**
 * The dashboard's "Lowest forward P/E": companies ranked by price ÷ next
 * fiscal year's consensus EPS (nextFyEps, stored by the backend's
 * forward-estimates job for S&P 500 and Nasdaq-100 members). Losses (no
 * positive estimate) are left out, as is anything under a 1× multiple, which
 * is a bad estimate or a stale price rather than a bargain. An estimate in
 * another currency (forward under a quarter of trailing P/E) is dropped too
 * (see forward-valuation.ts).
 */
import { forwardPe } from "./forward-valuation";

export interface ForwardPeSource {
  ticker?: string | null;
  name?: string | null;
  price?: number | null;
  nextFyEps?: number | null;
  peRatio?: number | null;
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
    const pe = forwardPe(c.price, c.nextFyEps, c.peRatio);
    if (pe == null || !(pe >= 1) || c.price == null) continue;
    seen.add(t);
    out.push({ ticker: t, name: c.name ?? null, price: c.price, forwardPe: pe });
  }
  return out.sort((a, b) => a.forwardPe - b.forwardPe).slice(0, limit);
}
