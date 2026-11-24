/**
 * Summary of one stock's Form 4 insider trades over a window, for the stock
 * page's Insider Transactions tab. Only open-market trades count: code P is a
 * buy, code S a sell. Grants, option exercises, tax withholding and gifts move
 * shares but are not decisions to trade, so they are left out (same rule as
 * the transactions table).
 */
export interface InsiderTx {
  ownerName: string | null;
  transactionDate: string;
  transactionCode: string;
  shares: number;
  pricePerShare: number | null;
}

export interface InsiderWindowSummary {
  days: number;
  buys: number;
  sells: number;
  buyValue: number;
  sellValue: number;
  /** buyValue − sellValue. */
  netValue: number;
  buyers: number;
  sellers: number;
  largest: { owner: string; side: "buy" | "sell"; value: number; date: string } | null;
  /** One line a reader can act on, e.g. "Net buying: 3 insiders bought $4.2M". */
  verdict: string;
}

function isoDaysBefore(todayIso: string, days: number): string {
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function compactUsd(v: number): string {
  const a = Math.abs(v);
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K` : `$${a.toFixed(0)}`;
  return v < 0 ? `-${s}` : s;
}

export function summarizeInsiders(txns: readonly InsiderTx[], todayIso: string, days: number): InsiderWindowSummary {
  const from = isoDaysBefore(todayIso, days);
  let buys = 0, sells = 0, buyValue = 0, sellValue = 0;
  const buyers = new Set<string>(), sellers = new Set<string>();
  let largest: InsiderWindowSummary["largest"] = null;
  for (const t of txns) {
    if (!t.transactionDate || t.transactionDate < from || t.transactionDate > todayIso) continue;
    const side = t.transactionCode === "P" ? "buy" : t.transactionCode === "S" ? "sell" : null;
    if (!side) continue;
    const value = t.pricePerShare != null && t.pricePerShare > 0 ? t.shares * t.pricePerShare : 0;
    const owner = (t.ownerName ?? "Insider").trim() || "Insider";
    if (side === "buy") { buys++; buyValue += value; buyers.add(owner); }
    else { sells++; sellValue += value; sellers.add(owner); }
    if (value > 0 && (!largest || value > largest.value)) largest = { owner, side, value, date: t.transactionDate };
  }
  const netValue = buyValue - sellValue;
  const who = (n: number) => `${n} insider${n === 1 ? "" : "s"}`;
  let verdict: string;
  if (buys === 0 && sells === 0) verdict = `No open-market insider trades in the last ${days} days.`;
  else if (buys > 0 && sells === 0) verdict = `Buying only: ${who(buyers.size)} bought ${compactUsd(buyValue)}.`;
  else if (sells > 0 && buys === 0) verdict = `Selling only: ${who(sellers.size)} sold ${compactUsd(sellValue)}.`;
  else if (netValue >= 0) verdict = `Net buying: ${compactUsd(buyValue)} bought vs ${compactUsd(sellValue)} sold.`;
  else verdict = `Net selling: ${compactUsd(sellValue)} sold vs ${compactUsd(buyValue)} bought.`;
  return { days, buys, sells, buyValue, sellValue, netValue, buyers: buyers.size, sellers: sellers.size, largest, verdict };
}
