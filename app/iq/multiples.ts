/**
 * Multiples calculation and non-meaningful ("n/m") resolution.
 *
 * For banks/financials and non-meaningful multiples (GS, BAC, POST, CALM, TLYS, EPM),
 * displays "n/m" with a reason (e.g. "Not meaningful for financials", "Negative growth",
 * "Negative EBITDA", "Negative earnings"), never leaving a blank cell or dash.
 */

export interface MultipleResult {
  v: string;
  reason?: string;
  num: number;
}

export function resolvePeMultiple(
  livePe: number | null | undefined,
  epsTtm: number | null | undefined,
): MultipleResult {
  if (livePe != null && livePe > 0) {
    return { v: `${livePe.toFixed(1)}×`, num: livePe };
  }
  if ((epsTtm != null && epsTtm <= 0) || (livePe != null && livePe <= 0)) {
    return { v: "n/m", reason: "Negative earnings", num: 0 };
  }
  return { v: "—", num: 0 };
}

export function resolveFpeMultiple(
  fpe: number | null | undefined,
): MultipleResult {
  if (fpe != null && fpe > 0) {
    return { v: `${fpe.toFixed(1)}×`, num: fpe };
  }
  if (fpe != null && fpe <= 0) {
    return { v: "n/m", reason: "Negative forward EPS", num: 0 };
  }
  return { v: "—", num: 0 };
}

export function resolveEvEbitdaMultiple(
  isBank: boolean,
  enterpriseVal: number | null | undefined,
  ttmEbitda: number | null | undefined,
): MultipleResult {
  if (isBank) {
    return { v: "n/m", reason: "Not meaningful for financials", num: 0 };
  }
  if (enterpriseVal != null && ttmEbitda != null && Number.isFinite(ttmEbitda) && ttmEbitda > 0) {
    const val = enterpriseVal / ttmEbitda;
    return { v: `${val.toFixed(1)}×`, num: val };
  }
  if (ttmEbitda != null && ttmEbitda <= 0) {
    return { v: "n/m", reason: "Negative EBITDA", num: 0 };
  }
  return { v: "—", num: 0 };
}

export function resolvePegMultiple(
  isBank: boolean,
  livePe: number | null | undefined,
  expGrowth: number | null | undefined,
  epsTtm?: number | null | undefined,
): MultipleResult {
  if (isBank) {
    return { v: "n/m", reason: "Not meaningful for financials", num: 0 };
  }
  if (livePe != null && livePe > 0 && expGrowth != null && expGrowth > 0) {
    const val = livePe / expGrowth;
    return { v: val.toFixed(2), num: val };
  }
  if (expGrowth != null && expGrowth <= 0) {
    return { v: "n/m", reason: "Negative growth", num: 0 };
  }
  if ((livePe != null && livePe <= 0) || (epsTtm != null && epsTtm <= 0)) {
    return { v: "n/m", reason: "Negative earnings", num: 0 };
  }
  return { v: "—", num: 0 };
}

export function resolveFcfYieldMultiple(
  isBank: boolean,
  ttmFcf: number | null | undefined,
  mcap: number | null | undefined,
): MultipleResult {
  if (isBank) {
    return { v: "n/m", reason: "Not meaningful for financials", num: 0 };
  }
  if (ttmFcf != null && mcap != null && Number.isFinite(mcap) && mcap > 0) {
    const val = (ttmFcf / mcap) * 100;
    if (val >= 0) return { v: `${val.toFixed(1)}%`, num: val };
    return { v: "n/m", reason: "Negative FCF", num: 0 };
  }
  return { v: "—", num: 0 };
}
