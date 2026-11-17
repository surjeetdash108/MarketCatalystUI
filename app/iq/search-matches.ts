/**
 * The ticker search's matching and ranking — one definition shared by Market
 * Catalyst's search box (shell.tsx) and the admin console's ticker picker
 * (Market Catalyst Pulse), so both list the same stocks in the same order.
 *
 * Empty query: the 15 largest companies by market cap (quick access).
 * Otherwise: /live/search results plus company-list name/ticker substring
 * matches, ranked exact ticker → ticker prefix → name prefix → substring.
 */

export interface SearchMatch {
  sym: string;
  name: string | null;
  price: number | null;
  pctChange: number | null;
}

interface CompanyLike {
  ticker: string;
  name: string | null;
  price: number | null;
  pctChange: number | null;
  marketCap?: number | null;
}

interface TickerResultLike {
  ticker: string;
  name: string | null;
  price?: number | null;
  pctChange?: number | null;
}

export const QUICK_ACCESS_COUNT = 15;

export function searchMatchesFor(
  query: string,
  tickerResults: TickerResultLike[],
  companies: CompanyLike[],
): SearchMatch[] {
  if (!query) {
    return [...companies]
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
      .slice(0, QUICK_ACCESS_COUNT)
      .filter(c => !!c.ticker)
      .map(c => ({ sym: c.ticker, name: c.name, price: c.price, pctChange: c.pctChange }));
  }
  const q = query.trim().toLowerCase();
  const upper = query.trim().toUpperCase();
  const bySym = new Map(tickerResults.map(r => [r.ticker, r]));
  // A handful of live `companies` docs are written by side-jobs (news count,
  // fundamentals growth) that can create the doc before the primary sync job
  // ever sets `ticker` — guard rather than crash on that partial data.
  const nameMatched = companies.filter(
    c => !!c.ticker && ((c.name ?? "").toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q)) && !bySym.has(c.ticker),
  );
  const candidates: SearchMatch[] = [
    ...tickerResults.map(r => ({ sym: r.ticker, name: r.name, price: r.price ?? null, pctChange: r.pctChange ?? null })),
    ...nameMatched.map(c => ({ sym: c.ticker, name: c.name, price: c.price, pctChange: c.pctChange })),
  ];

  const exact: SearchMatch[] = [];
  const tickerPrefix: SearchMatch[] = [];
  const namePrefix: SearchMatch[] = [];
  const substring: SearchMatch[] = [];
  for (const item of candidates) {
    const symUpper = (item.sym ?? "").toUpperCase();
    const nameLower = (item.name ?? "").toLowerCase();
    if (symUpper === upper) exact.push(item);
    else if (symUpper.startsWith(upper)) tickerPrefix.push(item);
    else if (nameLower.startsWith(q)) namePrefix.push(item);
    else substring.push(item);
  }
  return [...exact, ...tickerPrefix, ...namePrefix, ...substring];
}
