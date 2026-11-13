import { fmtMarketDate } from "../calendar-range";
import { surprisePct } from "../types";
import { StockItem, DetailStock, SITab, UpcomingEvent, MajorSixMonthEvent, AssessSeg, EventMetric, EventContext } from "./types";
import { FILLER_RE, isHoldingsNote, isSolicitation, mentionedDayOffset, pickMoveHeadline, pickRecentMove } from "./move-headline";
import { scoreNews, articleTime, type SignificanceTier } from "./news-significance";
export type { MajorSixMonthEvent };

export const UP = "#4ade80";
export const DN = "#f05656";
export const STEEL = "#7fa8d0";

export const TABS: [SITab, string][] = [
  ["overview", "OVERVIEW"],
  ["moved", "WHY IT MOVED"],
  ["could", "WHY IT COULD MOVE"],
  ["fund", "FUNDAMENTALS"],
  ["tech", "TECHNICALS"],
  ["cat", "CATALYSTS"],
  ["ai", "AI RESEARCH"],
  ["lab", "TRADE BUILDER"],
  ["mon", "TRADE TRACKER"],
];

export const LG_COL: Record<string, [string, string]> = {
  NVDA: ["#76b900", "#fff"],
  AAPL: ["#f4f4f4", "#111"],
  MSFT: ["#f4f4f4", "#f25022"],
  AVGO: ["#f4f4f4", "#cc092f"],
  GOOGL: ["#f4f4f4", "#4285f4"],
  AMZN: ["#ff9900", "#111"],
  META: ["#0866ff", "#fff"],
  TSLA: ["#e31937", "#fff"],
  AMD: ["#141414", "#fff"],
  TSM: ["#c4161c", "#fff"],
  MU: ["#0b3d91", "#fff"],
  PLTR: ["#141414", "#fff"],
  INTC: ["#0068b5", "#fff"],
  QCOM: ["#3253dc", "#fff"],
  ARM: ["#0091bd", "#fff"],
  SNOW: ["#29b5e8", "#fff"],
  CRWD: ["#e3171b", "#fff"],
  NOW: ["#1f3a3a", "#81b5a1"],
  ORCL: ["#f80000", "#fff"],
  STRL: ["#1e3a8a", "#fff"],
};

export function LG(t: string) {
  const c = LG_COL[t] || ["#2a3a4a", "#e8eef4"];
  return {
    bg: c[0],
    fg: c[1],
    lbl: t.slice(0, t.length > 3 ? 2 : 1),
  };
}

export const KEYS = [
  "Momentum",
  "Volume",
  "Relative Strength",
  "Sector",
  "News",
  "Options",
  "Market Regime",
];


/**
 * Popular tickers on the Stock Intelligence landing page — names only. Prices
 * and changes always come from live quotes; nothing here is market data.
 */
export const POPULAR: Record<string, string> = {
  NVDA: "NVIDIA Corporation",
  AMD: "Advanced Micro Devices",
  MU: "Micron Technology",
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  META: "Meta Platforms, Inc.",
  GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com, Inc.",
  TSLA: "Tesla, Inc.",
  PLTR: "Palantir Technologies",
  AVGO: "Broadcom Inc.",
  STRL: "Sterling Infrastructure",
};

export const ORDER = Object.keys(POPULAR);

/** Dollars with cents; a missing value (no target, no price) reads "—". */
export function usd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(v: number): string {
  return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%";
}

export function pct1(v: number): string {
  return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "%";
}

export function sc(v: number): string {
  return v >= 65 ? UP : v <= 45 ? DN : STEEL;
}

export const CATS_T: [string, string][] = [
  ["BUS", "Business / Fundamentals"],
  ["EARN", "Earnings / Estimate Revisions"],
  ["TECH", "Technical / Market"],
  ["CAT", "Catalysts"],
  ["VAL", "Valuation"],
  ["POS", "Positioning / Options"],
  ["MAC", "Macro / Market Regime"],
];

export const SHORT: Record<string, string> = {
  BUS: "BUSINESS",
  EARN: "EARNINGS",
  TECH: "TECHNICALS",
  CAT: "CATALYSTS",
  VAL: "VALUATION",
  POS: "FLOWS",
  MAC: "MACRO",
};

/**
 * Everything the Stock Intelligence engine is allowed to reason from — all of
 * it real data the page already loads (FMP company/quote/financials/estimates/
 * analyst/13F/insider feeds, our own technicals and news). Every field is
 * nullable: a missing input drops the drivers and text that would need it
 * instead of being filled with a placeholder.
 */
export interface SiFacts {
  price: number | null;
  changePct: number | null;
  sector: string | null;
  // Fundamentals (latest reported quarter)
  revGrowthYoY: number | null; // % vs the same quarter a year earlier
  grossMargin: number | null; // %
  opMargin: number | null; // %
  opMarginYearAgo: number | null; // %
  epsBeats: number | null; // of the last `epsReports` reports
  epsReports: number | null;
  // FMP consensus estimates
  fwdEps: number | null; // current fiscal year
  nextFyEps: number | null; // next fiscal year
  trailingPe: number | null;
  // Analysts (FMP)
  consensus: string | null;
  buyCount: number | null;
  holdCount: number | null;
  sellCount: number | null;
  targetMean: number | null;
  upgrades90: number | null;
  downgrades90: number | null;
  // Technicals
  sma9: number | null; // simple averages of the last 9 / 21 daily closes
  sma21: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  rvol: number | null;
  rsRating: number | null;
  pctFromHigh52: number | null;
  beta: number | null;
  realizedVol30: number | null;
  pivotR1: number | null;
  pivotR2: number | null;
  pivotS1: number | null;
  pivotS2: number | null;
  sectorRank: number | null;
  sectorRankTotal: number | null;
  // Positioning
  instOwnershipPct: number | null;
  instHoldersChange: number | null;
  instSharesChange: number | null;
  instPutCallRatio: number | null;
  insiderNet90: number | null; // $ open-market buys minus sells, last 90 days
  // Catalysts
  daysToEarnings: number | null;
  newsPos: number | null; // last 7 days: articles about the stock, no filler
  newsNeg: number | null;
  /** Of those, the high-impact ones. */
  newsHighPos?: number | null;
  newsHighNeg?: number | null;
  /** Impact-weighted counts the News sentiment score is built from (falls back to newsPos / newsNeg). */
  newsWPos?: number | null;
  newsWNeg?: number | null;
}

export const EMPTY_FACTS: SiFacts = {
  price: null, changePct: null, sector: null,
  revGrowthYoY: null, grossMargin: null, opMargin: null, opMarginYearAgo: null, epsBeats: null, epsReports: null,
  fwdEps: null, nextFyEps: null, trailingPe: null,
  consensus: null, buyCount: null, holdCount: null, sellCount: null, targetMean: null, upgrades90: null, downgrades90: null,
  sma9: null, sma21: null, sma50: null, sma200: null, rsi14: null, rvol: null, rsRating: null, pctFromHigh52: null, beta: null, realizedVol30: null,
  pivotR1: null, pivotR2: null, pivotS1: null, pivotS2: null, sectorRank: null, sectorRankTotal: null,
  instOwnershipPct: null, instHoldersChange: null, instSharesChange: null, instPutCallRatio: null, insiderNet90: null,
  daysToEarnings: null, newsPos: null, newsNeg: null,
};

/** "4 high-impact (3 negative, 1 positive) · 20 positive / 14 negative other headlines (7 days)". */
export function newsSentimentText(f: Pick<SiFacts, "newsPos" | "newsNeg" | "newsHighPos" | "newsHighNeg">): string {
  const pos = f.newsPos ?? 0, neg = f.newsNeg ?? 0;
  const hp = f.newsHighPos ?? 0, hn = f.newsHighNeg ?? 0;
  if (hp + hn === 0) return `${pos} positive / ${neg} negative headlines (7 days)`;
  const parts = [hn ? `${hn} negative` : null, hp ? `${hp} positive` : null].filter(Boolean).join(", ");
  return `${hp + hn} high-impact (${parts}) · ${pos - hp} positive / ${neg - hn} negative other headlines (7 days)`;
}

const clamp = (v: number, lo = 5, hi = 95) => Math.max(lo, Math.min(hi, v));
const has = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** Simple average of the last `n` closes (oldest → newest); null until there are `n` of them. */
export function smaOf(closes: ReadonlyArray<number>, n: number): number | null {
  if (closes.length < n) return null;
  let sum = 0;
  for (let i = closes.length - n; i < closes.length; i++) sum += closes[i];
  const avg = sum / n;
  return Number.isFinite(avg) ? Math.round(avg * 100) / 100 : null;
}
const compactUsd = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : `$${Math.round(a / 1e3)}K`;
  return (v < 0 ? "−" : "") + s;
};

/**
 * Forward P/E on the NEXT fiscal year's EPS estimate (Yahoo's basis). The year
 * in progress is used only when no next-year estimate exists at all — never
 * because the next year's EPS is negative (PLAY showed 54.9× on this year's
 * small profit while next year's consensus is a loss). Null when the EPS used
 * is not positive: a P/E on a loss is not meaningful.
 */
export function forwardPe(f: SiFacts): number | null {
  const eps = has(f.nextFyEps) ? f.nextFyEps : f.fwdEps;
  return has(f.price) && has(eps) && eps > 0 ? +(f.price / eps).toFixed(1) : null;
}

type Driver = [cat: string, name: string, value: string, score: number, flags: string, dd: number];

/**
 * Thesis drivers, each scored 0–100 by a transparent rule from ONE real input.
 * A driver whose input is missing is simply absent (its category then scores
 * on the drivers it does have, or neutral 50 with none).
 */
export function buildDrivers(f: SiFacts): Driver[] {
  const d: Driver[] = [];
  // BUSINESS
  if (has(f.revGrowthYoY)) d.push(["BUS", "Revenue growth", `${pct1(f.revGrowthYoY)} y/y (latest quarter)`, clamp(50 + f.revGrowthYoY * 1.5), "CK", 2]);
  if (has(f.grossMargin)) d.push(["BUS", "Gross margin", `${f.grossMargin.toFixed(1)}%`, clamp(30 + f.grossMargin * 0.8), "C", 1]);
  if (has(f.opMargin) && has(f.opMarginYearAgo)) {
    const delta = f.opMargin - f.opMarginYearAgo;
    d.push(["BUS", "Operating margin trend", `${f.opMargin.toFixed(1)}% (${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} pts y/y)`, clamp(50 + delta * 3), "", 1]);
  }
  // EARNINGS
  if (has(f.epsBeats) && has(f.epsReports) && f.epsReports > 0) {
    d.push(["EARN", "Beat record", `${f.epsBeats} of last ${f.epsReports} reports beat EPS consensus`, clamp(30 + (f.epsBeats / f.epsReports) * 60), "C", 1]);
  }
  if (has(f.fwdEps) && has(f.nextFyEps) && f.fwdEps > 0) {
    const g = (f.nextFyEps / f.fwdEps - 1) * 100;
    d.push(["EARN", "Forward EPS growth", `${pct1(g)} next FY vs this FY (consensus)`, clamp(50 + g * 1.2), "CK", 3]);
  }
  if (has(f.upgrades90) && has(f.downgrades90) && f.upgrades90 + f.downgrades90 > 0) {
    const net = f.upgrades90 - f.downgrades90;
    d.push(["EARN", "Analyst rating changes", `${f.upgrades90} upgrades / ${f.downgrades90} downgrades (90 days)`, clamp(50 + net * 10), "", 1]);
  }
  // TECHNICALS
  if (has(f.price) && has(f.sma50) && has(f.sma200)) {
    const a50 = f.price > f.sma50, a200 = f.price > f.sma200;
    const score = a50 && a200 ? 80 : a200 ? 60 : a50 ? 45 : 25;
    d.push(["TECH", "Trend vs 50/200 DMA", `${a50 ? "above" : "below"} 50 DMA ${usd(f.sma50)} · ${a200 ? "above" : "below"} 200 DMA ${usd(f.sma200)}`, score, "C", 1]);
  }
  if (has(f.rsRating)) d.push(["TECH", "Relative strength", `RS rating ${f.rsRating}/99`, clamp(f.rsRating), "C", 2]);
  if (has(f.rvol) && has(f.changePct)) {
    const dir = f.changePct >= 0 ? 1 : -1;
    d.push(["TECH", "Volume confirmation", `${f.rvol.toFixed(1)}× 20-day average volume`, clamp(50 + (f.rvol - 1) * 30 * dir), "", 3]);
  }
  if (has(f.rsi14)) {
    const r = f.rsi14;
    const score = r >= 75 ? 40 : r <= 30 ? 35 : clamp(40 + (r - 30) * 0.9);
    d.push(["TECH", "RSI(14)", r.toFixed(0), score, "", 1]);
  }
  // CATALYSTS
  if (has(f.daysToEarnings)) {
    d.push(["CAT", "Next earnings", f.daysToEarnings === 0 ? "today" : `in ${f.daysToEarnings} days`, f.daysToEarnings <= 30 ? 65 : 50, "", 0]);
  }
  const wPos = f.newsWPos ?? f.newsPos;
  const wNeg = f.newsWNeg ?? f.newsNeg;
  if (has(f.newsPos) && has(f.newsNeg) && has(wPos) && has(wNeg) && wPos + wNeg > 0) {
    // Share of the weighted lean, shrunk toward neutral so a handful of headlines can't swing it to the ends.
    const net = (wPos - wNeg) / (wPos + wNeg + 4);
    d.push(["CAT", "News sentiment", newsSentimentText(f), clamp(50 + net * 50), "", 1]);
  }
  // VALUATION
  const fpe = forwardPe(f);
  if (has(fpe)) d.push(["VAL", "Forward P/E", `${fpe}× next-FY consensus EPS`, clamp(100 - fpe * 1.5, 15, 90), "", 0]);
  if (has(f.targetMean) && has(f.price) && f.price > 0) {
    const up = (f.targetMean / f.price - 1) * 100;
    d.push(["VAL", "Analyst target upside", `${pct1(up)} to consensus ${usd(f.targetMean)}`, clamp(50 + up * 1.5), "C", 1]);
  }
  // POSITIONING
  if (has(f.instHoldersChange)) {
    d.push(["POS", "13F holder count", `${f.instHoldersChange >= 0 ? "+" : "−"}${Math.abs(f.instHoldersChange).toLocaleString()} filers QoQ`, clamp(50 + f.instHoldersChange / 10, 20, 80), "", 1]);
  }
  if (has(f.insiderNet90) && f.insiderNet90 !== 0) {
    d.push(["POS", "Insider open-market trades", `net ${compactUsd(f.insiderNet90)} (90 days)`, f.insiderNet90 > 0 ? 75 : 42, "", 1]);
  }
  // MACRO / REGIME
  if (has(f.sectorRank) && has(f.sectorRankTotal) && f.sectorRankTotal > 0) {
    d.push(["MAC", "Sector rank", `#${f.sectorRank} of ${f.sectorRankTotal} sectors today`, clamp(100 - (f.sectorRank / f.sectorRankTotal) * 100 + 5), "", 1]);
  }
  if (has(f.realizedVol30)) {
    d.push(["MAC", "Volatility regime", `30-day realized volatility ${f.realizedVol30.toFixed(0)}%`, clamp(80 - (f.realizedVol30 - 20) * 1.2, 20, 80), "", 0]);
  }
  return d;
}

/** Setup label from real technicals; "Insufficient data" when there are none. */
export function setupLabel(f: SiFacts): string {
  if (has(f.pctFromHigh52) && f.pctFromHigh52 >= -3 && has(f.rsRating) && f.rsRating >= 80) return "Breakout / New Highs";
  if (has(f.rsi14) && f.rsi14 >= 70) return "Extended Momentum";
  if (has(f.rsi14) && f.rsi14 <= 30) return "Oversold";
  if (has(f.price) && has(f.sma50) && has(f.sma200)) {
    if (f.price > f.sma50 && f.sma50 > f.sma200) return "Uptrend";
    if (f.price < f.sma50 && f.sma50 < f.sma200) return "Downtrend";
    return "Range-bound";
  }
  return "Insufficient data";
}

/** Up to four headline signals, each a real number. */
export function signalList(f: SiFacts): string[] {
  const out: string[] = [];
  if (has(f.rsRating)) out.push(`RS rating ${f.rsRating}/99`);
  if (has(f.rvol)) out.push(`Volume ${f.rvol.toFixed(1)}× 20-day avg`);
  if (f.consensus) out.push(`Analysts: ${f.consensus}${has(f.targetMean) ? ` · target ${usd(f.targetMean)}` : ""}`);
  if (has(f.revGrowthYoY)) out.push(`Revenue ${pct1(f.revGrowthYoY)} y/y`);
  if (has(f.daysToEarnings) && f.daysToEarnings <= 30) out.push(`Earnings in ${f.daysToEarnings} days`);
  if (has(f.instHoldersChange)) out.push(`13F filers ${f.instHoldersChange >= 0 ? "+" : ""}${f.instHoldersChange} QoQ`);
  return out.slice(0, 4);
}

/**
 * Thesis parameters for a ticker: drivers plus the inputs targets are built
 * from. Replaces the old hand-written table (stale prices/targets for 12
 * names) and the price-×-constant fallback for everything else.
 */
export function getTP(t: string, facts: SiFacts = EMPTY_FACTS) {
  const f = facts;
  const fpe = forwardPe(f);
  const d = buildDrivers(f);
  // Weakest measured driver is the biggest risk the data points to.
  const weakest = d.length ? d.reduce((a, b) => (b[3] < a[3] ? b : a)) : null;
  return {
    sym: t.toUpperCase().trim(),
    d,
    cat: has(f.daysToEarnings)
      ? `Earnings report ${f.daysToEarnings === 0 ? "today" : `in ${f.daysToEarnings} days`}`
      : "No dated catalyst on the earnings calendar",
    risk: weakest && weakest[3] < 50 ? `${weakest[1]}: ${weakest[2]}` : "No weak driver flagged by the current data",
    nextFyEps: f.nextFyEps,
    fpe,
    cons: f.targetMean,
    analysts: [f.buyCount, f.holdCount, f.sellCount].every(has) ? (f.buyCount as number) + (f.holdCount as number) + (f.sellCount as number) : null,
    res: f.pivotR1,
    sup: f.pivotS1 ?? f.sma50,
    sup2: f.pivotS2 ?? f.sma200,
    // Invalidation rules — conditions to watch, stated against real levels.
    fi: [
      has(f.sma50) ? `Daily close below the 50 DMA (${usd(f.sma50)})` : "Daily close below the 50 DMA",
      "Next-FY consensus EPS cut by more than 10%",
      has(f.revGrowthYoY) ? `Revenue growth slips below 0% y/y (now ${pct1(f.revGrowthYoY)})` : "Revenue growth turns negative y/y",
    ],
    fiB: [
      has(f.sma50) ? `Daily close back above the 50 DMA (${usd(f.sma50)})` : "Daily close back above the 50 DMA",
      "Next-FY consensus EPS raised by more than 10%",
    ],
  };
}

export function getStock(
  t: string,
  live?: {
    price?: number;
    change?: number;
    name?: string;
    sector?: string;
    mcap?: number;
    pe?: number | null;
    fpe?: number | null;
    hi?: number | null;
    lo?: number | null;
    rev?: number | null;
    eps?: number | null;
    sma50?: number | null;
  },
  skipThesis = false,
  facts: SiFacts = EMPTY_FACTS,
): StockItem {
  const sym = t.toUpperCase().trim();
  const mcapNum = live?.mcap != null && live.mcap > 0 ? live.mcap : null;
  const item: StockItem = {
    t: sym,
    name: live?.name || POPULAR[sym] || sym,
    p: live?.price ?? 0,
    c: live?.change ?? 0,
    setup: setupLabel(facts),
    cf: 0,
    conf: 0,
    sig: signalList(facts),
    mcap: mcapNum == null ? "—" : mcapNum >= 1e12 ? `$${(mcapNum / 1e12).toFixed(2)}T` : `$${(mcapNum / 1e9).toFixed(1)}B`,
    pe: live?.pe ?? null,
    fpe: live?.fpe ?? forwardPe(facts),
    rev: live?.rev ?? facts.revGrowthYoY,
    eps: live?.eps ?? null,
    hi: live?.hi ?? null,
    lo: live?.lo ?? null,
    sector: live?.sector || facts.sector || "—",
    lbg: LG_COL[sym]?.[0] || "#1e3a8a",
    lfg: LG_COL[sym]?.[1] || "#ffffff",
  };
  if (!skipThesis) {
    const tr = thesisRun(sym, "Bull", "6M", undefined, undefined, facts);
    item.conf = tr.conf != null ? Math.round(tr.conf) : 0;
    item.cf = tr.cats.filter((c: any) => c.ds.length > 0 && Math.round(c.score) >= 60).length;
  }
  return item;
}

export function thesisWeights(dir: "Bull" | "Bear", hz: string) {
  let w: Record<string, number> =
    hz === "1M"
      ? { BUS: 10, EARN: 15, TECH: 30, CAT: 20, VAL: 5, POS: 10, MAC: 10 }
      : hz === "12M"
        ? { BUS: 30, EARN: 20, TECH: 10, CAT: 5, VAL: 20, POS: 5, MAC: 10 }
        : { BUS: 25, EARN: 20, TECH: 20, CAT: 10, VAL: 10, POS: 5, MAC: 10 };
  w = { ...w };
  if (dir === "Bear") {
    w.VAL += 5;
    w.MAC += 5;
    w.BUS -= 5;
    w.TECH -= 5;
  }
  return w;
}

export function normW(o: Record<string, number>) {
  const s = Object.values(o).reduce((a, b) => a + b, 0) || 1;
  const w: Record<string, number> = {};
  Object.keys(o).forEach((k) => {
    w[k] = (o[k] / s) * 100;
  });
  return w;
}

export const CAT_KINDS = [
  "All",
  "Earnings",
  "Analyst actions",
  "Product launches",
  "Industry events",
  "Regulatory",
  "Political",
  "Macro",
  "News",
  "Insider activity",
  "13F filings",
];

export function thesisRun(t: string, dir: "Bull" | "Bear", hz: string, adj?: any, wO?: any, facts: SiFacts = EMPTY_FACTS) {
  const P = getTP(t, facts);
  const W = wO ? normW(wO) : thesisWeights(dir, hz);
  const bull = dir === "Bull";
  const drv = P.d.map(([cat, name, val, scVal, fl, dd]: any) => {
    const s2 = Math.max(0, Math.min(100, scVal + (adj ? adj(cat, name, fl, dd) : 0)));
    return {
      cat,
      name,
      val,
      sc: s2,
      ev: bull ? s2 : 100 - s2,
      core: fl.indexOf("C") >= 0,
      crit: fl.indexOf("K") >= 0,
      grp: fl.split("@")[1] || null,
      dd: bull ? dd : -dd,
    };
  });
  const catData = CATS_T.map(([k, label]) => {
    const ds = drv.filter((d: any) => d.cat === k);
    const slots: Record<string, any[]> = {};
    ds.forEach((d: any) => {
      const key = d.grp || d.name;
      (slots[key] = slots[key] || []).push(d);
    });
    let sw = 0,
      sv = 0;
    const sl = Object.values(slots).map((a) => {
      const w = a.some((d: any) => d.core) ? 2 : 1;
      const v = a.reduce((s: number, d: any) => s + d.ev, 0) / a.length;
      sw += w;
      sv += w * v;
      return { a, w };
    });
    const hasData = sw > 0;
    const score = hasData ? sv / sw : 0;
    return { k, label, ds, slots, sl, sw, sv, hasData, score, baseW: W[k] || 0 };
  });

  const totalValidWeight = catData
    .filter((c) => c.hasData)
    .reduce((sum, c) => sum + c.baseW, 0);

  let conf: number | null = 0;
  const cats = catData.map((c) => {
    const effW = totalValidWeight > 0 && c.hasData ? (c.baseW / totalValidWeight) * 100 : 0;
    const pts = (c.score * effW) / 100;
    if (conf != null) conf += pts;
    c.sl.forEach(({ a, w }) =>
      a.forEach((d: any) => {
        d.share = c.sw ? (effW * (w / c.sw)) / a.length : 0;
        d.pts = (d.share * d.ev) / 100;
        d.shared = a.length > 1;
      })
    );
    return { k: c.k, label: c.label, w: effW, score: c.score, pts, ds: c.ds };
  });

  if (totalValidWeight === 0) {
    conf = null;
  }
  const core = drv.filter((d: any) => d.core);
  const crit = drv.filter((d: any) => d.crit);
  return {
    drv,
    cats,
    conf,
    bull,
    W,
    core,
    coreOk: core.filter((d: any) => d.ev >= 55).length,
    critFail: crit.filter((d: any) => d.ev < 40),
    crit,
  };
}

const HZF: Record<string, number> = { "1M": 0.3, "3M": 0.55, "6M": 0.8, "12M": 1 };

/**
 * Price target and stop for a thesis. The 12-month base blends only the inputs
 * that exist — next-FY consensus EPS × today's forward P/E, the analyst
 * consensus target, and a pivot measured move — and scales toward the horizon.
 * With none of them the target is today's price (no view), never a constant.
 */
export function thesisTargets(t: string, dir: "Bull" | "Bear", hz: string, run: any, p: number, facts: SiFacts = EMPTY_FACTS) {
  const P = getTP(t, facts);
  const f = HZF[hz] || 0.8;
  const bull = dir === "Bull";
  const earn = run.cats.find((c: any) => c.k === "EARN");
  const revAdj = earn && earn.ds.length ? Math.max(-0.08, Math.min(0.08, (earn.score - 50) / 600)) * (bull ? 1 : -1) : 0;
  const parts: Array<{ w: number; v: number; src: [string, string, number] }> = [];
  if (has(P.nextFyEps) && P.nextFyEps > 0 && has(P.fpe)) {
    const v = P.nextFyEps * P.fpe;
    parts.push({ w: 0.45, v, src: ["Next-FY EPS × forward P/E", `${P.nextFyEps.toFixed(2)} × ${P.fpe}×`, v] });
  }
  if (has(P.cons)) {
    parts.push({ w: 0.35, v: P.cons, src: ["Analyst consensus PT", P.analysts ? `mean of ${P.analysts} analysts` : "FMP consensus", P.cons] });
  }
  if (has(P.res) && has(P.sup) && P.res > P.sup) {
    const v = P.res + (P.res - P.sup);
    parts.push({ w: 0.2, v, src: ["Technical measured move", `${usd(P.res)} resistance + range`, v] });
  }
  const wSum = parts.reduce((a, x) => a + x.w, 0);
  const base12 = wSum > 0 ? (parts.reduce((a, x) => a + x.w * x.v, 0) / wSum) * (1 + revAdj) : p;
  // Bull/bear 12-month cases: next-FY EPS at ±20% of today's forward multiple.
  const bull12 = has(P.nextFyEps) && has(P.fpe) ? P.nextFyEps * P.fpe * 1.2 : base12;
  const bear12 = has(P.nextFyEps) && has(P.fpe) ? P.nextFyEps * P.fpe * 0.8 : base12;
  const at = (v: number) => p + (v - p) * f;
  const base = at(base12);
  const up = at(bull12);
  const dn = at(bear12);
  // A long thesis needs its target above the price (XOM: $172 target under a
  // $177 price on a "bullish" thesis) — mirrors the bear case's floor below it.
  const target = bull ? Math.max((up + base) / 2, p * 1.06) : Math.min((dn + base) / 2, p * 0.94);
  const lvl = (hz === "12M" ? P.sup2 : P.sup) ?? p * 0.95;
  const stop = bull ? Math.min(lvl * 0.985, p * 0.95) : Math.max((P.res ?? p * 1.05) * 1.015, p * 1.05);
  return { target, stop, base, up, dn, src: parts.map((x) => x.src), revAdj, lvl, f };
}

/**
 * Quarterly fundamentals series for the Fundamentals tab. Only real FMP
 * quarters are charted (built in the screen); with none, there is nothing to
 * draw — this used to return seeded random numbers.
 */
export function fundSeries(_t: string): number[][] {
  return [];
}

/**
 * "What would break this setup", split by whether it has already happened.
 *
 * A level the price is already through is not a risk still to come, so it goes
 * in `broken` (where price stands against the level, and what would repair it);
 * a level still ahead stays in `pending` as the "daily close below X" trigger.
 * The card used to list "Price loses the 50 DMA" for a stock trading $40 under
 * it. With no price we cannot tell which side it is on, so every level stays
 * pending.
 */
export function invalidationLevels(f: SiFacts): { pending: [string, string][]; broken: [string, string][] } {
  const pending: [string, string][] = [];
  const broken: [string, string][] = [];
  const levels: Array<{ at: number | null | undefined; label: string; ahead: [string, string]; through: string; repair: string }> = [
    { at: f.sma50, label: "50 DMA", ahead: ["Price loses the 50 DMA", "Daily close below"], through: "Already below the 50 DMA", repair: "repairs the trend" },
    { at: f.pivotS1, label: "S1", ahead: ["Breaks first support", "Daily close below S1"], through: "First support already broken", repair: "restores support" },
    { at: f.sma200, label: "200 DMA", ahead: ["Price loses the 200 DMA", "Daily close below"], through: "Already below the 200 DMA", repair: "repairs the long-term trend" },
  ];
  for (const l of levels) {
    if (!has(l.at)) continue;
    if (has(f.price) && f.price < l.at) {
      broken.push([l.through, `Price ${usd(f.price)} is below ${l.label} ${usd(l.at)}. A daily close back above it ${l.repair}.`]);
    } else {
      pending.push([l.ahead[0], `${l.ahead[1]} ${usd(l.at)}`]);
    }
  }
  return { pending, broken };
}

export function detail(t: string, live?: any): DetailStock {
  const sym = t.toUpperCase().trim();
  const facts: SiFacts = live?.facts ?? EMPTY_FACTS;
  const s = getStock(sym, live, false, facts);
  const up = s.c >= 0;

  const tr = thesisRun(sym, "Bull", "6M", undefined, undefined, facts);
  const cats = tr.cats;
  const sv = cats.map((c: any) => Math.round(c.score));
  const catNames = cats.map((c: any) => SHORT[c.k] || c.label);
  const scored = cats.map((c: any, i: number) => ({ i, n: c.ds.length })).filter((x: any) => x.n > 0).map((x: any) => x.i);
  const maxIdx = scored.length ? scored.reduce((a: number, b: number) => (sv[b] > sv[a] ? b : a)) : -1;
  const minIdx = scored.length ? scored.reduce((a: number, b: number) => (sv[b] < sv[a] ? b : a)) : -1;
  const fpe = forwardPe(facts);

  // Each clause is a list of segments so the rating, the target upside and the
  // revenue growth can be tinted green/red by their data (see AssessSeg).
  const signTone = (v: number): AssessSeg["tone"] => (v > 0 ? "up" : v < 0 ? "dn" : undefined);
  const ratingTone = (r: string): AssessSeg["tone"] =>
    /buy|outperform|overweight/i.test(r) ? "up" : /sell|underperform|underweight/i.test(r) ? "dn" : undefined;
  const targetMean = has(facts.targetMean) && has(facts.price) ? facts.targetMean : null;
  const targetUp = targetMean != null && has(facts.price) ? (targetMean / facts.price - 1) * 100 : null;
  const assessClauses: AssessSeg[][] = [
    [{ t: `${sym} reads as ${s.setup.toLowerCase()} with a thesis score of ${s.conf}/100 from ${tr.drv.length} measured drivers` }],
    facts.consensus
      ? [
          { t: "analysts rate it " },
          { t: facts.consensus, tone: ratingTone(facts.consensus) },
          ...(targetMean != null && targetUp != null
            ? [{ t: ` with a ${usd(targetMean)} consensus target (` }, { t: pct1(targetUp), tone: signTone(targetUp) }, { t: ")" }]
            : []),
        ]
      : [],
    has(facts.revGrowthYoY)
      ? [{ t: "revenue grew " }, { t: pct1(facts.revGrowthYoY), tone: signTone(facts.revGrowthYoY) }, { t: " y/y last quarter" }]
      : [],
  ].filter((c) => c.length > 0);
  const assessSegs: AssessSeg[] = assessClauses.flatMap((c, i) => (i ? [{ t: "; " }, ...c] : c)).concat({ t: "." });
  const assess = tr.drv.length
    ? assessSegs.map((x) => x.t).join("")
    : `Not enough live data has loaded for ${sym} to assess a setup yet.`;

  const assessEv = [
    `${s.cf} of 7 signal categories scored 60+ (business, earnings, technical, catalysts, valuation, flows, macro)`,
    maxIdx >= 0 ? `Strongest input: ${catNames[maxIdx]} (${sv[maxIdx]}/100)` : "No category has data yet",
    minIdx >= 0 ? `Weakest input: ${catNames[minIdx]} (${sv[minIdx]}/100) · forward P/E ${fpe != null ? fpe + "×" : "N/A"}` : `Forward P/E ${fpe != null ? fpe + "×" : "N/A"}`,
  ];

  // Attribution split is a model of how much of today's move is sector beta vs
  // stock-specific — labelled as such in movedEv.
  const betaVal = Math.abs(live?.beta ?? facts.beta ?? 1);
  const secWeight = Math.round(Math.min(55, Math.max(20, betaVal * 28)));
  const newsWeight = Math.round(Math.max(20, Math.min(45, 65 - secWeight)));
  const mktWeight = Math.round(Math.max(12, 100 - secWeight - newsWeight - 12));
  const techWeight = Math.max(5, 100 - secWeight - newsWeight - mktWeight);
  const att = [secWeight, newsWeight, mktWeight, techWeight, 0, 0];

  const movedTxt = `Today's ${pct(s.c)} move${s.sector !== "—" ? ` alongside the ${s.sector} sector` : ""}.`;

  const rvolStr = has(facts.rvol)
    ? `Volume tracking at ${facts.rvol.toFixed(1)}× the 20-day average`
    : "Relative volume not available yet";
  const instFlowStr = has(facts.instSharesChange)
    ? `Latest 13F quarter: institutions ${facts.instSharesChange >= 0 ? "added" : "cut"} ${(Math.abs(facts.instSharesChange) / 1e6).toFixed(1)}M shares`
    : "13F share change not available";
  const optionsStr = has(facts.instPutCallRatio)
    ? `13F put/call ratio ${facts.instPutCallRatio.toFixed(2)} (quarterly holdings)`
    : "Options flow not available on the current data plan";
  const movedEv = [
    `Modeled attribution (not a measured cause): ~${secWeight}% sector beta, ~${newsWeight}% stock news, ~${mktWeight}% broad market`,
    rvolStr,
    instFlowStr,
    optionsStr,
  ];

  const fwd = {
    cats: cats.map((c: any) => ({
      k: c.k,
      label: SHORT[c.k] || c.label,
      score: Math.round(c.score),
      cells: (c.ds || []).slice(0, 3).map((d: any) => [d.name, Math.round(d.sc), sc(Math.round(d.sc))]) as [string, number, string][],
    })),
  };

  const { pending: invalid, broken } = invalidationLevels(facts);
  invalid.push(["Forward EPS cuts", "Next-FY consensus EPS revised down more than 10%"]);

  const fundBits = [
    has(facts.revGrowthYoY) ? `revenue ${pct1(facts.revGrowthYoY)} y/y` : null,
    has(facts.grossMargin) ? `gross margin ${facts.grossMargin.toFixed(1)}%` : null,
    has(facts.opMargin) ? `operating margin ${facts.opMargin.toFixed(1)}%` : null,
  ].filter(Boolean);
  const fundTxt = fundBits.length
    ? `${sym} latest quarter: ${fundBits.join(", ")}.`
    : `Quarterly fundamentals for ${sym} are not available yet.`;
  const fundEv = [
    fpe != null ? `Forward P/E ${fpe}× on next-FY consensus EPS${has(facts.trailingPe) ? ` (trailing ${facts.trailingPe.toFixed(1)}×)` : ""}` : null,
    has(facts.fwdEps) && has(facts.nextFyEps) && facts.fwdEps > 0 ? `Consensus EPS: $${facts.fwdEps.toFixed(2)} this FY → $${facts.nextFyEps.toFixed(2)} next FY (${pct1((facts.nextFyEps / facts.fwdEps - 1) * 100)})` : null,
    has(facts.epsBeats) && has(facts.epsReports) ? `Beat EPS consensus in ${facts.epsBeats} of the last ${facts.epsReports} reports` : null,
  ].filter((x): x is string => !!x);

  const read: DetailStock["read"] = [];
  if (has(facts.price) && has(facts.sma50) && has(facts.sma200)) {
    const bull = facts.price > facts.sma50 && facts.price > facts.sma200;
    const bear = facts.price < facts.sma50 && facts.price < facts.sma200;
    read.push({ k: "TREND", v: bull ? "Bullish" : bear ? "Bearish" : "Mixed", col: bull ? UP : bear ? DN : STEEL });
  }
  if (has(facts.rsi14)) {
    read.push({ k: "MOMENTUM", v: facts.rsi14 >= 70 ? "Overbought" : facts.rsi14 <= 30 ? "Oversold" : facts.rsi14 >= 55 ? "Strong" : facts.rsi14 <= 45 ? "Weak" : "Neutral", col: facts.rsi14 >= 55 && facts.rsi14 < 70 ? UP : facts.rsi14 <= 45 ? DN : "#f5b031" });
  }
  if (has(facts.pctFromHigh52)) {
    const near = facts.pctFromHigh52 >= -3;
    read.push({ k: "52W HIGH", v: near ? "At / near high" : `${pct1(facts.pctFromHigh52)} below`, col: near ? UP : STEEL });
  }
  if (has(facts.realizedVol30)) {
    read.push({ k: "RISK", v: facts.realizedVol30 >= 50 ? "High" : facts.realizedVol30 >= 30 ? "Elevated" : "Moderate", col: facts.realizedVol30 >= 50 ? DN : facts.realizedVol30 >= 30 ? "#f5b031" : UP });
  }

  // Key levels: verified pivots / moving averages only.
  const levels: DetailStock["levels"] = [];
  if (has(facts.pivotR2)) levels.push({ k: "Resistance 2 (R2)", v: usd(facts.pivotR2), col: DN });
  if (has(facts.pivotR1)) levels.push({ k: "Resistance 1 (R1)", v: usd(facts.pivotR1), col: DN });
  if (has(facts.price)) levels.push({ k: "Last Price", v: usd(facts.price), col: "#e8eef4" });
  if (has(facts.pivotS1)) levels.push({ k: "Support 1 (S1)", v: usd(facts.pivotS1), col: UP });
  if (has(facts.pivotS2)) levels.push({ k: "Support 2 (S2)", v: usd(facts.pivotS2), col: UP });
  if (has(facts.sma9)) levels.push({ k: "9 DMA", v: usd(facts.sma9), col: STEEL });
  if (has(facts.sma21)) levels.push({ k: "21 DMA", v: usd(facts.sma21), col: STEEL });
  if (has(facts.sma50)) levels.push({ k: "50 DMA", v: usd(facts.sma50), col: STEEL });
  if (has(facts.sma200)) levels.push({ k: "200 DMA", v: usd(facts.sma200), col: STEEL });

  // Evidence per signal key — each line a real number; categories also list
  // their scored drivers.
  const ev: Record<string, string[]> = {};
  const put = (k: string, lines: Array<string | null>) => {
    const real = lines.filter((x): x is string => !!x);
    if (real.length) ev[k] = real;
  };
  put("Momentum", [
    has(facts.rsi14) ? `RSI(14) ${facts.rsi14.toFixed(0)}` : null,
    has(facts.price) && has(facts.sma9) ? `Price ${facts.price > facts.sma9 ? "above" : "below"} the 9 DMA (${usd(facts.sma9)})` : null,
    has(facts.price) && has(facts.sma21) ? `Price ${facts.price > facts.sma21 ? "above" : "below"} the 21 DMA (${usd(facts.sma21)})` : null,
    has(facts.price) && has(facts.sma50) ? `Price ${facts.price > facts.sma50 ? "above" : "below"} the 50 DMA (${usd(facts.sma50)})` : null,
    has(facts.price) && has(facts.sma200) ? `Price ${facts.price > facts.sma200 ? "above" : "below"} the 200 DMA (${usd(facts.sma200)})` : null,
    has(facts.pctFromHigh52) ? `${pct1(facts.pctFromHigh52)} from the 52-week high` : null,
  ]);
  put("Volume", [has(facts.rvol) ? `Today's volume ${facts.rvol.toFixed(1)}× the 20-day average` : null]);
  put("Relative Strength", [has(facts.rsRating) ? `RS rating ${facts.rsRating}/99 vs the market` : null]);
  put("Sector", [
    has(facts.sectorRank) && has(facts.sectorRankTotal) ? `${s.sector} ranks #${facts.sectorRank} of ${facts.sectorRankTotal} sectors today` : null,
  ]);
  put("News", [has(facts.newsPos) && has(facts.newsNeg) ? newsSentimentText(facts) : null]);
  put("Options", [
    "Contract-level options data is not available on the current plan",
    has(facts.instPutCallRatio) ? `13F put/call ratio ${facts.instPutCallRatio.toFixed(2)} (quarterly holdings)` : null,
  ]);
  put("Market Regime", [
    has(facts.beta) ? `Beta ${facts.beta.toFixed(2)} vs the S&P 500` : null,
    has(facts.realizedVol30) ? `30-day realized volatility ${facts.realizedVol30.toFixed(0)}%` : null,
  ]);
  cats.forEach((c: any) => {
    const key = SHORT[c.k] || c.label;
    if (c.ds && c.ds.length > 0) {
      ev[key] = c.ds.map((d: any) => `${d.name}: ${d.val} (${Math.round(d.sc)}/100)`);
      ev[key.toUpperCase()] = ev[key];
      ev[c.label] = ev[key];
    }
  });

  return {
    sv,
    ev,
    events: [],
    sixMonthEvents: [],
    assess,
    assessSegs: tr.drv.length ? assessSegs : undefined,
    assessEv,
    att,
    movedTxt,
    movedEv,
    upcoming: [],
    invalid,
    broken,
    fundTxt,
    fundEv,
    read,
    levels,
    drivers: [],
    whyEv: movedEv,
    whyChg: [],
    signals: [],
    fwdScn: [],
  };
}

const DAY_MS = 86_400_000;

/** Headline kinds worth surfacing next to a big move, most important first. */
const NOTABLE_KINDS: Array<{ kind: string; re: RegExp }> = [
  {
    kind: "Leadership",
    re: /\b(ceo|cfo|coo|cto|chief (executive|financial|operating|technology)|chair(man|woman)?|founder)\b.{0,80}\b(steps? down|stepping down|resign\w*|retir\w*|ousted|fired|departure|departs|exits?|successor|succession|appoint\w*|hires?|hired)\b|\b(steps? down|stepping down|resign\w*|ousted|fired|appoint\w*|succession|new (ceo|cfo))\b.{0,80}\b(ceo|cfo|chief|chair(man|woman)?|founder)\b/i,
  },
  { kind: "M&A", re: /\b(acqui\w+|merger|merges?|merged|buyout|takeover|take-private|spin-?off|divest\w*)\b/i },
  { kind: "Legal / Regulatory", re: /\b(lawsuit|sues?|sued|probe|investigation|antitrust|subpoena|settle\w*|fined?|recall|fda|doj|ftc)\b/i },
  {
    // Company guidance, not any mention of an "outlook": a price-target piece
    // ("…Change Nvidia Stock's Outlook for 2027") and AMD's earnings story
    // ("…Strong 2027 Outlook") both said "outlook" and were labelled Guidance on NVDA.
    kind: "Guidance",
    re: /\b(raises?|raised|cuts?|lowers?|lowered|lifts?|boosts?|slash\w*|trims?|issues?|gives?|reaffirms?|reiterates?|withdraws?|updates?|offers?|warns?)\b[^.:]{0,40}\b(guidance|outlook|forecast)\b|\b(guidance|outlook|forecast)\b[^.:]{0,20}\b(raised|cut|lowered|lifted|boosted|slashed|trimmed|disappoint\w*|misses|beats?|above|below|weak|soft|light)\b/i,
  },
  { kind: "Capital", re: /\b(buyback|repurchase|dividend|stock split|share offering|secondary offering|debt offering)\b/i },
  { kind: "Product", re: /\b(launch\w*|unveil\w*|debut\w*)\b/i },
];

const articleMs = (x: any): number => {
  const pub = x?.publishedAt || x?.date;
  return !pub ? NaN : typeof pub === "number" ? pub : new Date(pub).getTime();
};

const toneOf = (x: any): "up" | "dn" | undefined =>
  x?.sentiment === "positive" ? "up" : x?.sentiment === "negative" ? "dn" : undefined;

/**
 * An article's summary when it says something. Some vendor summaries are only
 * a quote stamp ("NASDAQ · As of 4:00 PM ET 11/05/26"), which as a card's
 * description tells the reader nothing.
 */
export function usableSummary(s: unknown): string | null {
  const t = String(s ?? "").trim();
  if (t.length < 40) return null;
  if (/^(nasdaq|nyse|amex|otc)\b[^.]{0,40}\bas of\b/i.test(t)) return null;
  return t;
}

/** First full sentence of a summary, so the line gives the point without being cut mid-word. */
const firstSentence = (s: unknown): string => {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const m = t.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : t).trim();
};

/**
 * Notable headlines around a move — a CEO leaving, a deal, a probe, guidance,
 * a buyback or a launch — from two days before the move through its session.
 * Up to three, most important kind first; `skipTitle` is the headline already
 * shown as the event's own label.
 */
function notableContext(news: any[] | null | undefined, moveDay: number, skipTitle?: string): EventContext[] {
  const from = moveDay - 2 * DAY_MS;
  const to = moveDay + DAY_MS + 4 * 3_600_000;
  const seen = new Set<string>(skipTitle ? [skipTitle] : []);
  const hits: Array<{ rank: number; item: EventContext }> = [];
  for (const x of news ?? []) {
    const ms = articleMs(x);
    if (!Number.isFinite(ms) || ms < from || ms >= to) continue;
    const headline = String(x.headline ?? x.title ?? "").trim();
    if (!headline || seen.has(headline)) continue;
    // Stake filings and evergreen pieces are not events around the move.
    if (isHoldingsNote(headline) || isSolicitation(headline) || FILLER_RE.test(headline)) continue;
    // Classify on the headline alone: a summary mentioning "acquire" or "settle"
    // in passing (a Marvell deal under a Nvidia headline, "may settle" in a
    // Cramer piece) labelled unrelated stories M&A and Legal.
    const rank = NOTABLE_KINDS.findIndex((k) => k.re.test(headline));
    if (rank < 0) continue;
    seen.add(headline);
    const lead = firstSentence(x.summary);
    hits.push({ rank, item: { kind: NOTABLE_KINDS[rank].kind, text: lead && lead !== headline ? `${headline} — ${lead}` : headline, tone: toneOf(x) } });
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, 3).map((h) => h.item);
}

/** A headline that looks ahead to a report ("what to expect", "ahead of earnings") rather than reacting to it. */
const PREVIEW_RE = /\b(preview|what to expect|ahead of|before (the )?(earnings|report)|expected to report|will report|set to report|whatever happens)\b/i;

/**
 * What the press said about a report: the best earnings-related article from the
 * report day through three days after the move. Reactions beat previews, then
 * articles with a summary, then the closest to the middle of the move's session
 * (an after-close report is reacted to the next day, so the report day is too early).
 */
function earningsCommentary(news: any[] | null | undefined, reportDay: number, moveDay: number): string | undefined {
  const to = Math.max(reportDay, moveDay) + 4 * DAY_MS;
  const anchor = Math.max(reportDay, moveDay) + DAY_MS / 2;
  const title = (x: any) => `${x.headline ?? x.title ?? ""}`;
  const cands = (news ?? [])
    .map((x) => ({ x, ms: articleMs(x) }))
    .filter(({ x, ms }) => Number.isFinite(ms) && ms >= reportDay && ms < to && (x.tag === "earnings" || /earnings|quarter|results|revenue|guidance|outlook/i.test(title(x))))
    .sort(
      (a, b) =>
        Number(PREVIEW_RE.test(title(a.x))) - Number(PREVIEW_RE.test(title(b.x))) ||
        Number(!!b.x.summary) - Number(!!a.x.summary) ||
        Math.abs(a.ms - anchor) - Math.abs(b.ms - anchor),
    );
  const x = cands[0]?.x;
  if (!x) return undefined;
  const headline = String(x.headline ?? x.title ?? "").trim();
  const summary = String(x.summary ?? x.text ?? "").trim();
  return summary ? `${headline} — ${summary}` : headline || undefined;
}

/** Year-over-year % change on a positive base; null when there is no meaningful base. */
const yoyPct = (cur: number | null | undefined, prev: number | null | undefined): number | null => {
  if (cur == null || prev == null || !(prev > 0)) return null;
  const p = (cur / prev - 1) * 100;
  return Math.abs(p) > 1000 ? null : p;
};

const signedPct = (v: number, digits = 1): string => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;
const toneOfNum = (v: number): "up" | "dn" | undefined => (v > 0 ? "up" : v < 0 ? "dn" : undefined);

/**
 * The figures behind an earnings move: EPS surprise and growth, revenue and
 * sales growth and surprise, and margins. A figure with no data is left out.
 */
function earningsMetrics(
  q: any,
  eps: number | null,
  est: number | null,
  quarters: any[] | null | undefined,
  reports: Array<{ fiscalYear: number; fiscalPeriod: string; epsActual: number | null }> | null | undefined,
): EventMetric[] {
  const out: EventMetric[] = [];
  const add = (k: string, v: string | null, tone?: "up" | "dn") => v && out.push({ k, v, tone });

  const surp = surprisePct(eps, est);
  if (surp != null) add("EPS surprise", signedPct(surp), toneOfNum(surp));

  const fy = q.fiscalYear != null ? Number(q.fiscalYear) : NaN;
  const per = q.fiscalPeriod;
  const priorQ = Number.isFinite(fy) && per ? quarters?.find((x) => Number(x.fiscalYear) === fy - 1 && x.fiscalPeriod === per) : undefined;
  const priorEps = Number.isFinite(fy) && per
    ? (reports ?? []).find((r) => r.fiscalYear === fy - 1 && r.fiscalPeriod === per)?.epsActual ?? priorQ?.epsActualReported ?? priorQ?.epsActual ?? null
    : null;
  const epsGrowth = yoyPct(eps, priorEps);
  if (epsGrowth != null) add("EPS growth y/y", signedPct(epsGrowth), toneOfNum(epsGrowth));
  else if (eps != null && priorEps != null && priorEps <= 0) add("EPS vs year ago", eps > priorEps ? "from a loss / flat base" : "loss widened", eps > priorEps ? "up" : "dn");

  if (q.revenue != null) add("Revenue", `$${(q.revenue / 1e9).toFixed(2)}B`);
  const salesGrowth = yoyPct(q.revenue, priorQ?.revenue);
  if (salesGrowth != null) add("Sales growth y/y", signedPct(salesGrowth), toneOfNum(salesGrowth));
  const salesSurp = surprisePct(q.revenue, q.revenueEstimateReported);
  if (salesSurp != null) add("Sales surprise", signedPct(salesSurp), toneOfNum(salesSurp));

  const gm = q.grossMarginPct ?? (q.revenue && q.grossProfit != null ? (q.grossProfit / q.revenue) * 100 : null);
  if (gm != null) add("Gross margin", `${gm.toFixed(1)}%`);
  const om = q.operatingMarginPct ?? (q.revenue && q.operatingIncome != null ? (q.operatingIncome / q.revenue) * 100 : null);
  if (om != null) add("Operating margin", `${om.toFixed(1)}%`);
  return out;
}

/** Words too common in company names to identify one ("First Solar" ≠ every "first"). */
const GENERIC_NAME_WORDS = new Set(["the", "first", "american", "general", "united", "national", "international", "global", "new", "us", "group", "holdings", "corp", "inc", "company", "bank", "capital", "energy", "health", "technologies", "technology", "systems", "financial", "realty", "trust"]);

/**
 * Whether an article is about this stock: its headline names the ticker (a
 * whole word, in capitals) or the company. Vendors tag an article with every
 * ticker it mentions, so AMD's feed carried "NVDA vs AAPL: …".
 */
export function aboutTicker(article: { headline?: unknown; title?: unknown }, ticker: string, name?: string | null): boolean {
  const headline = String(article.headline ?? article.title ?? "");
  if (!headline) return false;
  const sym = ticker.toUpperCase().replace(/[.-]/g, "[.-]?");
  if (new RegExp(`(^|[^A-Za-z0-9])\\$?${sym}([^A-Za-z0-9]|$)`).test(headline)) return true;
  const core = String(name ?? "")
    .replace(/[,.]/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|holdings?|group|class [a-c]|n ?v|s ?a|ag|se)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!core) return false;
  const lower = headline.toLowerCase();
  if (lower.includes(core.toLowerCase())) return true;
  const first = core.split(" ")[0].replace(/'s$/i, "");
  return first.length >= 4 && !GENERIC_NAME_WORDS.has(first.toLowerCase()) && new RegExp(`\\b${first.replace(/[^A-Za-z0-9]/g, "")}`, "i").test(headline);
}

/** How much a story's coverage (news-significance score, 0-100) counts when ranking headlines that all explain a move. */
const STORY_COVERAGE_WEIGHT = 0.2;

/**
 * The major daily moves of the last six months: up to five picked by move size
 * plus how much the day's best story matters, spread across the window, with the
 * latest session always included when it moved materially, and one extra card
 * for the latest few sessions if none of those picks covers them. Each is
 * labelled from real data: an FMP earnings report within 3 days (with its
 * actual beat/miss), else a headline that explains the move (pickMoveHeadline),
 * else just the move itself. Nothing is invented — no bars means no events.
 */
export function getSixMonthMajorEvents(
  sym: string,
  s: StockItem,
  bars?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>,
  quarters?: any[] | null,
  news?: any[] | null,
  /** Report-dated EPS history (financialsDoc.epsHistory) — the real report days. */
  reports?: Array<{ date: string; fiscalYear: number; fiscalPeriod: string; epsActual: number | null; epsEstimate: number | null }> | null,
): MajorSixMonthEvent[] {
  if (!bars || bars.length < 15) return [];
  const stockName = s.name || sym;
  // Only the stock's own news can explain its move (aboutTicker).
  news = (news || []).filter((x: any) => aboutTicker(x, sym, s.name));
  type MoveSession = { idx: number; t: number; ret: number; absRet: number; score: number; tier: SignificanceTier | null };
  const sig = scoreNews(news, { ticker: sym, name: s.name, bars });
  /** The article that best explains a session: published from the day before through the session itself (ET). */
  const explainers = (moveDay: number) => {
    const from = moveDay - DAY_MS;
    const to = moveDay + DAY_MS + 4 * 3_600_000;
    return (news || [])
      .map((x: any) => ({ x, ms: articleTime(x), sg: sig.get(x) }))
      .filter(({ ms, sg }) => Number.isFinite(ms) && ms >= from && ms < to && sg && !sg.filler)
      .sort((a, b) => b.sg!.score - a.sg!.score || Math.abs(a.ms - moveDay) - Math.abs(b.ms - moveDay));
  };
  const moves: MoveSession[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].c;
    if (prev > 0) {
      const ret = ((bars[i].c - prev) / prev) * 100;
      const absRet = Math.abs(ret);
      const top = explainers(Date.parse(`${new Date(bars[i].t).toISOString().slice(0, 10)}T00:00:00Z`))[0]?.sg;
      // Size of the move (up to 40) plus how much the day's best story matters (up to 60).
      const score = Math.min(absRet / 8, 1) * 40 + (top?.score ?? 0) * 0.6;
      moves.push({ idx: i, t: bars[i].t, ret, absRet, score, tier: top?.tier ?? null });
    }
  }
  // Five catalysts: the highest-scoring days, kept at least MIN_GAP sessions
  // apart and nudged to spread across the window. A big day with no story is
  // outranked by a smaller one a real story explains; the latest session always
  // qualifies when it moved materially or has a high-impact story.
  const zoneCount = 5;
  const zoneSize = Math.max(1, Math.floor(bars.length / zoneCount));
  const MIN_GAP = 3;
  const zoneOf = (idx: number) => Math.min(zoneCount - 1, Math.floor(idx / zoneSize));
  let picked: MoveSession[] = [];
  const perZone = new Array<number>(zoneCount).fill(0);
  while (picked.length < zoneCount) {
    const next = moves
      .filter((m) => !picked.includes(m) && picked.every((p) => Math.abs(p.idx - m.idx) >= MIN_GAP))
      .map((m) => ({ m, adj: m.score - 8 * perZone[zoneOf(m.idx)] }))
      .sort((a, b) => b.adj - a.adj || b.m.absRet - a.m.absRet || b.m.idx - a.m.idx)[0];
    if (!next) break;
    picked.push(next.m);
    perZone[zoneOf(next.m.idx)]++;
  }
  const latest = moves[moves.length - 1];
  if (latest && !picked.includes(latest) && (latest.absRet >= 3 || latest.tier === "HIGH")) {
    // Drop picks too close to it; if none were, drop the weakest to stay at five.
    let keep = picked.filter((p) => Math.abs(p.idx - latest.idx) >= MIN_GAP);
    if (keep.length === picked.length) keep = [...keep].sort((a, b) => b.score - a.score).slice(0, zoneCount - 1);
    picked = [...keep, latest];
  }
  const selected = picked.sort((a, b) => a.idx - b.idx);
  // Safety net for what the rules above can still miss: a quiet last session
  // (so the "latest session" rule does not apply) right after a big move that
  // no pick covers (NVDA's 10 Nov −5.5% CEO-scandal day behind a quiet 11 Nov).
  // If no pick is in the latest few sessions, the biggest unusual move there
  // gets an extra card.
  const recent = pickRecentMove(moves, selected, bars.length);
  if (recent) {
    selected.push(recent);
    selected.sort((a, b) => a.idx - b.idx);
  }


  return selected.map((m, i) => {
    const dateStr = fmtMarketDate(m.t, { month: "short", day: "2-digit" });
    const fr = +(m.idx / (bars.length - 1)).toFixed(2);
    const retFmt = `${m.ret >= 0 ? "+" : "−"}${Math.abs(m.ret).toFixed(2)}%`;

    // An earnings move is the report day itself (before-open report) or the
    // next session (after-close report, incl. over a weekend): 0–3 days after
    // the REPORT date. The 10-Q filing date (±4 days) both missed real report
    // moves (COST Sep 25) and claimed moves made before a report (NEE Jul 21).
    const moveDay = Date.parse(`${new Date(m.t).toISOString().slice(0, 10)}T00:00:00Z`);
    const rep = (reports ?? []).find((r) => {
      const d = Date.parse(`${r.date}T00:00:00Z`);
      return Number.isFinite(d) && moveDay - d >= 0 && moveDay - d <= 3 * 86_400_000;
    });
    const q = rep
      ? quarters?.find((x) => String(x.fiscalYear) === String(rep.fiscalYear) && x.fiscalPeriod === rep.fiscalPeriod) ?? {}
      : !reports?.length
        ? quarters?.find((x: any) => {
            const qd = x.filingDate || x.endDate;
            if (!qd) return false;
            return Math.abs(new Date(qd + "T00:00:00Z").getTime() - m.t) <= 4 * 86_400_000;
          })
        : undefined;
    if (q) {
      const period = rep ? `${rep.fiscalPeriod} ${rep.fiscalYear}` : [q.fiscalPeriod, q.fiscalYear].filter(Boolean).join(" ") || "Quarterly";
      const eps = rep?.epsActual ?? q.epsActualReported ?? q.epsActual ?? null;
      const est = rep?.epsEstimate ?? q.epsEstimateReported ?? q.epsEstimate ?? null;
      const verdict = eps != null && est != null ? (eps >= est ? "EPS beat" : "EPS miss") : null;
      const facts = [
        q.revenue != null ? `revenue $${(q.revenue / 1e9).toFixed(2)}B` : null,
        eps != null ? `EPS $${Number(eps).toFixed(2)}${est != null ? ` vs $${Number(est).toFixed(2)} est` : ""}` : null,
      ].filter(Boolean);
      const reportDay = rep ? Date.parse(`${rep.date}T00:00:00Z`) : moveDay;
      return {
        num: i + 1,
        date: dateStr,
        label: `${stockName} ${period} earnings${verdict ? ` · ${verdict}` : ""}`,
        category: "Earnings" as const,
        mv: +m.ret.toFixed(2),
        details: `${facts.length ? `Reported ${facts.join(", ")}. ` : ""}Stock moved ${retFmt} that session.`,
        fr,
        metrics: earningsMetrics(q, eps, est, quarters, reports),
        commentary: earningsCommentary(news, reportDay, moveDay),
        context: notableContext(news, moveDay),
      };
    }

    // A headline explains a move only if it says the stock moved that way (or
    // names a material event beside that) and came out between the previous
    // close and the evening after the session — see move-headline.ts. Allowing
    // articles up to 3 days AFTER pinned NEE's Jul 24-25 "after its latest
    // earnings report" piece onto its Jul 22 move. Among headlines that do
    // explain it, the one from the best-covered story wins (news-significance).
    const prevBar = bars[m.idx - 1];
    const prevDay = prevBar ? Date.parse(`${new Date(prevBar.t).toISOString().slice(0, 10)}T00:00:00Z`) : null;
    // When no headline says the stock moved that way, a high-impact story many
    // outlets are telling still explains a big move (the CEO-exit coverage on
    // NVDA's −5.2% day) — if the stock reacted the same way, and it is not a
    // stake filing, a law-firm ad or a recap of an earlier day.
    const n =
      pickMoveHeadline(news, { moveDay, ret: m.ret, prevDay }, (x) => (sig.get(x)?.score ?? 0) * STORY_COVERAGE_WEIGHT) ??
      explainers(moveDay).find(({ x, sg }) => {
        const h = String(x.headline ?? x.title ?? "");
        const named = mentionedDayOffset(h, moveDay);
        return (
          sg!.tier === "HIGH" &&
          sg!.reactionPct != null &&
          Math.sign(sg!.reactionPct) === Math.sign(m.ret) &&
          !isHoldingsNote(h) &&
          !isSolicitation(h) &&
          !(named != null && named < 0 && named >= -7)
        );
      })?.x;
    const title = n ? String(n.headline ?? n.title ?? "") : "";
    if (title) {
      const lower = title.toLowerCase();
      // "Earnings" only when a report actually fell on this move (handled
      // above); an article that merely mentions earnings is company news.
      const cat: MajorSixMonthEvent["category"] =
        /target|rating|upgrade|downgrade|analyst/.test(lower) ? "Analyst"
        : /product|launch|platform|unveil/.test(lower) ? "Product"
        : "Corporate";
      return {
        num: i + 1,
        date: dateStr,
        label: title,
        category: cat,
        mv: +m.ret.toFixed(2),
        details: usableSummary(n.summary || n.text) ?? `Stock moved ${retFmt} that session.`,
        fr,
        context: notableContext(news, moveDay, title),
      };
    }

    return {
      num: i + 1,
      date: dateStr,
      label: `${retFmt} session move`,
      category: "Macro" as const,
      mv: +m.ret.toFixed(2),
      details: "Largest move in this stretch; no earnings report or headline explaining it was found.",
      fr,
      context: notableContext(news, moveDay),
    };
  });
}
