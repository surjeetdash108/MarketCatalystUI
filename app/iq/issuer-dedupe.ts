/**
 * Which listings the stock map counts: funds out, one company once.
 *
 * No company doc carries a `cik`, so grouping by CIK alone never merged anything.
 * On 24 Nov 2026 the Heatmap showed Alphabet three times (GOOGL, GOOG and GOOGM,
 * a depositary share of an Alphabet PREFERRED priced about $41 that carries the
 * whole company's $3.5T cap), Berkshire twice (BRK.A $1.23T and BRK.B at a
 * class-only $0.8T), and 43 ETFs ($7.3T, 42% of Finance's weight) sat among the
 * stocks. Mirrors BackEnd src/common/share-class-grouping.util.ts, which
 * sectors.job uses, so the Dashboard's stored sector % and this map agree.
 */

/** Instrument types that are funds, not companies. */
const FUND_TYPES = new Set(["ETF", "ETN", "ETV", "FUND"]);

/**
 * Instruments that ride on a company's shares but aren't them: warrants, rights,
 * units (SPAC "SP" units too). ENVXW, an Enovix warrant, sat on the map at
 * +109% on 25 Nov 2026 under the name "Enovix Corporation".
 */
const DERIVATIVE_TYPES = new Set(["WARRANT", "RIGHT", "UNIT", "SP"]);

export function isFundType(type: string | null | undefined): boolean {
  return type != null && FUND_TYPES.has(String(type).toUpperCase());
}

/** Not a company's own shares: a fund, or a warrant / right / unit. */
export function isNonStockType(type: string | null | undefined): boolean {
  if (type == null) return false;
  const t = String(type).toUpperCase();
  return FUND_TYPES.has(t) || DERIVATIVE_TYPES.has(t);
}

/**
 * The issuer a listing belongs to: its CIK when there is one, else its name with
 * the class / depositary wording removed ("Alphabet Inc. Depository Shs Repr
 * 1/20th Conv Pfd" and "Alphabet Inc." both become "alphabetinc"), else the
 * ticker itself.
 */
export function issuerKey(item: { ticker: string; name?: string | null; cik?: string | null }): string {
  if (item.cik) return `CIK_${String(item.cik).replace(/^0+/, "")}`;
  const name = (item.name ?? "")
    .toLowerCase()
    .replace(/\b(depositary|depository|preferred|pfd)\b.*$/, "")
    .replace(/[,.]?\s*\b(class|series|cl)\s+[a-z0-9]\b.*$/, "")
    .replace(/[^a-z0-9]/g, "");
  return name.length >= 4 ? `NAME_${name}` : `TKR_${item.ticker}`;
}

/** A depositary share of a preferred, not the company's own common stock. */
function isDepositaryName(name: string | null | undefined): boolean {
  return /\b(depositary|depository|preferred|pfd)\b/i.test(name ?? "");
}

/**
 * Funds removed, then one listing per issuer: an ordinary listing over a
 * depositary / preferred one (GOOGM carries Alphabet's whole cap and would
 * otherwise win), then the largest cap. Call it within one sector so unrelated
 * companies that happen to share a name are never merged.
 */
export function dedupeIssuers<
  T extends { ticker: string; name?: string | null; cik?: string | null; type?: string | null; marketCap?: number | null },
>(items: T[]): T[] {
  const best = new Map<string, T>();
  for (const item of items) {
    if (!item.ticker || isNonStockType(item.type)) continue;
    const key = issuerKey(item);
    const cur = best.get(key);
    if (!cur) {
      best.set(key, item);
      continue;
    }
    const itemDepo = isDepositaryName(item.name);
    const curDepo = isDepositaryName(cur.name);
    if (itemDepo !== curDepo) {
      if (!itemDepo) best.set(key, item);
    } else if ((item.marketCap ?? 0) > (cur.marketCap ?? 0)) {
      best.set(key, item);
    }
  }
  return [...best.values()].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
}
