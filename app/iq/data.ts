import type { CompanyDoc } from "./types";
// ============================================================
// STOCKWISE — MOCK DATA (TypeScript)
// ============================================================

export interface PulseItem {
  id?: string;
  label: string;
  value: number;
  change: number;
  open: number;
  prevClose: number;
  dayHigh?: number;
  dayLow?: number;
  proxyTicker?: string;
}
export interface Earning {
  ticker: string; name: string; session: string; marketCap: string; sector: string;
  // nullable: the live earnings feed supplies estimate/actual only, and not
  // for every row — a 0 default would read as a real forecast of zero.
  epsEstimate: number | null; epsActual: number | null;
  revenueEstimate: number | null; revenueActual: number | null;
  guidanceStatus: string | null; priceReaction: number | null;
  tags: string[]; owned: boolean; impliedMove: number | null;
}
export interface Mover {
  ticker: string; name: string; price: number; pctChange: number; rvolRatio: number; relativeStrength: number;
  maPosture: string; owned: boolean;
  sector: string;
  industry?: string | null;
  /** Market-cap bucket, derived from `marketCap` — see capFromMarketCap.
      'Micro' was missing from this union even though the board has always shown
      it, so every assignment was written `as Mover["cap"]` and the cast hid the
      gap from the compiler. '—' is the honest value for a ticker whose cap has
      not synced; the Market cap filter offers only the five real buckets, so an
      unknown row is never claimed by one. */
  cap: 'Mega' | 'Large' | 'Mid' | 'Small' | 'Micro' | '—';
  /** Raw USD market cap for the Movers table's "Mkt Cap" column; null when the
   *  ticker isn't in the tracked `companies` universe (many daily micro-caps). */
  marketCap: number | null;
  weekPct: number | null;
  /** Close the 5-day move is measured from; null when unknown. */
  weekBase: number | null;
  /** Last 6 dated closes, oldest → newest; lets the 5-day move be re-based to
   *  the live price's session. null/absent until the backend publishes it. */
  weekCloses?: { date: string; close: number }[] | null;
  techContext: string; newsContext: string;
}

/** Moving-average posture label from the two booleans on the company doc
 *  (aboveSma50 / aboveSma200, written by technical-indicators.job). Null on
 *  either → "—" so an un-synced ticker never reads as a real posture. */
export function maPostureLabel(above50?: boolean | null, above200?: boolean | null): string {
  if (above50 == null || above200 == null) return "—";
  if (above50 && above200) return "Above 50 & 200 DMA";
  if (!above50 && !above200) return "Below 50 & 200 DMA";
  return above50 ? "Above 50 · below 200" : "Below 50 · above 200";
}

// Leveraged / inverse ETF products (e.g. "T-REX 2X Long AXTI Daily ETF",
// "ProShares UltraPro …") routinely top the raw grouped-daily gainers but aren't
// stock movers. A normal operating company never carries both a multiplier
// ("2X"/"3X") and an ETF/ETN/Shares suffix, nor "leveraged/inverse/ultrapro/
// ultrashort", so the false-positive risk is negligible. Shared by the Movers
// screen and the Dashboard movers widget so both hide these the same way.
export function isLeveragedProduct(name: string | null | undefined): boolean {
  const n = name ?? "";
  if (/\b(leveraged?|inverse|ultrapro|ultrashort)\b/i.test(n)) return true;
  if (/\b[1-9](?:\.\d)?x\b/i.test(n) && /\b(etf|etn|shares)\b/i.test(n)) return true;
  return false;
}
export interface FolioItem {
  ticker: string; name: string;
  price: number;
  pctChange: number;
  /** Unrealized return % vs cost basis; 0 when no basis is stored. */
  gainLossPct: number;
  /** Average cost per share; null when the user hasn't entered one. */
  costBasis: number | null;
  positionSize: "Small" | "Medium" | "Large";
  conviction: "High" | "Medium" | "Low";
  eventNote: string;
}
export interface WatchItem {
  ticker: string; name: string; price: number; pctChange: number;
  nextEarningsDate: string; lastAnalystAction: string | null; hasOptions: boolean; latestHeadline: string;
}
/**
 * name/items (sector taxonomy + ticker membership) are fixed structural
 * config, same status as mergePulse's "which indices exist" — pctChange/trend
 * are only ever real, computed by the merge functions in heatmap.tsx and
 * dashboard.tsx from live sector/company data. This base array's own
 * pctChange/trend values are merge-input placeholders, never rendered as-is.
 */
export interface SectorRow { name: string; rank: number; trend: string | null; pctChange: number | null; items: [string, number, number][]; }
export interface ScreenerStock {
  ticker: string; name: string; sector: string;
  marketCap: number; peRatio: number;
  relativeStrength: number;
  salesGrowth: number;
  epsGrowth: number;
  grossMargin: number;
  rvolRatio: number;
  techRating: string;
}

// ---- Market Pulse (10 items) ----

// ---- What Matters Now ----
/** Extra market-wide facts some presets need, keyed by ticker. */
export interface PresetCtx {
  /** Distinct insiders with open-market buys in the last 90 days. */
  insiderBuyers90: Map<string, number>;
  /** Analyst upgrades in the last 30 days. */
  upgrades30: Map<string, number>;
}

/**
 * A preset screen. `test` decides membership from the company doc (unknown
 * data never passes). A preset whose criteria need data the app does not have
 * carries `unavailable` instead and is shown disabled, rather than silently
 * matching the whole universe.
 */
export interface ScreenerPreset {
  name: string;
  desc: string;
  test?: (c: CompanyDoc, ctx: PresetCtx) => boolean;
  needs?: Array<"insider" | "analyst">;
  unavailable?: string;
}

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const pct = (v: number | null | undefined) => (num(v) ? v * 100 : null);

export const screenerPresets: ScreenerPreset[] = [
  { name: 'Briefing growth screen', desc: 'RS ≥ 80 · sales growth ≥ 20% · EPS growth ≥ 25%',
    test: c => num(c.rsRating) && c.rsRating >= 80 && (pct(c.revenueGrowthYoY) ?? -1) >= 20 && (pct(c.epsGrowthYoY) ?? -1) >= 25 },
  { name: 'Post-earnings momentum', desc: 'up ≥ 3% today · RVOL > 2× · EPS growth > 0',
    test: c => num(c.pctChange) && c.pctChange >= 3 && num(c.rvol) && c.rvol > 2 && (pct(c.epsGrowthYoY) ?? -1) > 0 },
  { name: 'Oversold quality', desc: 'RSI < 35 · above 200-DMA · profitable (P/E > 0)',
    test: c => num(c.rsi14) && c.rsi14 < 35 && c.aboveSma200 === true && num(c.peRatio) && c.peRatio > 0 },
  { name: 'Unusual volume', desc: 'RVOL > 3× · price > $5',
    test: c => num(c.rvol) && c.rvol > 3 && num(c.price) && c.price > 5 },
  { name: 'CAN SLIM leaders', desc: "RS ≥ 90 · sales ≥ 15% · EPS ≥ 20% · within 15% of 52w high",
    test: c => num(c.rsRating) && c.rsRating >= 90 && (pct(c.revenueGrowthYoY) ?? -1) >= 15 && (pct(c.epsGrowthYoY) ?? -1) >= 20 && num(c.pctFromHigh52) && c.pctFromHigh52 >= -15 },
  { name: 'Minervini trend template', desc: 'price > 50-DMA > 200-DMA · ≥ 30% above 52w low · within 25% of high · RS ≥ 70',
    test: c => num(c.price) && num(c.sma50) && num(c.sma200) && c.price > c.sma50 && c.sma50 > c.sma200
      && num(c.low52) && c.price >= c.low52 * 1.3 && num(c.pctFromHigh52) && c.pctFromHigh52 >= -25 && num(c.rsRating) && c.rsRating >= 70 },
  { name: '52-week-high breakouts', desc: 'within 2% of 52w high · RVOL ≥ 1.5×',
    test: c => num(c.pctFromHigh52) && c.pctFromHigh52 >= -2 && num(c.rvol) && c.rvol >= 1.5 },
  { name: 'Gap-and-go', desc: 'up > 4% today · RVOL > 3×',
    test: c => num(c.pctChange) && c.pctChange > 4 && num(c.rvol) && c.rvol > 3 },
  { name: 'Relative-strength leaders', desc: 'RS ≥ 90 vs S&P over 6 months',
    test: c => num(c.rsRating) && c.rsRating >= 90 },
  { name: 'Dividend growth aristocrats', desc: '25-yr dividend growth · payout < 60%',
    unavailable: 'Needs 25 years of dividend history per stock, which the screener does not have yet.' },
  { name: 'Magic Formula (Greenblatt)', desc: 'high ROIC · high earnings yield',
    unavailable: 'Needs return on invested capital, which the screener does not have yet.' },
  { name: 'GARP', desc: 'sales & EPS growth ≥ 15% · PEG < 1.5',
    test: c => {
      const g = pct(c.epsGrowthYoY);
      return (pct(c.revenueGrowthYoY) ?? -1) >= 15 && g != null && g >= 15 && num(c.peRatio) && c.peRatio > 0 && c.peRatio / g < 1.5;
    } },
  { name: 'Deep value (low P/E)', desc: 'P/E between 0 and 12',
    test: c => num(c.peRatio) && c.peRatio > 0 && c.peRatio < 12 },
  { name: 'Net-net / asset value', desc: 'price < net current assets',
    unavailable: 'Needs balance-sheet current assets and liabilities, which the screener does not have yet.' },
  { name: 'Short-squeeze candidates', desc: 'short interest > 20% · rising price',
    unavailable: 'Needs short interest as a % of float, which the screener does not have yet.' },
  { name: 'Insider-buying cluster', desc: '3+ insiders bought on the open market in 90 days', needs: ["insider"],
    test: (c, ctx) => (ctx.insiderBuyers90.get(c.ticker) ?? 0) >= 3 },
  { name: 'Analyst-upgrade momentum', desc: '2+ analyst upgrades in 30 days', needs: ["analyst"],
    test: (c, ctx) => (ctx.upgrades30.get(c.ticker) ?? 0) >= 2 },
  { name: 'Golden cross (50>200)', desc: '50-DMA above the 200-DMA by less than 3% (a recent cross)',
    test: c => num(c.sma50) && num(c.sma200) && c.sma200 > 0 && c.sma50 > c.sma200 && c.sma50 / c.sma200 - 1 < 0.03 },
  { name: 'Volatility expansion', desc: '30-day volatility < 30% · moved ≥ 2% today on RVOL ≥ 1.5×',
    test: c => num(c.realizedVol30) && c.realizedVol30 < 30 && num(c.pctChange) && Math.abs(c.pctChange) >= 2 && num(c.rvol) && c.rvol >= 1.5 },
  { name: 'Cup-with-handle setups', desc: 'classic base · breakout pivot',
    unavailable: 'Needs chart-pattern detection, which the screener does not have yet.' },
];

// ---- Commentary (live intraday feed) ----