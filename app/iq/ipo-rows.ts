/**
 * Rules for the IPO screen's rows, kept pure so they can be tested.
 *
 * The IPO feed (Polygon) mixes real IPOs with new ETFs, SPAC units, warrants
 * and rights, and its status is a snapshot from the announcement: a deal that
 * has since listed can still read "pending" (FMBM, 19 Nov 2026).
 */
export interface IpoLike {
  symbol?: string | null;
  name?: string | null;
  date?: string | null;
  status?: string | null;
  securityType?: string | null;
  currentPrice?: number | null;
}

/** Polygon ticker types that are not an operating company's shares. */
const NON_COMMON_TYPES = new Set(["WARRANT", "UNIT", "RIGHT", "ETF", "ETN", "ETV", "ETS", "FUND", "SP"]);

/** The kind of security, for a small tag beside the symbol; null for ordinary shares. */
export function listingKind(e: IpoLike): "ETF" | "Warrant" | "Unit" | "Right" | null {
  const t = (e.securityType ?? "").toUpperCase();
  const sym = (e.symbol ?? "").toUpperCase();
  const name = e.name ?? "";
  if (["ETF", "ETN", "ETV", "ETS", "FUND"].includes(t) || /\bETF\b/i.test(name)) return "ETF";
  if (t === "WARRANT" || /(^[A-Z]{4}W$)|[.-]WS?$/.test(sym)) return "Warrant";
  if (t === "UNIT" || t === "SP" || /(^[A-Z]{4}U$)|[.-]U$/.test(sym)) return "Unit";
  if (t === "RIGHT" || /(^[A-Z]{4}R$)|[.-]R$/.test(sym)) return "Right";
  return null;
}

/** True for ETFs, warrants, units and rights: not a company going public. */
export function isNonCommonListing(e: IpoLike): boolean {
  return NON_COMMON_TYPES.has((e.securityType ?? "").toUpperCase()) || listingKind(e) !== null;
}

/**
 * Has it started trading? A past/today date and a price: a stored aftermarket
 * price or a live quote. The feed's "history" status alone isn't proof: OPAY
 * (30 Oct 2026) reads "history" but neither vendor has a single trade for it.
 */
export function hasListed(e: IpoLike, livePrice: number | null, today: string): boolean {
  if (!e.date || e.date > today || e.status === "withdrawn") return false;
  return e.currentPrice != null || (livePrice != null && livePrice > 0);
}

/**
 * A real IPO has an offer price (final, or the marketed range). Feed rows with
 * none are exchange transfers and direct listings of companies already trading
 * (GM, HLT, Nov 2026), so they have no offer to measure a return against.
 */
export function hasOfferPrice(e: { offerPrice?: number | null; priceLow?: number | null; priceHigh?: number | null }): boolean {
  return [e.offerPrice, e.priceLow, e.priceHigh].some(v => v != null && v > 0);
}

/**
 * The status to show: "history" (Listed) once it trades, whatever the stored
 * feed status says; "not_listed" when its date has passed and it never started
 * trading (postponed deals such as SEAM, rescheduled four times in Nov 2026),
 * so a past date doesn't read "Pending".
 */
export function displayStatus(e: IpoLike, livePrice: number | null, today: string): string {
  if (e.status === "withdrawn") return "withdrawn";
  if (hasListed(e, livePrice, today)) return "history";
  if (e.date && e.date < today && ["pending", "new", "expected", "priced", "filed", "history"].includes(e.status ?? "pending")) return "not_listed";
  return e.status ?? "pending";
}
