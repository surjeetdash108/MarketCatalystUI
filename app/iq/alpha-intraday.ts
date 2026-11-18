/*
 * Alpha Signals — intraday engine (exit by the close).
 *
 * Pure functions over regular-session 5-minute bars (/live/bars?interval=5m)
 * plus the company doc and the S&P 500's move today (SPY). Rules follow
 * "Alpha Signals — Swing & Intraday: Rules, Logic and Handoff Spec" §4.
 *
 * The score is the app's one 0–100 scale (high = strong, low = weak). Bearish
 * setups are scored internally on downside strength and SHOWN as 100 − score,
 * so a Setup active short reads 30 or lower everywhere.
 *
 * Thresholds are design choices, not back-tested. Levels are arithmetic on
 * live prices, not a forecast.
 */

import type { CompanyDoc } from "./types";
import { etParts } from "./market-status";
import { compStatus, dedupeByIssuer, isPickable, dataFresh, MAX_PICKS, type ActionKey, type Trend } from "./alpha-signals-model";

export interface Bar {
  /** Bar start, epoch seconds or milliseconds. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** §4.2 thresholds. */
export const T = {
  gapMin: 0.02,
  gapMax: 0.08,
  rvolBreak: 1.5,
  rvolLow: 1.0,
  rvolClimax: 6,
  confirmMin: 0.001,
  confirmMax: 0.01,
  vwapZone: 0.005,
  extended: 0.03,
  stopMin: 0.003,
  stopMax: 0.015,
  stopBuffer: 0.002,
  priceMin: 5,
  priceMax: 1000,
  tradedValueMin: 20_000_000,
  orMinutes: 15,
  primeEnd: 120,
  middayEnd: 240,
  lateStart: 375,
  sessionMinutes: 390,
  actBar: 70,
  actBarMidday: 75,
  buildBar: 55,
  regime: 0.015,
  chopCrosses: 4,
  chopAfter: 60,
  sparseFill: 0.8,
  sparseCoverage: 60,
  minCoverage: 70,
  /** Spec: a bar is stale 12 minutes past its own 5. */
  staleGraceMin: 12,
  /**
   * The backend re-reads a ticker's intraday bars at most every 15 minutes
   * during the session (ondemand.service INTRADAY_SESSION_TTL_MS), so a healthy
   * feed's last bar is routinely up to ~15 minutes old. That window is allowed
   * on top of the spec's 12 so the cap flags a stalled feed, not the cache.
   */
  backendRefreshMin: 15,
} as const;

const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
const BAR_MIN = 5;
const ms = (t: number) => (t < 1e11 ? t * 1000 : t);
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export interface SessionMetrics {
  /** ET date of the session the metrics describe (YYYY-MM-DD). */
  session: string;
  bars: number;
  open: number;
  orHigh: number;
  orLow: number;
  dayHigh: number;
  dayLow: number;
  price: number;
  vwap: number;
  priorClose: number | null;
  priorHigh: number | null;
  priorLow: number | null;
  /** Fractions (0.02 = 2%). */
  gap: number | null;
  chg: number | null;
  /** Clock minutes since 09:30 at the end of the last bar. */
  minutes: number;
  rvol: number | null;
  /** Bars present ÷ bars expected since the open. */
  fill: number;
  /** Start of the last bar, epoch ms. */
  lastBarAt: number;
  /** VWAP crossings after the first 30 minutes. */
  crosses: number;
  /** Mean (high − low) / close of today's bars. */
  avgRange: number;
  /** Today's closes, oldest first (card sparkline). */
  closes: number[];
}

/**
 * Session metrics from 5-minute bars (§4.1). Only regular-session bars
 * (09:30–16:00 ET) count. Needs ≥ 3 bars today, otherwise null.
 */
export function metricsFromBars(
  raw: Bar[] | null | undefined,
  opts: { dailyRvol?: number | null; prevClose?: number | null } = {},
): SessionMetrics | null {
  if (!raw || raw.length === 0) return null;
  const rows = raw
    .filter(b => num(b.t) && num(b.o) && num(b.h) && num(b.l) && num(b.c))
    .map(b => {
      const t = ms(b.t);
      const p = etParts(new Date(t));
      return { ...b, t, v: num(b.v) ? b.v : 0, day: p.isoDate, min: p.minutes };
    })
    .filter(b => b.min >= OPEN_MIN && b.min < CLOSE_MIN)
    .sort((a, b) => a.t - b.t);
  if (rows.length === 0) return null;

  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byDay.get(r.day);
    if (list) list.push(r);
    else byDay.set(r.day, [r]);
  }
  const days = [...byDay.keys()].sort();
  const session = days[days.length - 1];
  const today = byDay.get(session)!;
  if (today.length < 3) return null;
  const prior = days.length > 1 ? byDay.get(days[days.length - 2])! : null;

  const open = today[0].o;
  const orBars = today.filter(b => b.min < OPEN_MIN + T.orMinutes);
  const orSet = orBars.length ? orBars : today.slice(0, 3);
  const orHigh = Math.max(...orSet.map(b => b.h));
  const orLow = Math.min(...orSet.map(b => b.l));
  const dayHigh = Math.max(...today.map(b => b.h));
  const dayLow = Math.min(...today.map(b => b.l));
  const last = today[today.length - 1];
  const price = last.c;

  // VWAP, and its crossings after 10:00 (running VWAP bar by bar).
  let pv = 0, vol = 0, crosses = 0, prevSide = 0;
  for (const b of today) {
    pv += ((b.h + b.l + b.c) / 3) * b.v;
    vol += b.v;
    const running = vol > 0 ? pv / vol : b.c;
    const side = b.c > running ? 1 : b.c < running ? -1 : 0;
    if (b.min >= OPEN_MIN + 30 && side !== 0 && prevSide !== 0 && side !== prevSide) crosses++;
    if (side !== 0) prevSide = side;
  }
  const vwap = vol > 0 ? pv / vol : price;

  const priorClose = prior ? prior[prior.length - 1].c : num(opts.prevClose) && opts.prevClose > 0 ? opts.prevClose : null;
  const priorHigh = prior ? Math.max(...prior.map(b => b.h)) : null;
  const priorLow = prior ? Math.min(...prior.map(b => b.l)) : null;
  const gap = priorClose ? open / priorClose - 1 : null;
  const chg = priorClose ? price / priorClose - 1 : null;
  const minutes = last.min + BAR_MIN - OPEN_MIN;

  // RVOL: today's cumulative volume vs the median of earlier sessions'
  // cumulative volume over the same number of bars.
  const n = today.length;
  const cum = today.reduce((a, b) => a + b.v, 0);
  const earlier = days.slice(0, -1)
    .map(d => byDay.get(d)!.slice(0, n).reduce((a, b) => a + b.v, 0))
    .filter(v => v > 0)
    .sort((a, b) => a - b);
  let rvol: number | null = null;
  if (earlier.length) {
    const mid = Math.floor(earlier.length / 2);
    const median = earlier.length % 2 ? earlier[mid] : (earlier[mid - 1] + earlier[mid]) / 2;
    rvol = median > 0 ? cum / median : null;
  }
  if (rvol == null && num(opts.dailyRvol)) rvol = opts.dailyRvol;

  const expected = Math.max(1, Math.round(minutes / BAR_MIN));
  const avgRange = today.reduce((a, b) => a + (b.c > 0 ? (b.h - b.l) / b.c : 0), 0) / n;

  return {
    session, bars: n, open, orHigh, orLow, dayHigh, dayLow, price, vwap,
    priorClose, priorHigh, priorLow, gap, chg, minutes, rvol,
    fill: Math.min(1, n / expected), lastBarAt: last.t, crosses, avgRange,
    closes: today.map(b => b.c),
  };
}

export type Direction = "Long" | "Short" | null;

export type SetupName =
  | "Opening range forming"
  | "Late session"
  | "Not tradable"
  | "Low volume"
  | "Gap & drop"
  | "Breakdown"
  | "Gap fade"
  | "Failed breakout"
  | "Opening range breakdown"
  | "VWAP rejection"
  | "Extended down"
  | "Extended"
  | "Gap & go"
  | "Breakout"
  | "Reversal up"
  | "Opening range breakout"
  | "Failed breakdown"
  | "VWAP pullback"
  | "Selling pressure"
  | "Range-bound";

/** One sentence per setup (card hover, popup "why"). */
export const SETUP_DESC: Record<SetupName, string> = {
  "Opening range forming": "The first 15 minutes are still forming — setups appear after 9:45 ET.",
  "Late session": "Under 15 minutes to the close — too late for a new intraday trade.",
  "Not tradable": "Outside $5–$1,000 or under $20M traded a day.",
  "Low volume": "Volume is below its normal pace for this time of day.",
  "Gap & drop": "Gapped down 2–8% and still extending below the open-range low, under VWAP.",
  Breakdown: "Trades 0.1%+ below yesterday's low, under VWAP, with RVOL ≥ 1.5×.",
  "Gap fade": "Gapped up 2%+ and is now below the open and below VWAP — the gap is failing.",
  "Failed breakout": "Traded above the open-range high, then fell back below it and below VWAP — trapped buyers.",
  "Opening range breakdown": "Broke the first-15-minute low on volume, under VWAP.",
  "VWAP rejection": "Downtrend bouncing into VWAP and failing — a classic short entry.",
  "Extended down": "More than 3% below VWAP — weak, but too stretched to chase; wait for a bounce.",
  Extended: "More than 3% above VWAP — strong, but too stretched to chase.",
  "Gap & go": "Gapped up 2–8% and still extending above the open-range high, above VWAP.",
  Breakout: "Clears yesterday's high with RVOL ≥ 1.5×, above VWAP.",
  "Reversal up": "Gap-down reclaimed — buyers stepped in.",
  "Opening range breakout": "Broke the first-15-minute high on volume, above VWAP.",
  "Failed breakdown": "Traded below the open-range low, then recovered above it and above VWAP — trapped sellers.",
  "VWAP pullback": "Up on the day and resting 0–0.5% above VWAP — the classic dip entry.",
  "Selling pressure": "Down on the day and below VWAP — sellers in control.",
  "Range-bound": "No clear direction — trading around VWAP.",
};

export interface Setup {
  name: SetupName;
  trend: Trend | null;
  dir: Direction;
  trigger: number | null;
}

/** Inputs beyond the bars. */
export interface IntradayCtx {
  marketOpen: boolean;
  /** S&P 500 change today as a fraction, or null when unknown. */
  spx: number | null;
  /** Average daily traded value ($), or null when unknown. */
  tradedValue?: number | null;
  /** The stock's swing trend (swing-conflict cap), when known. */
  swingTrend?: Trend | null;
  /** News or earnings today (catalyst component). */
  newsToday?: boolean;
  /** Fetch time (stale cap), epoch ms. */
  now: number;
  /** Robustness flags (production: both on). Off = the workbook's behaviour. */
  chopGuard?: boolean;
  noiseStops?: boolean;
}

/** §4.3 — first match wins; bearish setups before bullish so a falling stock never looks bullish. */
export function classify(m: SessionMetrics, ctx: Pick<IntradayCtx, "marketOpen" | "tradedValue">): Setup {
  const none = (name: SetupName, trend: Trend | null = null): Setup => ({ name, trend, dir: null, trigger: null });
  const short = (name: SetupName, trigger: number): Setup => ({ name, trend: "Weakening", dir: "Short", trigger });
  const long = (name: SetupName, trend: Trend, trigger: number): Setup => ({ name, trend, dir: "Long", trigger });
  const { price, vwap, open, orHigh, orLow, gap, chg, rvol } = m;
  const below = price < vwap;
  const above = price > vwap;
  const r = rvol ?? 1;

  if (ctx.marketOpen && m.minutes < T.orMinutes) return none("Opening range forming");
  if (ctx.marketOpen && m.minutes > T.lateStart) return none("Late session");
  if (price < T.priceMin || price > T.priceMax || (num(ctx.tradedValue) && ctx.tradedValue < T.tradedValueMin)) return none("Not tradable");
  if (r < T.rvolLow) return none("Low volume");

  const gapDown = gap != null && gap >= -T.gapMax && gap <= -T.gapMin;
  if (gapDown && price < open && below && price <= orLow * (1 - T.confirmMin)) return short("Gap & drop", orLow);
  if (m.priorLow != null && price <= m.priorLow * (1 - T.confirmMin) && below && r >= T.rvolBreak) return short("Breakdown", m.priorLow);
  if (gap != null && gap >= T.gapMin && price < open && below) return short("Gap fade", Math.min(open, vwap));
  if (m.dayHigh > orHigh && price < orHigh && below) return short("Failed breakout", Math.min(orHigh, vwap));
  if (price <= orLow * (1 - T.confirmMin) && below && r >= T.rvolBreak) return short("Opening range breakdown", orLow);
  if (chg != null && chg < 0 && below && (vwap - price) / vwap <= T.vwapZone) return short("VWAP rejection", vwap);
  if ((vwap - price) / vwap > T.extended) return short("Extended down", vwap);
  if ((price - vwap) / vwap > T.extended) return long("Extended", "Strengthening", vwap);
  const gapUp = gap != null && gap >= T.gapMin && gap <= T.gapMax;
  if (gapUp && price > open && above && price >= orHigh * (1 + T.confirmMin)) return long("Gap & go", "Emerging", orHigh);
  if (m.priorHigh != null && price >= m.priorHigh * (1 + T.confirmMin) && above && r >= T.rvolBreak) return long("Breakout", "Emerging", m.priorHigh);
  if (gapDown && price > open && above) return long("Reversal up", "Emerging", open);
  if (price >= orHigh * (1 + T.confirmMin) && above && r >= T.rvolBreak) return long("Opening range breakout", "Emerging", orHigh);
  if (m.dayLow < orLow && price > orLow && above) return long("Failed breakdown", "Emerging", Math.max(orLow, vwap));
  if (chg != null && chg > 0 && above && (price - vwap) / vwap <= T.vwapZone) return long("VWAP pullback", "Strengthening", vwap);
  if (chg != null && chg < 0 && below) return short("Selling pressure", vwap);
  return none("Range-bound", "Stable");
}

export type IComp = { key: "m" | "rs" | "v" | "c" | "conf"; label: string; weight: number; value: number | null; metric: string };
const WEIGHT = { m: 25, rs: 25, v: 20, c: 15, conf: 15 } as const;
const LABELS = { m: "Momentum", rs: "Relative strength", v: "Volume confirmation", c: "Catalyst potential", conf: "Signal confluence" } as const;

const pctS = (f: number, d = 1) => `${f > 0 ? "+" : f < 0 ? "−" : ""}${Math.abs(f * 100).toFixed(d)}%`;

/** VWAP part of momentum (§4.4): at VWAP 50; 0 → +1% rises to 100; +1…+2% 100; above +2% 80; below: 50 + vd/1% × 50. */
export function vwapScore(vd: number): number {
  if (vd >= 0) return vd <= 0.01 ? 50 + (vd / 0.01) * 50 : vd <= 0.02 ? 100 : 80;
  return clamp(50 + (vd / 0.01) * 50);
}

interface Scored {
  /** Internal score (bearish: downside strength). */
  internal: number;
  /** One-scale score shown to the user. */
  display: number;
  coverage: number;
  /** Components shown (one scale: low = weak). */
  comps: IComp[];
  checks: number;
}

function score(m: SessionMetrics, s: Setup, ctx: IntradayCtx): Scored {
  const bear = s.dir === "Short";
  const spx = ctx.spx ?? 0;
  const span = m.dayHigh - m.dayLow;
  const rangePos = span > 0 ? ((m.price - m.dayLow) / span) * 100 : 50;
  const vd = m.vwap > 0 ? (m.price - m.vwap) / m.vwap : 0;
  const mom = 0.5 * rangePos + 0.5 * vwapScore(vd);
  const rs = m.chg == null ? null : clamp(50 + ((m.chg - spx) / 0.02) * 50);
  const vol = m.rvol == null ? null : m.rvol >= 5 ? 80 : m.rvol >= 2 ? 100 : (m.rvol / 2) * 100;
  const cat = (ctx.newsToday ? 80 : 40) + Math.min(20, (Math.abs(m.gap ?? 0) / 0.08) * 20);
  const longChecks = [m.price > m.vwap, m.price > m.orHigh, m.price > m.open, m.priorHigh != null && m.price > m.priorHigh, m.chg != null && m.chg > spx];
  const shortChecks = [m.price < m.vwap, m.price < m.orLow, m.price < m.open, m.priorLow != null && m.price < m.priorLow, m.chg != null && m.chg < spx];
  const checks = (bear ? shortChecks : longChecks).filter(Boolean).length;
  const conf = checks * 20;

  const internalParts: Array<[keyof typeof WEIGHT, number | null]> = [
    ["m", bear ? 100 - mom : mom],
    ["rs", rs == null ? null : bear ? 100 - rs : rs],
    ["v", vol],
    ["c", cat],
    ["conf", conf],
  ];
  let wsum = 0, den = 0;
  for (const [k, v] of internalParts) if (v != null) { wsum += WEIGHT[k] * v; den += WEIGHT[k]; }
  const internal = den > 0 ? Math.round(wsum / den) : 0;
  let coverage = Math.round(den);
  if (m.fill < T.sparseFill) coverage = Math.min(coverage, T.sparseCoverage);

  const comps: IComp[] = [
    { key: "m", label: LABELS.m, weight: WEIGHT.m, value: Math.round(mom), metric: `${Math.round(rangePos)}% of day's range · ${pctS(vd)} vs VWAP` },
    { key: "rs", label: LABELS.rs, weight: WEIGHT.rs, value: rs == null ? null : Math.round(rs), metric: m.chg == null ? "No prior close" : `${pctS(m.chg)} today vs index ${ctx.spx == null ? "n/a" : pctS(spx)}` },
    { key: "v", label: LABELS.v, weight: WEIGHT.v, value: vol == null ? null : Math.round(vol), metric: m.rvol == null ? "No volume baseline" : `RVOL ${m.rvol.toFixed(1)}× at this time of day` },
    { key: "c", label: LABELS.c, weight: WEIGHT.c, value: Math.round(cat), metric: `${ctx.newsToday ? "News / earnings today" : "No news today"}${m.gap != null ? ` · gap ${pctS(m.gap)}` : ""}` },
    { key: "conf", label: LABELS.conf, weight: WEIGHT.conf, value: bear ? 100 - conf : conf, metric: `${checks} of 5 ${bear ? "bearish" : "bullish"} checks` },
  ];
  return { internal, display: bear ? 100 - internal : internal, coverage, comps, checks };
}

export interface IntradayPlan {
  zoneLo: number;
  zoneHi: number;
  stop: number;
  /** |price − stop| / price. */
  stopDist: number;
  t1: number | null;
  t2: number | null;
  size: "Small" | "Normal";
}

export function planFor(m: SessionMetrics, s: Setup, noiseStops: boolean): IntradayPlan | null {
  if (!s.dir || s.trigger == null) return null;
  const tr = s.trigger;
  const vwapType = Math.abs(tr - m.vwap) < 1e-9;
  const minDist = noiseStops ? Math.max(T.stopMin, 1.5 * m.avgRange) : T.stopMin;
  let zoneLo: number, zoneHi: number, stop: number;
  if (s.dir === "Long") {
    if (s.name === "VWAP pullback") { zoneLo = tr; zoneHi = tr * (1 + T.vwapZone); }
    else { zoneLo = tr * (1 + T.confirmMin); zoneHi = tr * (1 + T.confirmMax); }
    const hi = Math.max(m.vwap, m.orLow);
    const level = hi < m.price ? hi : Math.min(m.vwap, m.orLow);
    stop = Math.min(level * (1 - T.stopBuffer), m.price * (1 - minDist));
    // Never inside the entry zone or above the trigger: losing the trigger is
    // what invalidates the long, so the stop sits a buffer beneath both.
    stop = Math.min(stop, Math.min(tr, zoneLo) * (1 - T.stopBuffer));
  } else {
    if (vwapType) { zoneLo = tr * (1 - T.vwapZone); zoneHi = tr; }
    else { zoneLo = tr * (1 - T.confirmMax); zoneHi = tr * (1 - T.confirmMin); }
    const lo = Math.min(m.vwap, m.orHigh);
    const level = lo > m.price ? lo : Math.max(m.vwap, m.orHigh);
    stop = Math.max(level * (1 + T.stopBuffer), m.price * (1 + minDist));
    // Never inside the short entry zone or below the trigger (B: zone
    // 34.25–34.57 under a 34.60 trigger had its cover stop at 34.55).
    stop = Math.max(stop, Math.max(tr, zoneHi) * (1 + T.stopBuffer));
  }
  const stopDist = Math.abs(m.price - stop) / m.price;
  const size = stopDist > 0.01 || (m.rvol ?? 0) > T.rvolClimax || Math.abs(m.gap ?? 0) > T.gapMax ? "Small" : "Normal";
  return { zoneLo, zoneHi, stop, stopDist, t1: null, t2: null, size };
}

export interface IntradayAction {
  key: ActionKey;
  label: "Setup active" | "Building" | "Watch" | "Avoid";
  why: string;
}

export interface IntradaySignal {
  ticker: string;
  c: CompanyDoc | null;
  m: SessionMetrics;
  setup: Setup;
  desc: string;
  /** Internal score (bearish: downside strength). */
  internal: number;
  /** The one-scale number shown (bearish: 100 − internal). */
  score: number;
  status: ReturnType<typeof compStatus>;
  coverage: number;
  comps: IComp[];
  /** The action for the setup's own side (long plan for Long, short plan for Short). */
  action: IntradayAction;
  /** The workbook's long-side action (Avoid for a bearish setup). */
  longAction: IntradayAction;
  plan: IntradayPlan | null;
  /** Robustness caps that held a Setup active back (§4.7), in plain words. */
  caps: string[];
  /** Bar data is older than the stale limit while the market is open. */
  stale: boolean;
}

const act = (key: ActionKey, why: string): IntradayAction => ({
  key, label: key === "act" ? "Setup active" : key === "alert" ? "Building" : key === "watch" ? "Watch" : "Avoid", why,
});

/** Score bar for Setup active: 70, or 75 in the midday window (120–240 minutes). */
export const actBarAt = (minutes: number) => (minutes >= T.primeEnd && minutes < T.middayEnd ? T.actBarMidday : T.actBar);

/** Evaluate one stock (§4.4–§4.7). */
/**
 * The Action for an intraday setup, in the glossary's order: stretched, then
 * price already past the entry zone or a stop too wide (Watch at any score),
 * then the score (Watch under 55 / 45, Building below the act bar), then data
 * coverage and the robustness caps, else Setup active (which alone carries
 * 1R / 2R targets).
 */
export function decideIntradayAction(x: {
  setup: Setup;
  internal: number;
  display: number;
  price: number;
  plan: IntradayPlan | null;
  coverage: number;
  caps: string[];
  minutes: number;
}): { action: IntradayAction; longAction: IntradayAction; plan: IntradayPlan | null } {
  const { setup, internal, display, price, plan, coverage, caps } = x;
  const bar = actBarAt(x.minutes);
  let action: IntradayAction;
  let longAction: IntradayAction;
  if (setup.dir === "Long" && plan) {
    if (setup.name === "Extended") action = act("watch", "More than 3% above VWAP — too stretched to chase; wait for a pullback.");
    else if (price > plan.zoneHi) action = act("watch", "Price is already past the entry zone — wait for a retest.");
    else if (plan.stopDist > T.stopMax) action = act("watch", `The stop would be ${(plan.stopDist * 100).toFixed(1)}% away — too wide for an intraday trade.`);
    else if (internal < T.buildBar) action = act("watch", `Score ${display} is under 55 — no edge yet.`);
    else if (internal < bar) action = act("alert", bar === T.actBarMidday && internal >= T.actBar ? "Midday needs a score of 75 — wait for the trigger." : "Improving, but not yet confirmed — wait for the trigger.");
    else if (coverage < T.minCoverage) action = act("alert", `Only ${coverage}% of the inputs are reliable — wait for a cleaner read.`);
    else if (caps.length) action = act("alert", `Held back: ${caps.join("; ")}.`);
    else action = act("act", "Score, entry zone and a tight stop all line up — the setup is live.");
    longAction = action;
  } else if (setup.dir === "Short" && plan) {
    const shortBar = 100 - bar;
    if (setup.name === "Extended down") action = act("watch", "More than 3% below VWAP — too stretched to chase; wait for a bounce.");
    else if (price < plan.zoneLo) action = act("watch", "Already well below the trigger — wait for a bounce to retest it.");
    else if (plan.stopDist > T.stopMax) action = act("watch", `The cover stop would be ${(plan.stopDist * 100).toFixed(1)}% away — too wide for an intraday trade.`);
    else if (display > 100 - T.buildBar) action = act("watch", `Score ${display} is above 45 — not weak enough for a short setup.`);
    else if (display > shortBar) action = act("alert", shortBar === 100 - T.actBarMidday && display <= 100 - T.actBar ? "Midday needs a score of 25 or lower — wait for the break below the trigger." : "Weakness is building — wait for the break below the trigger.");
    else if (coverage < T.minCoverage) action = act("alert", `Only ${coverage}% of the inputs are reliable — wait for a cleaner read.`);
    else if (caps.length) action = act("alert", `Held back: ${caps.join("; ")}.`);
    else action = act("act", "Score, short entry zone and a tight cover stop all line up — the short setup is live.");
    longAction = act("avoid", "A bearish setup — not a long.");
  } else {
    action = act("watch", SETUP_DESC[setup.name]);
    longAction = action;
  }
  // Targets only on Setup active (§4.5); the card hides the 1R/2R footer otherwise.
  if (plan && action.key === "act") {
    const R = Math.abs(price - plan.stop);
    if (setup.dir === "Long") { plan.t1 = price + R; plan.t2 = price + 2 * R; }
    else { plan.t1 = price - R; plan.t2 = price - 2 * R; }
  }
  return { action, longAction, plan };
}

export function evaluateIntraday(ticker: string, m: SessionMetrics, c: CompanyDoc | null, ctx: IntradayCtx): IntradaySignal {
  const setup = classify(m, ctx);
  const sc = score(m, setup, ctx);
  const noise = ctx.noiseStops !== false;
  const plan = planFor(m, setup, noise);

  // Robustness caps (§4.7): each only downgrades Setup active → Building.
  const caps: string[] = [];
  const staleLimitMs = (BAR_MIN + T.staleGraceMin + T.backendRefreshMin) * 60_000;
  const stale = ctx.marketOpen && ctx.now - m.lastBarAt > staleLimitMs;
  if (stale) caps.push(`the last 5-minute bar is from ${new Date(m.lastBarAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`);
  if (m.fill < T.sparseFill) caps.push("bars are missing for this session");
  if (ctx.chopGuard !== false && m.minutes >= T.chopAfter && m.crosses >= T.chopCrosses) caps.push(`a choppy tape (${m.crosses} VWAP crossings since 10:00)`);
  if (setup.dir === "Long" && ctx.spx != null && ctx.spx <= -T.regime) caps.push(`the S&P 500 is ${pctS(ctx.spx)} today`);
  if (setup.dir === "Short" && ctx.spx != null && ctx.spx >= T.regime) caps.push(`the S&P 500 is ${pctS(ctx.spx)} today`);
  if (setup.dir === "Long" && ctx.swingTrend === "Weakening") caps.push("the stock's swing trend is down");
  if (setup.dir === "Short" && (ctx.swingTrend === "Emerging" || ctx.swingTrend === "Strengthening" || ctx.swingTrend === "Pulling back")) caps.push("the stock's swing trend is up");

  const { action, longAction } = decideIntradayAction({
    setup, internal: sc.internal, display: sc.display, price: m.price, plan, coverage: sc.coverage, caps, minutes: m.minutes,
  });

  return {
    ticker, c, m, setup, desc: SETUP_DESC[setup.name],
    internal: sc.internal, score: sc.display, status: compStatus(sc.display),
    coverage: sc.coverage, comps: sc.comps, action, longAction, plan,
    caps,
    stale,
  };
}

/** How many stocks the intraday scan reads bars for: Screener / Dashboard. */
export const POOL_SCREENER = 24;
export const POOL_DASHBOARD = 12;
const MIN_CAP = 500_000_000;

/**
 * The intraday shortlist (§4.8): common equity, $5–$1,000, traded value ≥ $20M
 * (or unknown), market cap ≥ $500M (or unknown), |day move| 0.3%–20%, ranked
 * by RVOL × (1 + |move %|).
 */
export function intradayCandidates(companies: CompanyDoc[], n: number, now = Date.now()): CompanyDoc[] {
  const rank = (c: CompanyDoc) => (num(c.rvol) ? c.rvol : 1) * (1 + Math.abs(c.pctChange ?? 0));
  return dedupeByIssuer(
    companies
      .filter(c => {
        if (!num(c.price) || c.price < T.priceMin || c.price > T.priceMax) return false;
        if (num(c.avgVolume20) && c.avgVolume20 * c.price < T.tradedValueMin) return false;
        if (num(c.marketCap) && c.marketCap < MIN_CAP) return false;
        const mv = Math.abs(c.pctChange ?? 0);
        if (mv < 0.3 || mv > 20) return false;
        return isPickable(c) && dataFresh(c, now);
      })
      .sort((a, b) => rank(b) - rank(a)),
    c => c,
  ).slice(0, n);
}

const actionable = (s: IntradaySignal) => s.action.key === "act" || s.action.key === "alert";
const stretched = (s: IntradaySignal) => s.setup.name === "Extended" || s.setup.name === "Extended down";

/**
 * Intraday lists (§4.8). Bullish: Long setups that are Setup active or
 * Building, score high → low. Bearish: Short setups that are Setup active or
 * Building, Setup active first, then the lowest number. One line per issuer.
 * `fill` tops each list up with the next-best directional setups (status
 * Watch, never Extended / Extended down) — used by the Dashboard only.
 */
export function intradayLists(sigs: IntradaySignal[], limit = MAX_PICKS, fill = false) {
  const issuer = (s: IntradaySignal) => s.c ?? { ticker: s.ticker, name: null } as unknown as CompanyDoc;
  const longs = sigs.filter(s => s.setup.dir === "Long");
  const shorts = sigs.filter(s => s.setup.dir === "Short");
  const byScore = (a: IntradaySignal, b: IntradaySignal) => b.score - a.score;
  const bearOrder = (a: IntradaySignal, b: IntradaySignal) =>
    (a.action.key === "act" ? 0 : 1) - (b.action.key === "act" ? 0 : 1) || a.score - b.score;
  let bull = dedupeByIssuer(longs.filter(actionable).sort(byScore), issuer).slice(0, limit);
  let bear = dedupeByIssuer(shorts.filter(actionable).sort(bearOrder), issuer).slice(0, limit);
  if (fill) {
    const top = (list: IntradaySignal[], pool: IntradaySignal[], order: (a: IntradaySignal, b: IntradaySignal) => number) => {
      const have = new Set(list.map(s => s.ticker));
      const extra = pool.filter(s => !have.has(s.ticker) && !actionable(s) && !stretched(s)).sort(order);
      return dedupeByIssuer([...list, ...extra], issuer).slice(0, limit);
    };
    bull = top(bull, longs, byScore);
    bear = top(bear, shorts, (a, b) => a.score - b.score);
  }
  return { bull, bear };
}
