import type { SiFacts } from "./data";

/**
 * The reads behind the Overview's Fundamentals and Technicals panels, the Technicals tiles and the price
 * ladder, from the redesign. Each read is one real input turned into a direction, a short headline and the
 * figure behind it; an input that is missing gives no read, never a made-up one.
 */

export type Dir = "up" | "down" | "flat";

export type Read = {
  /** What it measures: "Trend", "Momentum", ... */
  k: string;
  dir: Dir;
  /** -1 (bearish) to +1 (bullish). */
  score: number;
  headline: string;
  detail: string;
  /** The read carries a warning even when its direction is good (an overbought RSI, earnings close by). */
  caution?: boolean;
};

export type Verdict = { dir: Dir; score: number; label: string; n: number };

/** The inputs the reads use: our facts, plus two the page may not have (the top analysts' targets, peer P/E). */
export type ReadFacts = SiFacts & {
  analystTargets?: ReadonlyArray<number> | null;
  peerPe?: number | null;
  peerPeCount?: number | null;
};

const has = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const money = (v: number) => `$${v.toFixed(2)}`;
const signed = (v: number, digits = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;

/** A score as a direction; `edge` is how far from zero it must be to count. */
export function dirOf(score: number, edge = 0.2): Dir {
  return score >= edge ? "up" : score <= -edge ? "down" : "flat";
}

export function verdictLabel(score: number): string {
  return score >= 0.5 ? "BULLISH" : score >= 0.2 ? "LEAN BULLISH" : score > -0.2 ? "NEUTRAL" : score > -0.5 ? "LEAN BEARISH" : "BEARISH";
}

/** "LEAN BULLISH" -> "Lean bullish". */
export const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** The weighted average of the reads that exist; with none, NOT ENOUGH DATA. */
export function blend(parts: ReadonlyArray<{ read: { score: number } | null; w: number }>): Verdict {
  let total = 0;
  let weight = 0;
  let n = 0;
  for (const { read, w } of parts) {
    if (!read || w <= 0) continue;
    total += read.score * w;
    weight += w;
    n++;
  }
  if (!weight) return { dir: "flat", score: 0, label: "NOT ENOUGH DATA", n: 0 };
  const score = total / weight;
  return { dir: dirOf(score), score, label: verdictLabel(score), n };
}

// ---------------------------------------------------------------------------------------------- technicals

function trendRead(f: ReadFacts): Read | null {
  if (!has(f.price)) return null;
  const votes: number[] = [];
  const parts: string[] = [];
  if (has(f.sma200)) {
    votes.push(f.price > f.sma200 ? 1 : -1);
    parts.push(`${f.price > f.sma200 ? "above" : "below"} 200 DMA`);
  }
  if (has(f.sma50)) {
    votes.push(f.price > f.sma50 ? 1 : -1);
    parts.push(`${f.price > f.sma50 ? "above" : "below"} 50 DMA`);
  }
  if (has(f.sma50) && has(f.sma200)) votes.push(f.sma50 > f.sma200 ? 1 : -1);
  if (has(f.sma21)) votes.push(f.price > f.sma21 ? 0.5 : -0.5);
  if (!votes.length) return null;
  const score = clamp(votes.reduce((a, b) => a + b, 0) / votes.length);
  const headline = score >= 0.7 ? "Uptrend" : score >= 0.25 ? "Leaning up" : score > -0.25 ? "Sideways" : score > -0.7 ? "Leaning down" : "Downtrend";
  return { k: "Trend", dir: dirOf(score, 0.25), score, headline, detail: parts.length ? `Price ${parts.join(" and ")}` : "Short-term averages only" };
}

function momentumRead(f: ReadFacts): Read | null {
  if (!has(f.rsi14)) return null;
  const rsi = f.rsi14;
  let score = clamp((rsi - 50) / 25);
  let headline = rsi >= 55 ? "Strong" : rsi > 45 ? "Neutral" : "Weak";
  let caution = false;
  if (rsi >= 70) {
    score = 0.3;
    headline = "Stretched";
    caution = true;
  } else if (rsi <= 30) {
    score = -0.4;
    headline = "Oversold";
    caution = true;
  }
  const detail =
    rsi >= 70
      ? `RSI ${rsi.toFixed(0)} — overbought, pullbacks are common here`
      : rsi <= 30
        ? `RSI ${rsi.toFixed(0)} — oversold, selling may be exhausted`
        : `RSI ${rsi.toFixed(0)} (neutral band 45–55)`;
  return { k: "Momentum", dir: dirOf(score, 0.25), score, headline, detail, caution };
}

function strengthRead(f: ReadFacts): Read | null {
  if (!has(f.rsRating)) return null;
  const rs = f.rsRating;
  const score = clamp((rs - 50) / 40);
  const headline = rs >= 80 ? "Market leader" : rs >= 60 ? "Outperforming" : rs >= 40 ? "In line" : rs >= 20 ? "Lagging" : "Laggard";
  const sector = has(f.sectorRank) && has(f.sectorRankTotal) ? ` · sector #${f.sectorRank} of ${f.sectorRankTotal}` : "";
  return { k: "Strength", dir: dirOf(score, 0.25), score, headline, detail: `RS rating ${Math.round(rs)}/99 vs the market${sector}` };
}

function volumeRead(f: ReadFacts): Read | null {
  if (!has(f.rvol)) return null;
  const move = has(f.changePct) ? f.changePct : 0;
  const heavy = f.rvol >= 1.5;
  const side = Math.abs(move) < 0.3 ? 0 : move > 0 ? 1 : -1;
  const score = heavy ? clamp(side * Math.min(1, (f.rvol - 1) / 1.5)) : 0;
  const headline = heavy ? (side > 0 ? "Heavy buying" : side < 0 ? "Heavy selling" : "Heavy, flat day") : f.rvol < 0.7 ? "Quiet" : "Normal";
  const day = heavy && side !== 0 ? ` on a ${side > 0 ? "rising" : "falling"} day` : "";
  return { k: "Volume", dir: dirOf(score, 0.25), score, headline, detail: `${f.rvol.toFixed(1)}× the 20-day average${day}` };
}

function highRead(f: ReadFacts): Read | null {
  if (!has(f.pctFromHigh52)) return null;
  const off = f.pctFromHigh52;
  const score = off >= -3 ? 0.8 : off >= -10 ? 0.4 : off >= -20 ? 0 : off >= -35 ? -0.4 : -0.8;
  const headline = off >= -3 ? "At the highs" : off >= -10 ? "Near highs" : off >= -20 ? "Mid-range" : off >= -35 ? "Well off highs" : "Deep drawdown";
  return { k: "52W position", dir: dirOf(score, 0.25), score, headline, detail: `${Math.abs(off).toFixed(1)}% ${off <= 0 ? "below" : "above"} the 52-week high` };
}

export type Level = { label: string; value: number; kind: "support" | "resistance"; pct: number };

/**
 * Every real level near the price: pivots, the 9, 21, 50 and 200 DMA and the 52-week high, split into
 * support (under the price, nearest first) and resistance (over it, nearest first). A level within
 * 0.05% of the price is the price, not a level.
 */
export function supportResistance(f: ReadFacts): { supports: Level[]; resistances: Level[] } {
  if (!has(f.price) || f.price <= 0) return { supports: [], resistances: [] };
  const price = f.price;
  const candidates: Array<[string, number | null | undefined]> = [
    ["R2", f.pivotR2],
    ["R1", f.pivotR1],
    ["S1", f.pivotS1],
    ["S2", f.pivotS2],
    ["9 DMA", f.sma9],
    ["21 DMA", f.sma21],
    ["50 DMA", f.sma50],
    ["200 DMA", f.sma200],
    ["52W high", has(f.pctFromHigh52) && f.pctFromHigh52 > -99 ? price / (1 + f.pctFromHigh52 / 100) : null],
  ];
  const levels: Level[] = [];
  for (const [label, value] of candidates) {
    if (!has(value) || value <= 0 || Math.abs(value - price) / price < 5e-4) continue;
    levels.push({ label, value, kind: value < price ? "support" : "resistance", pct: (value / price - 1) * 100 });
  }
  return {
    supports: levels.filter((l) => l.kind === "support").sort((a, b) => b.value - a.value),
    resistances: levels.filter((l) => l.kind === "resistance").sort((a, b) => a.value - b.value),
  };
}

export type TechnicalRead = { verdict: Verdict; reads: Read[]; action: string; nextSupport: Level | null; nextResistance: Level | null };

export function technicalRead(f: ReadFacts): TechnicalRead {
  const trend = trendRead(f);
  const momentum = momentumRead(f);
  const strength = strengthRead(f);
  const volume = volumeRead(f);
  const high = highRead(f);
  const reads = [trend, momentum, strength, volume, high].filter((r): r is Read => !!r);
  const verdict = blend([
    { read: trend, w: 0.35 },
    { read: momentum, w: 0.2 },
    { read: strength, w: 0.25 },
    { read: volume, w: 0.1 },
    { read: high, w: 0.1 },
  ]);
  const { supports, resistances } = supportResistance(f);
  const support = supports[0] ?? null;
  const resistance = resistances[0] ?? null;
  // The line that, if broken, ends the uptrend: the 50 DMA when the price is above it, otherwise the nearest support.
  const trendLine = has(f.sma50) && has(f.price) && f.price > f.sma50 ? { label: "50 DMA", value: f.sma50 } : support;
  let action: string;
  if (!verdict.n) {
    action = "Not enough price history yet to call a direction.";
  } else if (verdict.dir === "up") {
    action =
      momentum?.caution && momentum.score > 0
        ? `Trend is up but stretched — a pullback toward ${support ? money(support.value) : "support"} is more likely than a clean run.`
        : `Buyers are in control. First support is ${support ? `${support.label} ${money(support.value)}` : "nearby"}${trendLine ? `; the trend breaks on a close below ${trendLine.label} ${money(trendLine.value)}` : ""}.`;
  } else if (verdict.dir === "down") {
    action = `Sellers are in control. A reclaim of ${has(f.sma50) ? `the 50 DMA ${money(f.sma50)}` : resistance ? money(resistance.value) : "resistance"} is the first sign of a turn.`;
  } else {
    action = `No clear edge. A close above ${resistance ? money(resistance.value) : "resistance"} turns it constructive; below ${support ? money(support.value) : "support"} turns it weak.`;
  }
  return { verdict, reads, action, nextSupport: support, nextResistance: resistance };
}

// ------------------------------------------------------------------------------------------- fundamentals

function growthRead(f: ReadFacts): Read | null {
  if (!has(f.revGrowthYoY)) return null;
  const g = f.revGrowthYoY;
  const score = g >= 25 ? 1 : g >= 15 ? 0.8 : g >= 7 ? 0.5 : g >= 3 ? 0.25 : g > -3 ? 0 : g > -10 ? -0.5 : -0.9;
  const headline = g >= 15 ? "Growing fast" : g >= 3 ? "Growing" : g > -3 ? "Flat" : "Shrinking";
  return { k: "Growth", dir: dirOf(score), score, headline, detail: `Revenue ${signed(g)} y/y (latest quarter)` };
}

function marginsRead(f: ReadFacts): Read | null {
  if (!has(f.opMargin)) return null;
  const change = has(f.opMarginYearAgo) ? f.opMargin - f.opMarginYearAgo : null;
  const level = f.opMargin >= 25 ? 0.3 : f.opMargin >= 10 ? 0.1 : f.opMargin >= 0 ? -0.2 : -0.6;
  const trend = change == null ? 0 : clamp(change / 6) * 0.7;
  const score = clamp(level + trend);
  const headline = change != null && change >= 1 ? "Expanding" : change != null && change <= -1 ? "Squeezed" : f.opMargin < 0 ? "Loss-making" : "Stable";
  const moved = change != null && Math.abs(change) >= 0.5 ? ` (${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)} pts y/y)` : "";
  return { k: "Margins", dir: dirOf(score), score, headline, detail: `Operating margin ${f.opMargin.toFixed(1)}%${moved}` };
}

function earningsRead(f: ReadFacts): Read | null {
  if (!has(f.epsBeats) || !f.epsReports) return null;
  const rate = f.epsBeats / f.epsReports;
  // A short record counts for less: the same beat rate over fewer than four reports is pulled toward zero.
  const share = Math.min(f.epsReports, 4) / 4;
  let score = (rate >= 0.75 ? 0.8 : rate >= 0.5 ? 0.3 : -0.6) * share;
  let ahead = "";
  if (has(f.fwdEps) && has(f.nextFyEps) && f.fwdEps > 0) {
    const g = (f.nextFyEps / f.fwdEps - 1) * 100;
    score = clamp(score + clamp(g / 40) * 0.4);
    ahead = ` · next-FY EPS est. ${signed(g, 0)}`;
  }
  const headline = f.epsReports < 3 ? (rate >= 0.5 ? "Beat so far" : "Missed so far") : rate >= 0.75 ? "Beats often" : rate >= 0.5 ? "Mixed record" : "Misses";
  return { k: "Earnings", dir: dirOf(score), score, headline, detail: `Beat ${f.epsBeats} of last ${f.epsReports}${ahead}` };
}

function valuationRead(f: ReadFacts, forwardPe: number | null | undefined): Read | null {
  const trailing = has(f.trailingPe) && f.trailingPe > 0 ? f.trailingPe : null;
  const pe = has(forwardPe) && forwardPe > 0 ? forwardPe : trailing;
  if (pe == null) return null;
  const level = pe >= 50 ? -0.8 : pe >= 35 ? -0.5 : pe >= 25 ? -0.2 : pe >= 15 ? 0.2 : 0.6;
  // Against the peers' average P/E when at least three peers have one.
  if (trailing != null && has(f.peerPe) && f.peerPe > 0 && (f.peerPeCount ?? 0) >= 3) {
    const score = (clamp((f.peerPe - trailing) / f.peerPe / 0.5) + level) / 2;
    const ratio = trailing / f.peerPe;
    const headline = ratio < 0.8 ? "Cheaper than peers" : ratio > 1.25 ? "Pricier than peers" : "In line with peers";
    const fwd = has(forwardPe) && forwardPe > 0 ? ` · ${forwardPe.toFixed(1)}× forward` : "";
    return { k: "Valuation", dir: dirOf(score), score, headline, detail: `${trailing.toFixed(1)}× trailing earnings${fwd}` };
  }
  const headline = pe >= 50 ? "Very rich" : pe >= 35 ? "Expensive" : pe >= 25 ? "Full" : pe >= 15 ? "Fair" : "Cheap";
  return { k: "Valuation", dir: dirOf(level), score: level, headline, detail: `${pe.toFixed(1)}× ${has(forwardPe) && forwardPe > 0 ? "forward" : "trailing"} earnings` };
}

/** The top analysts' targets (up to five): how many, their average and their median. */
export function topTargets(targets: ReadonlyArray<number> | null | undefined): { n: number; avg: number; median: number } | null {
  const t = (targets ?? []).filter((v) => Number.isFinite(v) && v > 0).slice(0, 5);
  if (!t.length) return null;
  const sorted = [...t].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return { n: t.length, avg: t.reduce((a, b) => a + b, 0) / t.length, median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 };
}

function analystsRead(f: ReadFacts): Read | null {
  const top = topTargets(f.analystTargets);
  const target = top?.avg ?? f.targetMean;
  if (!has(target) || !has(f.price) || f.price <= 0) return null;
  const upside = (target / f.price - 1) * 100;
  const net = has(f.upgrades90) && has(f.downgrades90) ? f.upgrades90 - f.downgrades90 : 0;
  const score = clamp(clamp(upside / 25) + clamp(net / 6) * 0.3);
  const headline = upside >= 15 ? "Upside to target" : upside >= 3 ? "Modest upside" : upside > -3 ? "At target" : "Above target";
  const moves = has(f.upgrades90) && has(f.downgrades90) && (f.upgrades90 || f.downgrades90) ? ` · ${f.upgrades90}↑ ${f.downgrades90}↓ in 90d` : "";
  const vs = (v: number) => signed((v / f.price! - 1) * 100, 1);
  const detail = top
    ? `Top ${top.n} analysts · avg target ${money(top.avg)} (${vs(top.avg)}) · median ${money(top.median)} (${vs(top.median)})`
    : `${f.consensus ? `${f.consensus} · ` : ""}target ${money(target)} (${signed(upside, 1)})${moves}`;
  return { k: "Analysts", dir: dirOf(score), score, headline, detail };
}

export type FundamentalRead = { verdict: Verdict; reads: Read[]; action: string };

export function fundamentalRead(f: ReadFacts, forwardPe: number | null | undefined): FundamentalRead {
  const growth = growthRead(f);
  const margins = marginsRead(f);
  const earnings = earningsRead(f);
  const valuation = valuationRead(f, forwardPe);
  const analysts = analystsRead(f);
  const reads = [growth, margins, earnings, valuation ?? analysts].filter((r): r is Read => !!r);
  const verdict = blend([
    { read: growth, w: 0.3 },
    { read: margins, w: 0.2 },
    { read: earnings, w: 0.2 },
    { read: valuation, w: 0.15 },
    { read: analysts, w: 0.15 },
  ]);
  let action: string;
  if (!verdict.n) {
    action = "Quarterly fundamentals aren't synced for this stock yet.";
  } else {
    const strongBusiness = (growth?.score ?? 0) + (margins?.score ?? 0) + (earnings?.score ?? 0) > 0.6;
    const rich = (valuation?.score ?? 0) <= -0.5;
    action =
      strongBusiness && rich
        ? "The business is strong but the price already reflects it — the stock needs to keep beating to hold this multiple."
        : strongBusiness
          ? "Business momentum is solid and the price isn't stretched against it."
          : rich
            ? "Expensive without growth to back it — vulnerable to any miss."
            : verdict.dir === "down"
              ? "Fundamentals are weakening — earnings need to turn before the story improves."
              : "Mixed picture — no strong fundamental push either way.";
  }
  return { verdict, reads, action };
}

// ----------------------------------------------------------------------------------------------- overall

/**
 * The overall verdict behind the MarketCatalyst read: the technical read (35%), the fundamental read (30%) and
 * the MC Confidence score (35%), each only if it has data.
 */
export function overallVerdict(technical: Verdict, fundamental: Verdict, mcConfidence: number | null | undefined): Verdict {
  const asRead = (v: Verdict) => (v.n ? { score: v.score } : null);
  const mc = has(mcConfidence) ? { score: clamp((mcConfidence - 50) / 40) } : null;
  return blend([
    { read: asRead(technical), w: 0.35 },
    { read: asRead(fundamental), w: 0.3 },
    { read: mc, w: 0.35 },
  ]);
}

/** A verdict as the Overview menu shows it: its label in sentence case and its direction; "No data" without reads. */
export function verdictStatus(v: Verdict): { status: string; tone: Dir } {
  return v.n > 0 ? { status: sentenceCase(v.label), tone: v.dir } : { status: "No data", tone: "flat" };
}
