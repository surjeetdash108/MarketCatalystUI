/** One row of GET /live/quotes — the always-works poll fallback. */
export interface QuoteRow {
  ticker: string;
  name: string | null;
  /** Official close outside regular hours (see the backend's quoteRow). */
  price: number | null;
  pctChange: number | null;
  /** The latest pre-market / after-hours trade, when it has moved off the close. */
  extended?: { session: "pre-market" | "after-hours"; price: number; pctChange: number; at: number | null } | null;
}

/**
 * The poll fallback's tick is the LATEST trade: the extended one when there is
 * one, with its move measured from the same previous close — never the
 * official day move beside an after-hours price (a spliced pair).
 */
export function tickFromQuoteRow(q: QuoteRow & { price: number }): { price: number; pct: number | null; at: number | null } {
  const ext = q.extended ?? null;
  if (!ext) return { price: q.price, pct: q.pctChange ?? null, at: null };
  const prev = q.pctChange != null && q.pctChange !== -100 ? q.price / (1 + q.pctChange / 100) : null;
  return { price: ext.price, pct: prev != null && prev > 0 ? ((ext.price - prev) / prev) * 100 : null, at: ext.at };
}
