import type { DividendHistoryDoc } from "./types/dividend-history";

export interface ResolvedDividends {
  forwardPerShare: number | null;
  forwardYieldPct: number | null;
  trailingPerShare: number | null;
  trailingYieldPct: number | null;
  isPayer: boolean;
}

/**
 * Single source of truth for dividend metrics across Stock page, Financials card,
 * and SI. Routes through forwardAnnualDividend logic with the grace window.
 */
export function resolveDividends(params: {
  dh: DividendHistoryDoc | null | undefined;
  price?: number | null;
  fallbackDivPerShare?: number | null;
  fallbackYield?: number | null;
  nowMs?: number;
}): ResolvedDividends {
  const { dh, price, fallbackDivPerShare, fallbackYield } = params;

  if (dh) {
    // The doc's isPayer reflects active-payer status with the grace window. A
    // doc written before that flag existed has none: decide from its forward
    // amount instead of reading "missing" as "not a payer" (which blanked every
    // real payer until its doc was rebuilt).
    const isPayer = typeof dh.isPayer === "boolean" ? dh.isPayer : dh.forwardPerShare != null && dh.forwardPerShare > 0;
    if (!isPayer) {
      return {
        forwardPerShare: null,
        forwardYieldPct: null,
        trailingPerShare: null,
        trailingYieldPct: null,
        isPayer: false,
      };
    }
    const fwdPerShare = dh.forwardPerShare ?? fallbackDivPerShare ?? null;
    const fwdYield =
      dh.forwardYieldPct ??
      (price != null && price > 0 && fwdPerShare != null
        ? Math.round((fwdPerShare / price) * 10000) / 100
        : fallbackYield ?? null);
    const trailingPerShare = dh.trailingPerShare ?? dh.ttmTotal ?? null;
    const trailingYield =
      dh.trailingYieldPct ??
      (price != null && price > 0 && trailingPerShare != null
        ? Math.round((trailingPerShare / price) * 10000) / 100
        : null);

    return {
      forwardPerShare: fwdPerShare,
      forwardYieldPct: fwdYield,
      trailingPerShare,
      trailingYieldPct: trailingYield,
      isPayer: true,
    };
  }

  // Fallback before dividendHistory loads
  const hasFallback =
    (fallbackDivPerShare != null && fallbackDivPerShare > 0) ||
    (fallbackYield != null && fallbackYield > 0);
  return {
    forwardPerShare: hasFallback ? fallbackDivPerShare ?? null : null,
    forwardYieldPct: hasFallback ? fallbackYield ?? null : null,
    trailingPerShare: null,
    trailingYieldPct: null,
    isPayer: hasFallback,
  };
}
