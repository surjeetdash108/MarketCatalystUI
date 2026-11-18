/*
 * Alpha Signals — swing engine (2–6 week horizon) and the 13 stock screens.
 *
 * Everything here is a pure function of fields the backend already serves
 * (company docs, analyst consensus, IPO events). Nothing is simulated: a
 * component with no input is `null` and is left out of the score (the rest are
 * re-weighted), never scored as zero. Weights, bands and cut-offs are design
 * choices — not a back-tested model — and are declared here so they can be
 * reviewed in one place. Rules follow "Alpha Signals — Swing & Intraday:
 * Rules, Logic and Handoff Spec" §3 (as of 2026-11-12).
 *
 * One number everywhere: the score is a 0–100 emergence score, high = strong,
 * low = weak. The bearish side uses the same number; its lists show the lowest
 * (weakest) first.
 */

import type { AnalystConsensusDoc, CompanyDoc, IpoEventDoc } from "./types";
import { INDEX_MEMBERS } from "./index-constituents";
import { isCommonEquity } from "./universe.util";
import { isLeveragedProduct } from "./data";

export type CompKey = "m" | "rs" | "f" | "c" | "conf";
export const KEYS: CompKey[] = ["m", "rs", "f", "c", "conf"];

export const LABEL: Record<CompKey, string> = {
  m: "Momentum",
  rs: "Relative Strength",
  f: "Fundamental Inflection",
  c: "Catalyst Potential",
  conf: "Signal Confluence",
};

/** Design weights (percent). Normalised over the components that have data. */
export const WEIGHTS: Record<CompKey, number> = { m: 25, rs: 25, f: 20, c: 15, conf: 15 };

/** What each component measures (score-info popups). */
export const COMP_INFO: Record<CompKey, { desc: string }> = {
  m: { desc: "Is the trend constructive? Price vs. its 50/200-day averages, RSI band, MACD and the last 5 sessions. Capped at 40 while price is below both averages." },
  rs: { desc: "Is it beating the market? Relative-strength rating ranked across the synced universe." },
  f: { desc: "Are fundamentals supportive? Year-over-year EPS and revenue growth." },
  c: { desc: "Is something there that could re-rate it? Analyst price target, ratings, recent upgrades and unusual volume." },
  conf: { desc: "Do the signals agree? How many independent signal families (the four above plus 13F institutional flow) point the same way." },
};

const TXT: Record<CompKey, { up: [string, string]; dn: [string, string] }> = {
  m: {
    up: ["Momentum constructive", "Trend posture, RSI and recent price action are aligned to the upside."],
    dn: ["Momentum fading", "Trend posture or recent price action has weakened."],
  },
  rs: {
    up: ["Relative strength leading", "The stock is outperforming most of the market."],
    dn: ["Relative strength lagging", "The stock is trailing most of the market."],
  },
  f: {
    up: ["Fundamental confirmation", "Earnings and revenue growth are supportive."],
    dn: ["Fundamentals softening", "Earnings or revenue growth is weak."],
  },
  c: {
    up: ["Catalyst developing", "Analyst targets, ratings or volume point to a possible re-rating."],
    dn: ["Catalyst uncertainty", "Little analyst or activity support for a re-rating."],
  },
  conf: {
    up: ["Signals in agreement", "Independent signal families point the same way."],
    dn: ["Signals diverging", "Independent signal families disagree on direction."],
  },
};

/** The workbook-verified trend (§3.2). Never replaced; the display label can be. */
export type Trend =
  | "Weakening"
  | "Losing momentum"
  | "Under pressure"
  | "Pulling back"
  | "Emerging"
  | "Strengthening"
  | "Stable";

/** What the user sees beside the score (§3.3): the trend, or a mirrored label that replaces it. */
export type DisplayLabel =
  | Trend
  | "Extended"
  | "Breakout"
  | "Recovering"
  | "Oversold"
  | "Breakdown"
  | "Bouncing"
  | "Rolling over"
  | "Downtrend";

export type Risk = "Low" | "Moderate" | "Elevated" | "High";
export type ActionKey = "act" | "alert" | "watch" | "avoid";
export type Side = "bull" | "bear";

export interface Action {
  key: ActionKey;
  /** Heading in the pick popup. */
  label: string;
  /** Pill text. */
  short: string;
  why: string;
}

export interface Comp {
  key: CompKey;
  label: string;
  weight: number;
  /** 0–100, or null when no input is available. */
  value: number | null;
  status: "Strong" | "Solid" | "Fair" | "Weak" | "Unavailable";
  /** The real figures behind the number, e.g. "RS rating 91/99". */
  metric: string;
}

export interface Tag {
  text: string;
  warn: boolean;
}

export interface Signal {
  c: CompanyDoc;
  score: number;
  /** Share of the total weight that had data (0–100). */
  coverage: number;
  comps: Comp[];
  trend: Trend;
  /** The name shown (trend or a mirrored label). */
  label: DisplayLabel;
  /** Bullish-side action (the workbook's: Avoid on a Weakening stock). */
  action: Action;
  /** Bearish-side action; meaningful only for Weakening stocks. */
  bear: Action;
  risk: Risk | null;
  tags: Tag[];
  /** Price vs the 50-DMA from the live price (flag fallback); null = unknown. */
  above50: boolean | null;
  above200: boolean | null;
  /** % from the 52-week high / low from the live price (backend field fallback). */
  fromHigh: number | null;
  fromLow: number | null;
  earningsSoon: boolean;
  illiquid: boolean;
  why: Array<{ title: string; body: string; good: boolean }>;
  sup: string[];
  opp: string[];
  keyRisk: string;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
/** "+1.2%" / "-0.4%"; a value that rounds to zero prints "0.0%" (never "-0.0%"). */
const signed = (n: number, d = 1) => {
  const r = Number(n.toFixed(d));
  return `${r > 0 ? "+" : ""}${(r === 0 ? 0 : r).toFixed(d)}%`;
};
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const DAY = 86_400_000;

export function compStatus(v: number | null): Comp["status"] {
  return v == null ? "Unavailable" : v >= 80 ? "Strong" : v >= 65 ? "Solid" : v >= 50 ? "Fair" : "Weak";
}

/** Best between RSI 50 and 70, fading linearly outside the band. */
function rsiBand(rsi: number): number {
  return rsi >= 50 && rsi <= 70 ? 100 : Math.max(0, 100 - Math.min(Math.abs(rsi - 60) - 10, 50) * 2);
}

/**
 * Price vs a moving average: the live price against the average when both are
 * known (the backend's precomputed flag lags the quote), the flag otherwise.
 */
function aboveAvg(price: number | null, avg: number | null | undefined, flag: boolean | null | undefined): boolean | null {
  if (num(price) && price > 0 && num(avg) && avg > 0) return price > avg;
  return flag ?? null;
}
export const above50Of = (c: CompanyDoc) => aboveAvg(c.price, c.sma50, c.aboveSma50);
export const above200Of = (c: CompanyDoc) => aboveAvg(c.price, c.sma200, c.aboveSma200);

/** % from the 52-week high (≤ 0), from the live price; the backend field as a fallback. */
export function fromHighOf(c: CompanyDoc): number | null {
  if (num(c.price) && c.price > 0 && num(c.high52) && c.high52 > 0) return Math.min(0, (c.price / c.high52 - 1) * 100);
  return num(c.pctFromHigh52) ? c.pctFromHigh52 : null;
}
/** % above the 52-week low (≥ 0), from the live price; the backend field as a fallback. */
export function fromLowOf(c: CompanyDoc): number | null {
  if (num(c.price) && c.price > 0 && num(c.low52) && c.low52 > 0) return Math.max(0, (c.price / c.low52 - 1) * 100);
  return num(c.pctFromLow52) ? c.pctFromLow52 : null;
}

interface Part { v: number | null; metric: string }

/** Momentum cap while price is below BOTH averages (§3.1). */
export const MOMENTUM_CAP_BELOW_BOTH = 40;

function momentum(c: CompanyDoc): Part {
  const parts: number[] = [];
  const bits: string[] = [];
  const a50 = above50Of(c);
  const a200 = above200Of(c);
  const have = [a50, a200].filter((x): x is boolean => x != null);
  if (have.length) {
    parts.push((have.filter(Boolean).length / have.length) * 100);
    bits.push(
      a50 === true && a200 === true ? "above 50 & 200-DMA"
        : a50 === false && a200 === false ? "below 50 & 200-DMA"
          : a50 === true ? "above 50-DMA only"
            : a200 === true ? "above 200-DMA only"
              : a50 === false ? "below 50-DMA" : "below 200-DMA",
    );
  }
  if (num(c.rsi14)) { parts.push(rsiBand(c.rsi14)); bits.push(`RSI ${Math.round(c.rsi14)}`); }
  if (num(c.macdHistogram)) { parts.push(c.macdHistogram > 0 ? 80 : 25); bits.push(`MACD ${c.macdHistogram > 0 ? "positive" : "negative"}`); }
  if (num(c.week5ChangePct)) { parts.push(clamp(50 + c.week5ChangePct * 6)); bits.push(`5D ${signed(c.week5ChangePct)}`); }
  let v = mean(parts);
  if (v != null && a50 === false && a200 === false) v = Math.min(v, MOMENTUM_CAP_BELOW_BOTH);
  return { v: v == null ? null : Math.round(v), metric: bits.length ? bits.join(" · ") : "No technicals returned yet" };
}

function relStrength(c: CompanyDoc): Part {
  return !num(c.rsRating)
    ? { v: null, metric: "No RS rating yet" }
    : { v: Math.round(clamp(c.rsRating)), metric: `RS rating ${Math.round(c.rsRating)}/99` };
}

function fundamentals(c: CompanyDoc): Part {
  const parts: number[] = [];
  const bits: string[] = [];
  if (num(c.epsGrowthYoY)) { parts.push(clamp(50 + c.epsGrowthYoY * 100 * 0.8)); bits.push(`EPS ${signed(c.epsGrowthYoY * 100, 0)} YoY`); }
  if (num(c.revenueGrowthYoY)) { parts.push(clamp(50 + c.revenueGrowthYoY * 100 * 1.5)); bits.push(`revenue ${signed(c.revenueGrowthYoY * 100, 0)} YoY`); }
  const v = mean(parts);
  return { v: v == null ? null : Math.round(v), metric: bits.length ? bits.join(" · ") : "No growth figures returned yet" };
}

/** Upgrades and downgrades in the last `days` days from the per-firm rating changes. */
export function recentGrades(a: AnalystConsensusDoc | undefined, days: number, now = Date.now()) {
  const inWindow = (a?.recentGrades ?? []).filter(g => {
    const t = Date.parse(g.date);
    return Number.isFinite(t) && now - t <= days * DAY && now - t >= -DAY;
  });
  const act = (g: { action: string | null }) => (g.action ?? "").toLowerCase();
  return {
    ups: inWindow.filter(g => act(g) === "upgrade"),
    downs: inWindow.filter(g => act(g) === "downgrade"),
  };
}

function catalyst(c: CompanyDoc, a: AnalystConsensusDoc | undefined, now: number): Part {
  const parts: number[] = [];
  const bits: string[] = [];
  if (a && num(c.price) && c.price > 0 && num(a.priceTargetConsensus)) {
    const up = a.priceTargetConsensus / c.price - 1;
    parts.push(clamp(50 + up * 100 * 1.5));
    bits.push(`target ${signed(up * 100, 0)} vs price`);
  }
  if (a) {
    const tot = a.strongBuy + a.buy + a.hold + a.sell + a.strongSell;
    if (tot > 0) {
      const share = (a.strongBuy + a.buy) / tot;
      parts.push(share * 100);
      bits.push(`${Math.round(share * 100)}% buy ratings`);
    }
    const { ups, downs } = recentGrades(a, 30, now);
    if (ups.length + downs.length > 0) {
      parts.push(clamp(50 + (ups.length - downs.length) * 25));
      bits.push(`${ups.length} up / ${downs.length} down (30d)`);
    }
  }
  if (num(c.rvol)) { parts.push(clamp((c.rvol / 2) * 100)); bits.push(`RVOL ${c.rvol.toFixed(1)}×`); }
  const v = mean(parts);
  return { v: v == null ? null : Math.round(v), metric: bits.length ? bits.join(" · ") : "No analyst or volume data yet" };
}

/** 13F flow family: holders / shares rising quarter over quarter (75 / 50 / 30). */
function instFlow(c: CompanyDoc): number | null {
  const h = c.inst13FHoldersChange;
  const s = c.inst13FSharesChange;
  if (h == null && s == null) return null;
  const up = (h ?? 0) > 0 || (s ?? 0) > 0;
  const down = (h ?? 0) < 0 || (s ?? 0) < 0;
  return up && !down ? 75 : down && !up ? 30 : 50;
}

/** 5D vs 1M pace (§3.2): a 5-session move is "faster" when it beats 1M × 5/21. */
export const PACE = 5 / 21;

/**
 * Trend (§3.2), checked top to bottom, first match wins. Units: percent.
 * 5D = 5-session change, 1M = 21-session change, today = day change.
 */
export function trendOf(c: CompanyDoc): Trend {
  const w5 = c.week5ChangePct;
  if (!num(w5)) return "Stable";
  const m1 = num(c.monthChangePct) ? c.monthChangePct : null;
  const today = num(c.pctChange) ? c.pctChange : 0;
  const notAbove50 = above50Of(c) === false;
  if (w5 <= -3 || (w5 < 0 && notAbove50)) return "Weakening";
  if (notAbove50) return "Losing momentum";
  if (today <= -5) return "Under pressure";
  if (w5 >= 4 && today < 0) return "Pulling back";
  if (w5 >= 4 && (m1 == null || w5 > m1 * PACE)) return "Emerging";
  if (w5 >= 1.5) return "Strengthening";
  return "Stable";
}

/** Rising trends — the only ones that can be a bullish pick. */
export const isRising = (t: Trend) => t === "Emerging" || t === "Strengthening" || t === "Pulling back";

/** Why a rising stock reads Extended (§3.3/§3.4), or null when it isn't stretched. */
export function extendedReason(c: CompanyDoc): string | null {
  const today = num(c.pctChange) ? c.pctChange : null;
  if (today != null && today >= 5) return `Up ${signed(today)} today — stretched; wait for a pullback before chasing.`;
  if (num(c.week5ChangePct) && c.week5ChangePct >= 25) return `Up ${signed(c.week5ChangePct)} in 5 days — parabolic; wait for a pullback before chasing.`;
  if (num(c.rsi14) && c.rsi14 >= 80) return `RSI ${Math.round(c.rsi14)} — overbought; wait for a pullback before chasing.`;
  if (num(c.price) && num(c.sma50) && c.sma50 > 0 && c.price > 1.4 * c.sma50)
    return `${Math.round((c.price / c.sma50 - 1) * 100)}% above its 50-day average — stretched; wait for a pullback before chasing.`;
  return null;
}

/** Display label (§3.3), built as mirrored pairs; the trend field itself never changes. */
export function labelOf(c: CompanyDoc, trend: Trend): DisplayLabel {
  const today = num(c.pctChange) ? c.pctChange : 0;
  const rvol = num(c.rvol) ? c.rvol : 0;
  if (isRising(trend)) {
    if (extendedReason(c)) return "Extended";
    const fh = fromHighOf(c);
    if (fh != null && fh >= -1.5 && today >= 2 && rvol >= 1.5) return "Breakout";
    return trend;
  }
  if (trend === "Losing momentum") {
    const w5 = c.week5ChangePct ?? 0;
    if (w5 >= 4 && num(c.price) && num(c.sma50) && c.sma50 > 0 && c.price >= 0.95 * c.sma50) return "Recovering";
    return trend;
  }
  if (trend === "Weakening") {
    const w5 = c.week5ChangePct ?? 0;
    if (w5 <= -20 || (num(c.rsi14) && c.rsi14 < 25)) return "Oversold";
    const fl = fromLowOf(c);
    if (fl != null && fl <= 3 && today <= -2 && rvol >= 1.5) return "Breakdown";
    if (today >= 1.5) return "Bouncing";
    if (above50Of(c) === true) return "Rolling over";
    return "Downtrend";
  }
  return trend;
}

/** Colour of a trend / label (tags, rulebook). */
export const LABEL_COLOR: Record<DisplayLabel, string> = {
  Emerging: "var(--up)",
  Strengthening: "var(--alp-up2)",
  "Pulling back": "var(--warn)",
  Stable: "var(--text-dim-solid)",
  "Losing momentum": "#f0883e",
  "Under pressure": "#f5a623",
  Weakening: "var(--down)",
  Extended: "var(--warn)",
  Breakout: "var(--up)",
  Recovering: "var(--alp-blue)",
  Oversold: "var(--warn)",
  Breakdown: "var(--down)",
  Bouncing: "var(--warn)",
  "Rolling over": "var(--down)",
  Downtrend: "var(--down)",
};

export function riskOf(c: CompanyDoc): Risk | null {
  const vol = c.realizedVol30;
  if (num(vol)) return vol < 25 ? "Low" : vol < 40 ? "Moderate" : vol < 60 ? "Elevated" : "High";
  const b = c.beta;
  if (num(b)) return b < 0.9 ? "Low" : b < 1.3 ? "Moderate" : b < 1.8 ? "Elevated" : "High";
  return null;
}
export const RISK_N: Record<Risk, number> = { Low: 1, Moderate: 2, Elevated: 3, High: 4 };

/** Earnings window for the caps: now − 1 day … now + 5 days. */
export function earningsSoon(c: CompanyDoc, now: number): boolean {
  if (!c.nextEarningsDate) return false;
  const t = Date.parse(c.nextEarningsDate.length <= 10 ? `${c.nextEarningsDate}T12:00:00Z` : c.nextEarningsDate);
  return Number.isFinite(t) && t >= now - DAY && t <= now + 5 * DAY;
}

/** Liquidity floor: price ≥ $5 and average traded value ≥ $20M (unknown volume passes). */
export const MIN_PRICE = 5;
export const MIN_TRADED_VALUE = 20_000_000;
export function isIlliquid(c: CompanyDoc): boolean {
  if (num(c.price) && c.price < MIN_PRICE) return true;
  if (num(c.price) && num(c.avgVolume20) && c.avgVolume20 * c.price < MIN_TRADED_VALUE) return true;
  return false;
}

/** Minimum data coverage (%) for a pick and for any Setup active. */
export const MIN_PICK_COVERAGE = 70;
/** Swing bars: Setup active ≥ 75 / Building 60–74 (long); downside ≥ 70 / 55–69 (short). */
export const SWING_ACT = 75;
export const SWING_BUILD = 60;
/** Bearish side, on the shown score: Setup active ≤ 30, Building 31–45, Watch > 45. */
export const SWING_SHORT_ACT = 30;
export const SWING_SHORT_BUILD = 45;
export const SMALL_CAP = 500_000_000;

const A = (key: ActionKey, why: string): Action => ({
  key,
  label: key === "act" ? "Setup active" : key === "alert" ? "Building" : key === "watch" ? "Watch" : "Avoid for now",
  short: key === "act" ? "Setup active" : key === "alert" ? "Building" : key === "watch" ? "Watch" : "Avoid",
  why,
});

const fmtDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

/** Bullish-side action (§3.4). */
export function actionOf(c: CompanyDoc, score: number, trend: Trend, coverage: number, now: number): Action {
  if (trend === "Weakening") return A("avoid", "Price action is deteriorating — wait for it to stabilise.");
  if (trend === "Losing momentum") return A("watch", "Price is not above its 50-day average — wait for it to reclaim it.");
  if (trend === "Under pressure") return A("watch", "Down 5% or more today — wait for the close.");
  if (isRising(trend)) {
    if (coverage < MIN_PICK_COVERAGE) return A("watch", `Only ${coverage}% of the inputs have data — too little to act on.`);
    if (score >= SWING_ACT) {
      if (earningsSoon(c, now)) return A("alert", `Earnings ${c.nextEarningsDate ? `due ${fmtDay(c.nextEarningsDate)}` : "within 5 days"} — wait until the report is out before acting.`);
      const fh = fromHighOf(c);
      if (fh != null && fh <= -50) return A("alert", `${Math.abs(fh).toFixed(0)}% below its 52-week high — a rebound inside a longer downtrend, not a confirmed trend.`);
      const ext = extendedReason(c);
      if (ext) return A("alert", ext);
      if (isIlliquid(c)) return A("alert", "Thinly traded (under $5 or under $20M a day) — fills and stops are unreliable.");
      return A("act", coverage >= 100
        ? "Score is high, the trend is rising and the data is complete — the setup is in play."
        : `Score is high and the trend is rising — the setup is in play (${coverage}% of the inputs have data).`);
    }
    if (score < SWING_BUILD) return A("watch", "The trend is rising but the score is under 60 — no edge yet.");
    return A("alert", "Improving but not yet confirmed — watch for the score to cross 75.");
  }
  return A("watch", "No clear edge yet — keep it on the radar.");
}

/** Bearish-side action (§3.5), on the shown score (lower = weaker). */
export function bearActionOf(c: CompanyDoc, score: number, trend: Trend, coverage: number, now: number): Action {
  const today = num(c.pctChange) ? c.pctChange : 0;
  if (trend !== "Weakening") return A("watch", "Not in a confirmed downtrend.");
  if (coverage < MIN_PICK_COVERAGE) return A("watch", `Only ${coverage}% of the inputs have data — too little to act on.`);
  if (today >= 3) return A("watch", `Up ${signed(today)} today — wait for the rally to fade.`);
  if (score > SWING_SHORT_BUILD) return A("watch", "Score above 45 — not weak enough for a short setup.");
  if (score > SWING_SHORT_ACT) return A("alert", "Weakness is building — wait for the score to fall to 30 or lower.");
  if (earningsSoon(c, now)) return A("alert", `Earnings ${c.nextEarningsDate ? `due ${fmtDay(c.nextEarningsDate)}` : "within 5 days"} — a report can squeeze shorts; wait until it is out.`);
  if (today >= 1.5) return A("alert", `Up ${signed(today)} today — bouncing; wait for the bounce to fail.`);
  if (num(c.rsi14) && c.rsi14 < 25) return A("alert", `RSI ${Math.round(c.rsi14)} — washed out; a relief bounce is likely.`);
  const fh = fromHighOf(c);
  if (fh != null && fh <= -50) return A("alert", `Already ${Math.abs(fh).toFixed(0)}% below its 52-week high — most of the drop has happened.`);
  if (num(c.week5ChangePct) && c.week5ChangePct <= -20) return A("alert", `Down ${signed(c.week5ChangePct)} in 5 days — the drop already happened; wait for a bounce to fail.`);
  if (num(c.marketCap) && c.marketCap < SMALL_CAP) return A("alert", "Market cap under $500M — squeeze and borrow risk.");
  if (isIlliquid(c)) return A("alert", "Thinly traded (under $5 or under $20M a day) — fills and stops are unreliable.");
  return A("act", "Downtrend is confirmed and the score is 30 or lower — the short setup is in play.");
}

/** Overlay tags shown beside the label (§3.4). */
function tagsOf(c: CompanyDoc, coverage: number, soon: boolean): Tag[] {
  const t: Tag[] = [];
  const fh = fromHighOf(c);
  if (fh != null && fh <= -50) t.push({ text: "Rebound in downtrend", warn: true });
  else if (fh != null && fh >= -5) t.push({ text: "Near 52W high", warn: false });
  if (num(c.pctChange) && c.pctChange <= -5) t.push({ text: "Sharp drop today", warn: true });
  if (coverage < MIN_PICK_COVERAGE) t.push({ text: "Limited data", warn: true });
  if (soon) t.push({ text: "Earnings soon", warn: true });
  return t;
}

/** Signal families in the confluence check (momentum, RS, fundamentals, catalyst, 13F flow). */
export const SIGNAL_FAMILIES = 5;

/** "N of 5 signal families aligned" — always out of five, naming any without data. */
export function confluenceMetric(aligned: number, available: number): string {
  if (available < 3) return "Too few signal families to compare";
  const missing = SIGNAL_FAMILIES - available;
  return `${aligned} of ${SIGNAL_FAMILIES} signal families aligned${missing > 0 ? ` (${missing} unavailable)` : ""}`;
}

/** Score one company. Returns null when fewer than two components have data. */
export function scoreCompany(c: CompanyDoc, a?: AnalystConsensusDoc, now = Date.now()): Signal | null {
  if (!num(c.price)) return null;
  const parts: Record<Exclude<CompKey, "conf">, Part> = {
    m: momentum(c), rs: relStrength(c), f: fundamentals(c), c: catalyst(c, a, now),
  };
  const fam = [parts.m.v, parts.rs.v, parts.f.v, parts.c.v, instFlow(c)].filter((x): x is number => x != null);
  const aligned = fam.filter(v => v >= 60).length;
  const confV = fam.length >= 3 ? Math.round((aligned / fam.length) * 100) : null;
  const confMetric = confluenceMetric(aligned, fam.length);

  const value: Record<CompKey, number | null> = { m: parts.m.v, rs: parts.rs.v, f: parts.f.v, c: parts.c.v, conf: confV };
  const metric: Record<CompKey, string> = { m: parts.m.metric, rs: parts.rs.metric, f: parts.f.metric, c: parts.c.metric, conf: confMetric };

  let wsum = 0, den = 0, tot = 0, have = 0;
  for (const k of KEYS) {
    tot += WEIGHTS[k];
    const v = value[k];
    if (v != null) { wsum += WEIGHTS[k] * v; den += WEIGHTS[k]; have++; }
  }
  if (have < 2 || den === 0) return null;
  const score = Math.round(wsum / den);
  const coverage = Math.round((den / tot) * 100);

  const comps: Comp[] = KEYS.map(k => ({
    key: k, label: LABEL[k], weight: WEIGHTS[k], value: value[k], status: compStatus(value[k]), metric: metric[k],
  }));
  const avail = comps.filter(x => x.value != null).sort((a2, b2) => (b2.value as number) - (a2.value as number));
  const trend = trendOf(c);
  const label = labelOf(c, trend);
  const risk = riskOf(c);
  const weak = trend === "Weakening";
  const soon = earningsSoon(c, now);

  const why = (weak ? [...avail].reverse() : avail).slice(0, 3).map(x => {
    // Weakest first for a weakening trend, but each line still says what its
    // own score says (Momentum 65 is never "Momentum fading").
    const good = (x.value as number) >= 60;
    const t = good ? TXT[x.key].up : TXT[x.key].dn;
    return { title: t[0], body: t[1], good };
  });
  const sup = comps.filter(x => x.value != null && x.value >= 65).map(x => TXT[x.key].up[0]);
  const opp = comps.filter(x => x.value != null && x.value < 60).map(x => TXT[x.key].dn[0]);
  comps.filter(x => x.value == null).forEach(x => opp.push(`${x.label} data unavailable`));
  if (risk === "High") opp.unshift("High volatility");
  else if (risk === "Elevated") opp.unshift("Elevated volatility");
  if (!opp.length) opp.push("Setup not yet confirmed on a longer horizon");
  if (!sup.length) sup.push("No component above the supportive threshold");

  const weakest = avail[avail.length - 1];
  const keyRisk =
    coverage < 70 ? `Several inputs are unavailable (${coverage}% data coverage), so the score rests on partial evidence.`
      : risk === "High" || risk === "Elevated"
        ? `${risk} volatility${num(c.realizedVol30) ? ` (30-day realized ${Math.round(c.realizedVol30)}%)` : ""} could undermine the setup if price momentum weakens.`
        : weakest && (weakest.value as number) < 55 ? `${weakest.label} is the weakest input (${weakest.value}/100); the setup leans on the other signals.`
          : "A reversal in momentum would weaken the case.";

  return {
    c, score, coverage, comps, trend, label,
    action: actionOf(c, score, trend, coverage, now),
    bear: bearActionOf(c, score, trend, coverage, now),
    risk, tags: tagsOf(c, coverage, soon),
    above50: above50Of(c), above200: above200Of(c),
    fromHigh: fromHighOf(c), fromLow: fromLowOf(c),
    earningsSoon: soon, illiquid: isIlliquid(c),
    why, sup: sup.slice(0, 4), opp: opp.slice(0, 4), keyRisk,
  };
}

/** One line of the bearish "why it's on the short list" (§6). */
export function bearWhy(s: Signal): { title: string; body: string } {
  const c = s.c;
  const w5 = num(c.week5ChangePct) ? c.week5ChangePct : null;
  const today = num(c.pctChange) ? c.pctChange : null;
  switch (s.label) {
    case "Oversold":
      return { title: "Oversold", body: `${w5 != null && w5 <= -20 ? `Already down ${signed(w5)} in 5 days` : `RSI ${Math.round(c.rsi14 ?? 0)}`} — a bounce is likely; wait for it to fail before shorting.` };
    case "Breakdown":
      return { title: "Breakdown", body: `Within 3% of its 52-week low, ${today != null ? `${signed(today)} today` : "down today"} on ${(c.rvol ?? 0).toFixed(1)}× normal volume.` };
    case "Bouncing":
      return { title: "Bouncing", body: `${today != null ? `Up ${signed(today)} today` : "Up today"} inside a downtrend — wait for the bounce to fail.` };
    case "Rolling over":
      return { title: "Rolling over", body: `A fresh turn down: still above its 50-day average but ${w5 != null ? `${signed(w5)} in 5 days` : "falling"}.` };
    default:
      return {
        title: "Downtrend",
        body: s.above50 === false
          ? "Price action is deteriorating: price sits below its 50-day average with a falling 5-day move."
          : `Price action is deteriorating: ${w5 != null ? `${signed(w5)} in 5 days` : "a falling 5-day move"}.`,
      };
  }
}

export interface Plan {
  entry: string;
  stop: string;
  stopPct: string;
  /** Hover text on the stop: where it sits. */
  stopWhy: string;
  horizon: string;
  size: "Small" | "Reduced" | "Standard";
  fn: string;
}

const f2 = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = (v: number) => {
  const r = Math.round(v * 10) / 10;
  const s = Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${s.replace("-", "")}%`;
};

/**
 * Rule-based plan levels (§3.6) — arithmetic on the live price, not a forecast.
 * Long: entry price × 0.98…1.01, stop just below the 50-DMA when it is below
 * price and inside the cap, else at the cap (10% for Elevated/High risk, else 7%).
 * Short: the mirror.
 */
export function planOf(c: CompanyDoc, risk: Risk | null, side: Side = "bull"): Plan {
  const price = c.price;
  const n = risk ? RISK_N[risk] : 2;
  const cap = n >= 3 ? 0.1 : 0.07;
  const size: Plan["size"] = n >= 4 ? "Small" : n >= 3 ? "Reduced" : "Standard";
  const ok = num(price) && price > 0;
  const sma = num(c.sma50) && c.sma50 > 0 ? c.sma50 : null;
  const capTxt = `${Math.round(cap * 100)}% volatility cap`;
  if (side === "bull") {
    const useSma = ok && sma != null && sma < price && (price - sma) / price < cap;
    const stop = ok ? (useSma ? (sma as number) * 0.99 : price * (1 - cap)) : null;
    const stopWhy = useSma ? "just below the 50-day average" : `at the ${capTxt}`;
    return {
      entry: ok ? `$${f2(price * 0.98)} – $${f2(price * 1.01)}` : "—",
      stop: stop != null ? `$${f2(stop)}` : "—",
      stopPct: stop != null && ok ? pct1((stop / price - 1) * 100) : "",
      stopWhy,
      horizon: "Swing trade · 2–6 weeks",
      size,
      fn: `Invalidation sits ${stopWhy} · Exit or reassess if score drops below 60 · Rule-based levels on the live price, not personalised advice`,
    };
  }
  const useSma = ok && sma != null && sma > price && (sma - price) / price < cap;
  const stop = ok ? (useSma ? (sma as number) * 1.01 : price * (1 + cap)) : null;
  const stopWhy = useSma ? "just above the 50-day average" : `at the ${capTxt}`;
  return {
    entry: ok ? `$${f2(price * 0.99)} – $${f2(price * 1.02)}` : "—",
    stop: stop != null ? `$${f2(stop)}` : "—",
    stopPct: stop != null && ok ? pct1((stop / price - 1) * 100) : "",
    stopWhy,
    horizon: "Swing short · 2–6 weeks",
    size,
    fn: `Cover stop sits ${stopWhy} · Cover or reassess if the score rises above 45 · Check borrow availability before trading`,
  };
}

// ───────────────────────── Eligibility and hygiene (§3.7) ─────────────────────────

const CRYPTO = /\b(bitcoin|ethereum|ether|crypto|solana|xrp|litecoin|dogecoin|digital assets?)\b/i;

/** Common equity only: no ETFs/ETNs/funds/preferreds/warrants/units, leveraged or inverse products, crypto trusts. */
export function isPickable(c: CompanyDoc): boolean {
  if (!isCommonEquity(c)) return false;
  const name = c.name ?? "";
  if (isLeveragedProduct(name)) return false;
  if (/\b(Fund|ETF|ETN)\b/i.test(name)) return false;
  if (CRYPTO.test(name) && /\btrust\b/i.test(name)) return false;
  return true;
}

/** Not OTC/pink; a price; quote and technicals (when stamped) within 5 days. */
export function dataFresh(c: CompanyDoc, now: number): boolean {
  if (/\b(OTC|PNK|PINK)\b/i.test(c.exchange ?? "")) return false;
  if (!num(c.price) || c.price <= 0) return false;
  for (const iso of [c.technicalsUpdatedAt, c.quoteUpdatedAt]) {
    if (!iso) continue;
    const t = Date.parse(iso);
    if (Number.isFinite(t) && now - t > 5 * DAY) return false;
  }
  return true;
}

/** One line per issuer: share classes (GOOG/GOOGL, BRK.A/BRK.B) collapse to one key. */
export function issuerKey(c: { ticker: string; name?: string | null }): string {
  const n = (c.name ?? "")
    .toLowerCase()
    .replace(/\b(class|series)\s+[a-z0-9]\b/g, " ")
    .replace(/\b(common stock|ordinary shares?|capital stock|american depositary shares?|ads|adr|shares?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (n) return n;
  return c.ticker.toUpperCase().replace(/[.\-/][A-Z]$/, "");
}

/** Keeps the first (best-ranked) row per issuer. */
export function dedupeByIssuer<T>(rows: T[], co: (r: T) => CompanyDoc): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = issuerKey(co(r));
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Each list shows at most this many cards (Screener); the Dashboard shows 2. */
export const MAX_PICKS = 10;

/** Bullish swing list (§3.7): rising trend, data ≥ 70%, score high → low, one per issuer. */
export function pickTop(sigs: Signal[], n = MAX_PICKS, now = Date.now()): Signal[] {
  return dedupeByIssuer(
    sigs
      .filter(s => isRising(s.trend) && s.coverage >= MIN_PICK_COVERAGE && isPickable(s.c) && dataFresh(s.c, now))
      .sort((a, b) => b.score - a.score),
    s => s.c,
  ).slice(0, n);
}

/** Bearish swing list (§3.5): Weakening, liquid, fresh, Setup active or Building; Setup active first, then lowest score. */
export function pickBear(sigs: Signal[], n = MAX_PICKS, now = Date.now()): Signal[] {
  return dedupeByIssuer(
    sigs
      .filter(s => s.trend === "Weakening" && !s.illiquid && isPickable(s.c) && dataFresh(s.c, now)
        && (s.bear.key === "act" || s.bear.key === "alert"))
      .sort((a, b) => (a.bear.key === "act" ? 0 : 1) - (b.bear.key === "act" ? 0 : 1) || a.score - b.score),
    s => s.c,
  ).slice(0, n);
}

// ────────────────────────────── Screens ──────────────────────────────

export interface ScreenRow {
  ticker: string;
  name: string;
  sector: string | null;
  price: number | null;
  pct: number | null;
  /** Why this stock is on the screen — real figures only. */
  why: string;
}

export interface ScreenCtx {
  companies: CompanyDoc[];
  sigs: Signal[];
  analyst: Map<string, AnalystConsensusDoc>;
  ipos: IpoEventDoc[];
  now: number;
  /** The app-wide live quotes (tickers outside `companies`, e.g. new IPOs, too). */
  quotes?: Map<string, { price: number | null; pctChange: number | null }>;
}

export interface Screen {
  id: string;
  label: string;
  desc: string;
  /** Data source line, shown on the list header. */
  src: string;
  /** Set when there is no universe-wide feed: the list shows this instead of rows. */
  pending?: string;
  /** True when membership is decided by the Emergence components. */
  model?: boolean;
  rows: (ctx: ScreenCtx) => ScreenRow[];
}

/** A positive finite number (stored docs sometimes hold numbers as strings), else null. */
const posNum = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
};
const rowOf = (c: CompanyDoc, why: string): ScreenRow => ({
  ticker: c.ticker, name: c.name ?? c.ticker, sector: c.sector, price: c.price, pct: c.pctChange, why,
});
const money = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compact = (v: number) =>
  v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`;
const priced = (cs: CompanyDoc[]) => cs.filter(c => c.price != null);
const sig = (ctx: ScreenCtx) => new Map(ctx.sigs.map(s => [s.c.ticker, s]));
const compVal = (s: Signal | undefined, k: CompKey) => s?.comps.find(x => x.key === k)?.value ?? null;

/** Prior-quarter 13F shares below this share of today's make a % change meaningless (> +900%). */
const INST_MIN_BASE_SHARE = 0.1;

export const SCREENS: Screen[] = [
  {
    id: "sp", label: "Top S&P 500", desc: "By market cap",
    src: "FMP · company profile + quote",
    rows: ({ companies }) =>
      priced(companies)
        .filter(c => INDEX_MEMBERS.SP500.has(c.ticker) && c.marketCap != null)
        .sort((a, b) => (b.marketCap as number) - (a.marketCap as number))
        .map((c, i) => rowOf(c, `#${i + 1} S&P 500 constituent by market cap (${compact(c.marketCap as number)}).`)),
  },
  {
    id: "h52", label: "New 52W High", desc: "Momentum-led stocks pressing their highs",
    src: "Polygon · daily aggregates",
    rows: ({ companies }) =>
      priced(companies)
        .filter(c => c.pctFromHigh52 != null && c.pctFromHigh52 >= -1.5)
        .sort((a, b) => (b.pctFromHigh52 as number) - (a.pctFromHigh52 as number))
        .map(c => rowOf(c, (c.pctFromHigh52 as number) >= -0.05
          ? `Trading at its 52-week high${c.high52 != null ? ` of ${money(c.high52)}` : ""}.`
          : `${Math.abs(c.pctFromHigh52 as number).toFixed(1)}% below its 52-week high${c.high52 != null ? ` of ${money(c.high52)}` : ""}.`)),
  },
  {
    id: "l52", label: "New 52W Low", desc: "Weakening momentum and relative strength",
    src: "Polygon · daily aggregates",
    rows: ({ companies }) =>
      priced(companies)
        .filter(c => c.pctFromLow52 != null && c.pctFromLow52 <= 5)
        .sort((a, b) => (a.pctFromLow52 as number) - (b.pctFromLow52 as number))
        .map(c => rowOf(c, (c.pctFromLow52 as number) <= 0.05
          ? `Trading at its 52-week low${c.low52 != null ? ` of ${money(c.low52)}` : ""}.`
          : `Only ${(c.pctFromLow52 as number).toFixed(1)}% above its 52-week low${c.low52 != null ? ` of ${money(c.low52)}` : ""}.`)),
  },
  {
    id: "vol", label: "Highest Volatility", desc: "Elevated 30-day realized volatility",
    src: "Polygon · daily aggregates (realized, not implied)",
    rows: ({ companies }) =>
      priced(companies)
        .filter(c => c.realizedVol30 != null && c.realizedVol30 >= 40)
        .sort((a, b) => (b.realizedVol30 as number) - (a.realizedVol30 as number))
        .map(c => rowOf(c, `30-day realized volatility ${Math.round(c.realizedVol30 as number)}% — large recent price swings.`)),
  },
  {
    id: "rsl", label: "RS Leaders", desc: "Strongest relative strength vs. the market",
    src: "Polygon · rs-rating job",
    rows: ({ companies }) =>
      priced(companies)
        .filter(c => c.rsRating != null && c.rsRating >= 85)
        .sort((a, b) => (b.rsRating as number) - (a.rsRating as number))
        .map(c => rowOf(c, `RS rating ${Math.round(c.rsRating as number)}/99 — outperforming most of the market.`)),
  },
  {
    id: "brk", label: "Breaking Out", desc: "Momentum surge on heavy volume near highs",
    src: "Polygon · daily aggregates",
    rows: ({ companies }) =>
      priced(companies)
        .filter(c => (c.pctChange ?? 0) >= 2 && (c.rvol ?? 0) >= 1.5 && c.pctFromHigh52 != null && c.pctFromHigh52 >= -5)
        .sort((a, b) => (b.pctChange as number) - (a.pctChange as number))
        .map(c => rowOf(c, `Up ${(c.pctChange as number).toFixed(1)}% on ${(c.rvol as number).toFixed(1)}× normal volume, ${Math.abs(c.pctFromHigh52 as number).toFixed(1)}% from its 52-week high.`)),
  },
  {
    id: "tight", label: "Tight Setups", desc: "Steady trend, consolidating near highs",
    src: "Polygon · daily aggregates",
    rows: ({ companies }) =>
      priced(companies)
        .filter(c => c.aboveSma50 === true && c.aboveSma200 === true
          && c.pctFromHigh52 != null && c.pctFromHigh52 >= -8
          && c.week5ChangePct != null && Math.abs(c.week5ChangePct) <= 3)
        .sort((a, b) => Math.abs(a.week5ChangePct as number) - Math.abs(b.week5ChangePct as number))
        .map(c => rowOf(c, `Above its 50 & 200-day averages, ${Math.abs(c.pctFromHigh52 as number).toFixed(1)}% from its high, 5-day move only ${signed(c.week5ChangePct as number)}.`)),
  },
  {
    id: "eps", label: "Earnings Acceleration", desc: "Strongest year-over-year earnings growth",
    src: "FMP · fundamentals-growth job",
    rows: ({ companies }) =>
      priced(companies)
        .filter(c => c.epsGrowthYoY != null && c.epsGrowthYoY >= 0.25)
        .sort((a, b) => (b.epsGrowthYoY as number) - (a.epsGrowthYoY as number))
        .map(c => rowOf(c, `EPS ${signed((c.epsGrowthYoY as number) * 100, 0)} YoY${c.revenueGrowthYoY != null ? `, revenue ${signed(c.revenueGrowthYoY * 100, 0)} YoY` : ""}.`)),
  },
  {
    id: "surp", label: "Fundamentals + Catalyst", desc: "Supportive fundamentals plus a catalyst",
    src: "Emergence components", model: true,
    rows: ctx => {
      const sg = sig(ctx);
      return priced(ctx.companies)
        .filter(c => (compVal(sg.get(c.ticker), "f") ?? 0) >= 65 && (compVal(sg.get(c.ticker), "c") ?? 0) >= 60)
        .sort((a, b) => {
          const sa = sg.get(a.ticker), sb = sg.get(b.ticker);
          return ((compVal(sb, "f") ?? 0) + (compVal(sb, "c") ?? 0)) - ((compVal(sa, "f") ?? 0) + (compVal(sa, "c") ?? 0));
        })
        .map(c => {
          const s = sg.get(c.ticker);
          return rowOf(c, `Fundamentals ${compVal(s, "f")}/100 with catalyst ${compVal(s, "c")}/100 — ${s?.comps.find(x => x.key === "f")?.metric ?? ""}.`);
        });
    },
  },
  {
    id: "upg", label: "Analyst Upgrades", desc: "Rating upgrades in the last 30 days",
    src: "FMP · upgrades-downgrades",
    rows: ctx =>
      priced(ctx.companies)
        .map(c => ({ c, g: recentGrades(ctx.analyst.get(c.ticker), 30, ctx.now) }))
        .filter(x => x.g.ups.length > x.g.downs.length)
        .sort((a, b) => (b.g.ups.length - b.g.downs.length) - (a.g.ups.length - a.g.downs.length)
          || Date.parse(b.g.ups[0].date) - Date.parse(a.g.ups[0].date))
        .map(({ c, g }) => {
          const u = [...g.ups].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
          return rowOf(c, `${u.firm ?? "An analyst"} upgraded${u.newGrade ? ` to ${u.newGrade}` : ""} on ${u.date}${g.ups.length > 1 ? ` · ${g.ups.length} upgrades in 30 days` : ""}.`);
        }),
  },
  {
    id: "inst", label: "Institutional Accumulation", desc: "13F holders and shares rising",
    src: "FMP · 13F institutional ownership",
    rows: ({ companies }) =>
      priced(companies)
        .filter(c => (c.inst13FHoldersChange ?? 0) > 0 && (c.inst13FSharesChange ?? 0) > 0)
        .map(c => {
          const shares = Number(c.inst13FShares ?? 0);
          const change = Number(c.inst13FSharesChange);
          const base = shares - change;
          // A % needs a prior quarter that can carry one: a near-empty base
          // (AEHL: 1 share reported, so +17,610,200%) or a pre-split count
          // makes the ratio meaningless — show the share count instead.
          const pct = base > 0 && base >= shares * INST_MIN_BASE_SHARE ? (change / base) * 100 : null;
          return { c, change, pct };
        })
        .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || (b.c.inst13FHoldersChange as number) - (a.c.inst13FHoldersChange as number))
        .map(({ c, change, pct }) => rowOf(c, `${c.inst13FHoldersChange} more institutional holders and ${
          pct != null ? `${pct.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% more shares` : `${Math.round(change).toLocaleString("en-US")} more shares (almost none reported the prior quarter)`
        } vs. the prior quarter${c.instAsOf ? ` (${c.instAsOf})` : ""}.`)),
  },
  {
    id: "si", label: "High Short Interest", desc: "Lagging relative strength — contrarian",
    src: "Short interest feed (not connected)",
    pending: "Short interest is only available per stock on the Stock Intelligence page; there is no universe-wide short-interest feed to screen on yet.",
    rows: () => [],
  },
  {
    id: "ipo", label: "Recent IPOs", desc: "Listed in the last 24 months",
    src: "Polygon · IPO calendar",
    rows: ctx => {
      const byT = new Map(ctx.companies.map(c => [c.ticker, c]));
      const cutoff = ctx.now - 730 * DAY;
      return ctx.ipos
        .filter(e => e.symbol && e.status === "history" && Date.parse(e.date) >= cutoff && Date.parse(e.date) <= ctx.now)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(e => {
          const sym = e.symbol as string;
          const co = byT.get(sym);
          const q = ctx.quotes?.get(sym);
          // The live quote first (most new listings aren't in `companies`), then
          // the company doc; the IPO doc's once-a-day close only as a last resort.
          const price = posNum(q?.price) ?? posNum(co?.price) ?? posNum(e.currentPrice);
          const pct = q?.price != null ? (q.pctChange ?? null) : co?.price != null ? (co.pctChange ?? null) : null;
          const offer = posNum(e.offerPrice);
          const bits = [`Listed ${e.date}${offer != null ? ` at ${money(offer)}` : " · offer price unavailable"}`];
          if (offer != null && price != null) bits.push(`${signed((price / offer - 1) * 100, 0)} since IPO`);
          if (price == null) bits.push("no trades yet");
          return {
            ticker: sym, name: e.name, sector: e.sector ?? co?.sector ?? null,
            price, pct, why: `${bits.join(" · ")}.`,
          };
        });
    },
  },
];
