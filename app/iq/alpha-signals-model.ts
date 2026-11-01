/*
 * Alpha Signals — scoring model and the 13 stock screens.
 *
 * Everything here is a pure function of fields the backend already serves
 * (company docs, analyst consensus, IPO events). Nothing is simulated: a
 * component with no input is `null` and is left out of the score (the rest are
 * re-weighted), never scored as zero. The weights, bands and screen cut-offs
 * are our own design choices — not a back-tested model — and are all declared
 * in this file so they can be reviewed in one place.
 *
 * Not available as live feeds, so deliberately NOT modelled: score history
 * (no snapshots are stored), implied volatility and short interest.
 */

import type { AnalystConsensusDoc, CompanyDoc, IpoEventDoc } from "./types";
import { INDEX_MEMBERS } from "./index-constituents";

export type CompKey = "m" | "rs" | "f" | "c" | "conf";
export const KEYS: CompKey[] = ["m", "rs", "f", "c", "conf"];

export const LABEL: Record<CompKey, string> = {
  m: "Momentum",
  rs: "Relative Strength",
  f: "Fundamental Inflection",
  c: "Catalyst Potential",
  conf: "Signal Confluence",
};

/** Initial design weights (percent). Normalised over the components that have data. */
export const WEIGHTS: Record<CompKey, number> = { m: 25, rs: 25, f: 20, c: 15, conf: 15 };

/** What each component measures and where its inputs come from (score-info modal). */
export const COMP_INFO: Record<CompKey, { desc: string; src: string }> = {
  m: { desc: "Is the trend constructive? Price vs. its 50/200-day averages, RSI band, MACD and the last 5 sessions.", src: "Polygon daily bars · technical-indicators job" },
  rs: { desc: "Is it beating the market? Relative-strength rating ranked across the synced universe.", src: "Polygon daily bars · rs-rating job" },
  f: { desc: "Are fundamentals supportive? Year-over-year EPS and revenue growth.", src: "FMP financials · fundamentals-growth job" },
  c: { desc: "Is something there that could re-rate it? Analyst price target, ratings, recent upgrades and unusual volume.", src: "FMP analyst consensus · Polygon volume" },
  conf: { desc: "Do the signals agree? How many independent signal families (the four above plus 13F institutional flow) point the same way.", src: "Calculated" },
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

export type Trend = "Emerging" | "Strengthening" | "Stable" | "Weakening";
export type Risk = "Low" | "Moderate" | "Elevated" | "High";
export type ActionKey = "act" | "alert" | "watch" | "avoid";

export interface Action {
  key: ActionKey;
  /** Long label (modal heading). */
  label: string;
  /** Short pill label. */
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

export interface Signal {
  c: CompanyDoc;
  score: number;
  /** Share of the total weight that had data (0–100). */
  coverage: number;
  comps: Comp[];
  trend: Trend;
  action: Action;
  risk: Risk | null;
  why: Array<{ title: string; body: string; good: boolean }>;
  sup: string[];
  opp: string[];
  keyRisk: string;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const signed = (n: number, d = 1) => `${n > 0 ? "+" : ""}${n.toFixed(d)}%`;

function compStatus(v: number | null): Comp["status"] {
  return v == null ? "Unavailable" : v >= 80 ? "Strong" : v >= 65 ? "Solid" : v >= 50 ? "Fair" : "Weak";
}

/** Best between RSI 50 and 70, fading linearly outside the band. */
function rsiBand(rsi: number): number {
  return rsi >= 50 && rsi <= 70 ? 100 : Math.max(0, 100 - Math.min(Math.abs(rsi - 60) - 10, 50) * 2);
}

interface Part { v: number | null; metric: string }

function momentum(c: CompanyDoc): Part {
  const parts: number[] = [];
  const bits: string[] = [];
  const have = [c.aboveSma50, c.aboveSma200].filter((x): x is boolean => x != null);
  if (have.length) {
    parts.push((have.filter(Boolean).length / have.length) * 100);
    bits.push(c.aboveSma50 && c.aboveSma200 ? "above 50 & 200-DMA" : c.aboveSma50 ? "above 50-DMA only" : c.aboveSma200 ? "above 200-DMA only" : "below 50 & 200-DMA");
  }
  if (c.rsi14 != null) { parts.push(rsiBand(c.rsi14)); bits.push(`RSI ${Math.round(c.rsi14)}`); }
  if (c.macdHistogram != null) { parts.push(c.macdHistogram > 0 ? 80 : 25); bits.push(`MACD ${c.macdHistogram > 0 ? "positive" : "negative"}`); }
  if (c.week5ChangePct != null) { parts.push(clamp(50 + c.week5ChangePct * 6)); bits.push(`5D ${signed(c.week5ChangePct)}`); }
  const v = mean(parts);
  return { v: v == null ? null : Math.round(v), metric: bits.length ? bits.join(" · ") : "No technicals returned yet" };
}

function relStrength(c: CompanyDoc): Part {
  return c.rsRating == null
    ? { v: null, metric: "No RS rating yet" }
    : { v: Math.round(c.rsRating), metric: `RS rating ${Math.round(c.rsRating)}/99` };
}

function fundamentals(c: CompanyDoc): Part {
  const parts: number[] = [];
  const bits: string[] = [];
  if (c.epsGrowthYoY != null) { parts.push(clamp(50 + c.epsGrowthYoY * 100 * 0.8)); bits.push(`EPS ${signed(c.epsGrowthYoY * 100, 0)} YoY`); }
  if (c.revenueGrowthYoY != null) { parts.push(clamp(50 + c.revenueGrowthYoY * 100 * 1.5)); bits.push(`revenue ${signed(c.revenueGrowthYoY * 100, 0)} YoY`); }
  const v = mean(parts);
  return { v: v == null ? null : Math.round(v), metric: bits.length ? bits.join(" · ") : "No growth figures returned yet" };
}

const DAY = 86_400_000;

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
  if (a && c.price != null && c.price > 0 && a.priceTargetConsensus != null) {
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
  if (c.rvol != null) { parts.push(clamp((c.rvol / 2) * 100)); bits.push(`RVOL ${c.rvol.toFixed(1)}×`); }
  const v = mean(parts);
  return { v: v == null ? null : Math.round(v), metric: bits.length ? bits.join(" · ") : "No analyst or volume data yet" };
}

/** 13F flow family: holders / shares rising quarter over quarter. */
function instFlow(c: CompanyDoc): number | null {
  const h = c.inst13FHoldersChange;
  const s = c.inst13FSharesChange;
  if (h == null && s == null) return null;
  const up = (h ?? 0) > 0 || (s ?? 0) > 0;
  const down = (h ?? 0) < 0 || (s ?? 0) < 0;
  return up && !down ? 75 : down && !up ? 30 : 50;
}

/** Trend from price action alone (no score history is stored): 5-session move, its pace vs. the 1-month pace, and the 50-DMA. */
export function trendOf(c: CompanyDoc): Trend {
  const w5 = c.week5ChangePct;
  if (w5 == null) return "Stable";
  const m1 = c.monthChangePct;
  const accelerating = m1 == null || w5 * 4 > m1;
  if (w5 >= 4 && accelerating && c.aboveSma50 !== false) return "Emerging";
  if (w5 >= 1.5 && c.aboveSma50 !== false) return "Strengthening";
  if (w5 <= -3 || (w5 < 0 && c.aboveSma50 === false)) return "Weakening";
  return "Stable";
}

export function riskOf(c: CompanyDoc): Risk | null {
  const vol = c.realizedVol30;
  if (vol != null) return vol < 25 ? "Low" : vol < 40 ? "Moderate" : vol < 60 ? "Elevated" : "High";
  const b = c.beta;
  if (b != null) return b < 0.9 ? "Low" : b < 1.3 ? "Moderate" : b < 1.8 ? "Elevated" : "High";
  return null;
}
export const RISK_N: Record<Risk, number> = { Low: 1, Moderate: 2, Elevated: 3, High: 4 };

export function actionOf(score: number, trend: Trend, coverage: number): Action {
  if (trend === "Weakening")
    return { key: "avoid", label: "Avoid for now", short: "Avoid", why: "Price action is deteriorating — wait for it to stabilise." };
  if (score >= 75 && (trend === "Emerging" || trend === "Strengthening") && coverage >= 70)
    return { key: "act", label: "Setup active", short: "Setup active", why: "Score is high, rising and backed by complete data — the setup is in play." };
  if (trend === "Emerging" || trend === "Strengthening")
    return { key: "alert", label: "Building", short: "Building", why: "Improving but not yet confirmed — watch for the score to cross 75." };
  return { key: "watch", label: "Watch", short: "Watch", why: "No clear edge yet — keep it on the radar." };
}

/** Score one company. Returns null when fewer than two components have data. */
export function scoreCompany(c: CompanyDoc, a?: AnalystConsensusDoc, now = Date.now()): Signal | null {
  if (c.price == null) return null;
  const parts: Record<Exclude<CompKey, "conf">, Part> = {
    m: momentum(c), rs: relStrength(c), f: fundamentals(c), c: catalyst(c, a, now),
  };
  const fam = [parts.m.v, parts.rs.v, parts.f.v, parts.c.v, instFlow(c)].filter((x): x is number => x != null);
  const aligned = fam.filter(v => v >= 60).length;
  const confV = fam.length >= 3 ? Math.round((aligned / fam.length) * 100) : null;
  const confMetric = fam.length >= 3 ? `${aligned} of ${fam.length} signal families aligned` : "Too few signal families to compare";

  const value: Record<CompKey, number | null> = { m: parts.m.v, rs: parts.rs.v, f: parts.f.v, c: parts.c.v, conf: confV };
  const metric: Record<CompKey, string> = { m: parts.m.metric, rs: parts.rs.metric, f: parts.f.metric, c: parts.c.metric, conf: confMetric };

  let num = 0, den = 0, tot = 0, have = 0;
  for (const k of KEYS) {
    tot += WEIGHTS[k];
    const v = value[k];
    if (v != null) { num += WEIGHTS[k] * v; den += WEIGHTS[k]; have++; }
  }
  if (have < 2 || den === 0) return null;
  const score = Math.round(num / den);
  const coverage = Math.round((den / tot) * 100);

  const comps: Comp[] = KEYS.map(k => ({
    key: k, label: LABEL[k], weight: WEIGHTS[k], value: value[k], status: compStatus(value[k]), metric: metric[k],
  }));
  const avail = comps.filter(x => x.value != null).sort((a2, b2) => (b2.value as number) - (a2.value as number));
  const trend = trendOf(c);
  const risk = riskOf(c);
  const weak = trend === "Weakening";

  const why = (weak ? [...avail].reverse() : avail).slice(0, 3).map(x => {
    const good = !weak && (x.value as number) >= 60;
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
      ? `${risk === "High" ? "High" : "Elevated"} volatility${c.realizedVol30 != null ? ` (30-day realized ${Math.round(c.realizedVol30)}%)` : ""} could undermine the setup if price momentum weakens.`
    : weakest && (weakest.value as number) < 55 ? `${weakest.label} is the weakest input (${weakest.value}/100); the setup leans on the other signals.`
    : "A reversal in momentum would weaken the case.";

  return {
    c, score, coverage, comps, trend, action: actionOf(score, trend, coverage), risk,
    why, sup: sup.slice(0, 4), opp: opp.slice(0, 4), keyRisk,
  };
}

/** Rule-based levels for the action plan — arithmetic on the live price, not a forecast. */
export function planOf(price: number | null, risk: Risk | null) {
  const n = risk ? RISK_N[risk] : 2;
  const stop = n >= 3 ? 0.1 : 0.07;
  const f = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ok = price != null && Number.isFinite(price) && price > 0;
  return {
    entry: ok ? `$${f(price * 0.98)} – $${f(price * 1.01)}` : "—",
    stop: ok ? `$${f(price * (1 - stop))}` : "—",
    stopPct: `−${Math.round(stop * 100)}%`,
    horizon: "Swing trade · 2–6 weeks",
    size: n >= 4 ? "Small" : n >= 3 ? "Reduced" : "Standard",
    review: "Exit or reassess if score drops below 60",
  };
}

/** Minimum data coverage (%) for a stock to be ranked as a top pick — the same bar "Setup active" uses. */
export const MIN_PICK_COVERAGE = 70;

/** Top picks ("stocks heating up"): the highest scores among stocks whose price action is rising.
 *  Never padded with flat or falling names — on a weak tape the list is simply shorter. Only stocks
 *  with enough data coverage are ranked, so a name scored on two inputs can't lead the list. */
export function pickTop(sigs: Signal[], n = 10): Signal[] {
  return sigs
    .filter(s => s.coverage >= MIN_PICK_COVERAGE && (s.trend === "Emerging" || s.trend === "Strengthening"))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
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

const rowOf = (c: CompanyDoc, why: string): ScreenRow => ({
  ticker: c.ticker, name: c.name ?? c.ticker, sector: c.sector, price: c.price, pct: c.pctChange, why,
});
const money = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compact = (v: number) =>
  v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`;
const priced = (cs: CompanyDoc[]) => cs.filter(c => c.price != null);
const sig = (ctx: ScreenCtx) => new Map(ctx.sigs.map(s => [s.c.ticker, s]));
const compVal = (s: Signal | undefined, k: CompKey) => s?.comps.find(x => x.key === k)?.value ?? null;

export const SCREENS: Screen[] = [
  {
    id: "sp", label: "Top S&P 500", desc: "Largest constituents by market cap",
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
          const base = c.inst13FShares != null ? c.inst13FShares - (c.inst13FSharesChange as number) : 0;
          return { c, pct: base > 0 ? ((c.inst13FSharesChange as number) / base) * 100 : null };
        })
        .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || (b.c.inst13FHoldersChange as number) - (a.c.inst13FHoldersChange as number))
        .map(({ c, pct }) => rowOf(c, `${c.inst13FHoldersChange} more institutional holders${pct != null ? ` and ${pct.toFixed(1)}% more shares` : ""} vs. the prior quarter${c.instAsOf ? ` (${c.instAsOf})` : ""}.`)),
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
          const co = byT.get(e.symbol as string);
          const bits = [`Listed ${e.date}${e.offerPrice != null ? ` at ${money(e.offerPrice)}` : ""}`];
          if (e.returnSinceIpoPct != null) bits.push(`${signed(e.returnSinceIpoPct, 0)} since IPO`);
          return {
            ticker: e.symbol as string, name: e.name, sector: e.sector ?? co?.sector ?? null,
            price: co?.price ?? e.currentPrice, pct: co?.pctChange ?? null, why: `${bits.join(" · ")}.`,
          };
        });
    },
  },
];
