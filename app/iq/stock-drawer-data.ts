/**
 * Stock detail drawer data resolution.
 *
 * Resolves live quote and computed values at the moment of click from the caller's
 * context (e.g. Money Flow tile or card) and the app-wide live quote provider,
 * falling back to the stored company document.
 *
 * Ensures one source of truth between the page/popover and the opened detail window,
 * and prevents empty windows for stocks not yet in the stored collection.
 */

export interface StockDrawerContext {
  price?: number | null;
  pctChange?: number | null;
  rvol?: number | null;
  marketCap?: number | null;
  name?: string | null;
  sector?: string | null;
  sectorPctChange?: number | null;
  rsRating?: number | null;
}

export interface StockDrawerResolved {
  sym: string;
  name: string;
  sector: string | null;
  price: number | null;
  pctChange: number | null;
  rvol: number | null;
  rsRating: number | null;
  marketCap: number | null;
  marketCapText: string | null;
  sectorPctChange: number | null;
  sectorSentence: {
    sectorName: string;
    direction: "up" | "down";
    pctText: string;
    relation: string;
    text: string;
  } | null;
  hasData: boolean;
}

export function formatDrawerMarketCap(mc: number | null | undefined): string | null {
  if (mc == null || !Number.isFinite(mc) || mc <= 0) return null;
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`;
  return `$${mc.toLocaleString()}`;
}

export function computeSectorSentence(
  sector: string,
  stockPct: number,
  sectorPct: number,
): { sectorName: string; direction: "up" | "down"; pctText: string; relation: string; text: string } {
  const stockUp = stockPct >= 0;
  const secUp = sectorPct >= 0;
  const direction: "up" | "down" = secUp ? "up" : "down";
  const pctText = `${secUp ? "+" : ""}${sectorPct.toFixed(2)}%`;
  let relation = "";
  if (stockUp && secUp) {
    relation = "in line with sector strength.";
  } else if (!stockUp && !secUp) {
    relation = "in line with sector weakness.";
  } else if (stockUp && !secUp) {
    relation = "bucking its sector today (advancing despite sector weakness).";
  } else {
    relation = "lagging its sector today (declining despite sector strength).";
  }
  const text = `Its group, ${sector}, is ${direction} ${pctText} today — ${relation}`;
  return { sectorName: sector, direction, pctText, relation, text };
}

export function resolveStockDrawerData(
  sym: string,
  context?: StockDrawerContext | null,
  live?: { price?: number | null; pctChange?: number | null; marketCap?: number | null; name?: string | null } | null,
  company?: { name?: string | null; sector?: string | null; price?: number | null; pctChange?: number | null; rvol?: number | null; rsRating?: number | null; marketCap?: number | null } | null,
  sectorsLive?: Array<{ sector: string; pctChange: number }> | null,
): StockDrawerResolved {
  const name = context?.name ?? live?.name ?? company?.name ?? sym;
  const sector = context?.sector ?? company?.sector ?? null;
  const price = context?.price ?? live?.price ?? company?.price ?? null;
  const pctChange = context?.pctChange ?? live?.pctChange ?? company?.pctChange ?? null;
  const rvol = context?.rvol ?? company?.rvol ?? null;
  const rsRating = context?.rsRating ?? company?.rsRating ?? null;
  const marketCap = context?.marketCap ?? live?.marketCap ?? company?.marketCap ?? null;
  const marketCapText = formatDrawerMarketCap(marketCap);

  let sectorPctChange: number | null = context?.sectorPctChange ?? null;
  if (sectorPctChange == null && sector && sectorsLive) {
    const sDoc = sectorsLive.find((s) => s.sector.toLowerCase() === sector.toLowerCase());
    if (sDoc && Number.isFinite(sDoc.pctChange)) {
      sectorPctChange = sDoc.pctChange;
    }
  }

  let sectorSentence: StockDrawerResolved["sectorSentence"] = null;
  if (sector && sectorPctChange != null && pctChange != null) {
    sectorSentence = computeSectorSentence(sector, pctChange, sectorPctChange);
  }

  const hasData = !!(context || (live && live.price != null) || company);

  return {
    sym,
    name,
    sector,
    price,
    pctChange,
    rvol,
    rsRating,
    marketCap,
    marketCapText,
    sectorPctChange,
    sectorSentence,
    hasData,
  };
}

