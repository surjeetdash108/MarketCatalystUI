/**
 * Frontend common equity filter:
 * Removes ETFs (ANV, SNDC), preferreds (FCNCN), warrants (XRPNW),
 * unclassified/sector-less symbols (USDE, MUU) from Most Searched,
 * Earnings Today, and Screener Leaders.
 * Strictly driven by schema metadata, security types, and sector completeness.
 * Strictly NO hardcoded ticker lists.
 */

export interface SecurityLike {
  ticker?: string | null;
  name?: string | null;
  sector?: string | null;
  type?: string | null;
  isEtf?: boolean | null;
  isFund?: boolean | null;
}

export function isCommonEquity<T extends SecurityLike>(item: T | null | undefined): boolean {
  if (!item) return false;

  // 1. Must carry a valid, real sector (removes sector-less and unclassified symbols)
  const sec = item.sector?.trim();
  if (!sec || sec === "—" || sec.toLowerCase() === "unknown" || sec.toLowerCase() === "none") {
    return false;
  }

  // 2. Boolean flags from vendor metadata
  if (item.isEtf === true || item.isFund === true) {
    return false;
  }

  // 3. Security type checks (CS and ADRC are valid equities)
  const t = item.type?.trim().toUpperCase();
  if (t) {
    if (
      t === "ETF" ||
      t === "ETN" ||
      t === "FUND" ||
      t === "PFD" ||
      t === "PREF" ||
      t === "WARRANT" ||
      t === "RIGHT" ||
      t === "UNIT" ||
      t === "BOND"
    ) {
      return false;
    }
  }

  // 4. Metadata name descriptors (ETF, Warrant, Preferred)
  if (item.name) {
    if (
      /\b(ETF|ETN|Exchange[- ]Traded Fund|Warrants?|Preferred Stock|Perpetual Preferred|Depositary Shares.*Preferred)\b/i.test(
        item.name,
      )
    ) {
      return false;
    }
  }

  return true;
}
