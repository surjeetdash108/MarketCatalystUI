"use client";

/**
 * CandleChart — the shared interactive price chart (stock detail, stock
 * panels, watchlist/screener drawers). Canvas-rendered after the stock-detail
 * design: stacked study panes, an indicator browser, a legend HUD with live
 * readings, earnings "E" markers, crosshair, auto log scale and full screen.
 *
 * Two data modes, chosen by the caller:
 *   - `tf` (1D…5Y): a date RANGE; the backend picks the bar size.
 *   - `interval` (1m…1M): a candle SIZE; the backend picks the range.
 *
 * Studies (indicators) live in one small store shared by every chart on the
 * page and persisted per browser, so a set-up made on one chart carries to the
 * next — the way a charting terminal behaves.
 */

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type ReactNode, type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { mapEarningsToBars, type ChartEarnings } from "./chart-earnings";
import { useBackendBars } from "./hooks/useBackendBars";
import { DataState } from "./utils";
import { atr, boll, ema, etSessionDate, macd, rsi, sma, stoch, vwap, type Num } from "./indicators";

/* ══════════════════════════════════════════════════════════════════════
   Types + candle intervals
   ══════════════════════════════════════════════════════════════════════ */

import type { OHLCBar } from "./indicators";
export type { OHLCBar };

/**
 * Candle sizes served by GET /live/bars?interval=… — case-sensitive, so "1m" is
 * one minute and "1M" one month. Unlike TF_OPTIONS (a date RANGE whose bar size
 * the backend picks), these fix the bar size and the backend picks the range:
 * ~300+ candles each, enough to seed a 200-period average (1W/1M are capped by
 * the 5-year history at ~260/~60).
 */
export const BAR_INTERVALS = ["1m", "5m", "15m", "30m", "1H", "2H", "4H", "1D", "1W", "1M"] as const;
export type BarInterval = (typeof BAR_INTERVALS)[number];

const BAR_INTERVAL_GROUPS: ReadonlyArray<readonly [string, readonly BarInterval[]]> = [
  ["Minutes", ["1m", "5m", "15m", "30m"]],
  ["Hours", ["1H", "2H", "4H"]],
  ["Days", ["1D", "1W", "1M"]],
];

const BAR_INTERVAL_LABELS: Record<BarInterval, string> = {
  "1m": "1 minute", "5m": "5 minutes", "15m": "15 minutes", "30m": "30 minutes",
  "1H": "1 hour", "2H": "2 hours", "4H": "4 hours",
  "1D": "1 day", "1W": "1 week", "1M": "1 month",
};

/** Candle length for the intraday sizes; 1D/1W/1M are calendar-bounded instead. */
const INTRADAY_INTERVAL_MS: Partial<Record<BarInterval, number>> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
  "1H": 3_600_000, "2H": 7_200_000, "4H": 14_400_000,
};

/** Display name of a candle size, e.g. "1 hour". */
export function intervalLabel(iv: BarInterval): string {
  return BAR_INTERVAL_LABELS[iv];
}

export function isIntradayInterval(iv: BarInterval): boolean {
  return INTRADAY_INTERVAL_MS[iv] != null;
}

export type ChartHoverOhlc = { o: number; h: number; l: number; c: number; pctChg: number };

/* ══════════════════════════════════════════════════════════════════════
   Time helpers (all in exchange time, America/New_York)
   ══════════════════════════════════════════════════════════════════════ */

const ET = "America/New_York";

/** ET minutes-since-midnight for an instant. */
function etMinuteOfDay(ms: number): number {
  const [h, m] = new Date(ms)
    .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ET })
    .split(":").map(Number);
  return (h % 24) * 60 + m;
}

/** Monday (YYYY-MM-DD) of the ET calendar week containing `ms`. */
function etWeekStart(ms: number): string {
  const d = new Date(`${etSessionDate(ms)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Whether the tick at `at` still falls inside the candle stamped `lastT`, i.e.
 * whether it may be folded onto it. Interval candles are regular-session only
 * (09:30–16:00 ET), so an extended-hours tick never qualifies for an intraday
 * size — the backend dropped those bars, and folding one in would draw a
 * price the series itself excludes.
 */
function candleIsOpen(lastT: number, iv: BarInterval, at: number): boolean {
  const len = INTRADAY_INTERVAL_MS[iv];
  if (len != null) {
    const mod = etMinuteOfDay(at);
    return etSessionDate(lastT) === etSessionDate(at)
      && at < lastT + len
      && mod >= 9 * 60 + 30 && mod < 16 * 60;
  }
  if (iv === "1D") return etSessionDate(lastT) === etSessionDate(at);
  if (iv === "1W") return etWeekStart(lastT) === etWeekStart(at);
  return etSessionDate(lastT).slice(0, 7) === etSessionDate(at).slice(0, 7); // 1M
}

const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: ET });
const fmtClock = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET });
const fmtMonthYear = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: ET });

/**
 * X-axis label for one bar. Intraday bars show a clock time, switching to the
 * date on the first label of each new session (and the very first one) so a
 * multi-day window stays readable. Daily-and-up show a day while the window
 * spans under ~10 months, month + year beyond that.
 */
function axisLabel(t: number, intraday: boolean, prevT: number | null, spanMs: number): string {
  if (intraday) {
    return prevT == null || etSessionDate(prevT) !== etSessionDate(t) ? fmtDay(t) : fmtClock(t);
  }
  return spanMs < 300 * 86_400_000 ? fmtDay(t) : fmtMonthYear(t);
}

/** Crosshair date tag — always precise enough to identify the bar. */
function crossLabel(t: number, intraday: boolean, monthly: boolean): string {
  if (intraday) return `${fmtDay(t)} ${fmtClock(t)}`;
  if (monthly) return fmtMonthYear(t);
  return `${fmtDay(t)} '${etSessionDate(t).slice(2, 4)}`;
}

/* ══════════════════════════════════════════════════════════════════════
   Range-mode (tf) data sourcing
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Where to get bars that PRECEDE the visible window, to seed indicators in
 * range mode. Only bars of the SAME granularity can seed an indicator, so this
 * maps each timeframe to the longest series that shares its bar size —
 * measured against /live/bars for CSCO:
 *
 *   1D  78 bars @ 5min  |  1W 390 @ 5min  |  1M 286 @ 30min
 *   3M  64 @ 1d  |  6M 128 @ 1d  |  1Y 252 @ 1d  |  5Y 1264 @ 1d
 *
 * Daily timeframes need no warm-up: they already draw from the 5Y pool below.
 */
const MA_WARMUP_TF: Record<string, string> = { "1D": "1W" };

// Daily timeframes all draw from the SAME longest daily series (5Y) — so
// scroll-to-zoom keeps revealing real history instead of hard-stopping at what
// the selected button alone fetched. Intraday ranges stay bounded by what they
// fetch: there is no coarser real series to expand into without fabricating.
const DAILY_TF = new Set(["3M", "6M", "1Y", "5Y"]);
const POOL_TF = "5Y";
// Opening window per daily range, in bars — 5Y opens on the whole pool.
const DAILY_INITIAL_LEN: Record<string, number> = { "3M": 64, "6M": 128, "1Y": 252 };
// Candle-interval mode's opening window, in candles. The series is deeper than
// one screen on purpose (indicator warm-up + room to scroll back).
const INTERVAL_INITIAL_LEN = 120;
/** Fewest bars a zoom can narrow to. */
const MIN_BARS = 12;

/* ══════════════════════════════════════════════════════════════════════
   Indicator catalog + maths
   ══════════════════════════════════════════════════════════════════════ */

type StudyKind = "atr" | "bb" | "ema" | "macd" | "rsi" | "sma" | "stoch" | "vol" | "vwap";

interface CatEntry {
  k?: StudyKind;
  name: string;
  alias?: string;
  type?: "pane" | "overlay";
  col?: string;
  param?: { label: string; def: number; opts: number[] };
  suffix?: string;
  fixed?: string;
  badge?: "new" | "beta";
}

/** One entry per study. `k` present = it really draws; the rest are listed as coming soon. */
const CAT: CatEntry[] = [
  { k: "atr", name: "ATR", alias: "Average True Range", type: "pane", col: "#c9a227", param: { label: "Length", def: 14, opts: [7, 14, 21] } },
  { k: "bb", name: "BB", alias: "Bollinger Bands", type: "overlay", col: "#8b7ef0", param: { label: "Length", def: 20, opts: [10, 20, 50] }, suffix: ", 2" },
  { k: "ema", name: "EMA", alias: "Exponential Moving Average", type: "overlay", col: "#2fd9d0", param: { label: "Length", def: 21, opts: [9, 21, 50, 100, 200] } },
  { k: "macd", name: "MACD", alias: "Moving Average Convergence Divergence", type: "pane", col: "#4a67d8", fixed: "12, 26, 9" },
  { k: "rsi", name: "RSI", alias: "Relative Strength Index", type: "pane", col: "#e07be0", param: { label: "Length", def: 14, opts: [7, 14, 21] } },
  { k: "sma", name: "SMA", alias: "Simple Moving Average", type: "overlay", col: "#f3b24a", param: { label: "Length", def: 50, opts: [9, 21, 50, 100, 200] } },
  { k: "stoch", name: "Stoch", alias: "Stochastic", type: "pane", col: "#4bd99a", param: { label: "Length", def: 14, opts: [5, 9, 14, 21] }, suffix: ", 3, 3" },
  { k: "vol", name: "Volume", type: "pane", col: "#6b7688" },
  { k: "vwap", name: "VWAP", alias: "Volume Weighted Average Price", type: "overlay", col: "#ff9d5c" },
  { name: "A/D", alias: "Accumulation/Distribution" },
  { name: "ADX 14", alias: "Average Directional Index" },
  { name: "Aroon" },
  { name: "Auto Fib Retracement", badge: "beta" },
  { name: "Awesome Oscillator" },
  { name: "CCI 20", alias: "Commodity Channel Index" },
  { name: "Chaikin Money Flow" },
  { name: "Donchian Channels" },
  { name: "Ichimoku Cloud" },
  { name: "Keltner Channels" },
  { name: "MFI 14", alias: "Money Flow Index" },
  { name: "OBV", alias: "On Balance Volume" },
  { name: "PSAR", alias: "Parabolic SAR" },
  { name: "Pivot Points Standard", badge: "new" },
  { name: "ROC 9", alias: "Rate of Change" },
  { name: "Supertrend", badge: "new" },
  { name: "Williams %R" },
  { name: "Zig Zag" },
];

/** Line colours a study can take; a new study takes its own catalog colour if free, else the first unused one. */
export const LINE_PALETTE = ["#f3b24a", "#4a67d8", "#2fd9d0", "#f07be0", "#4bd99a", "#ff9d5c", "#c9a227", "#8b7ef0", "#6ee7ff", "#e07be0"];

const cat = (k: StudyKind): CatEntry => CAT.find(c => c.k === k)!;

interface Study { id: string; k: StudyKind; len: number | null; col: string; on: boolean }

const studyLabel = (s: Pick<Study, "k" | "len">): string => {
  const c = cat(s.k);
  return c.fixed ? `${c.name} ${c.fixed}` : c.param ? `${c.name} ${s.len}${c.suffix ?? ""}` : c.name;
};

type StudyData =
  | { kind: "line"; v: Num[] }
  | { kind: "bb"; u: Num[]; mid: Num[]; lo: Num[] }
  | { kind: "macd"; m: Num[]; s: Num[]; h: Num[] }
  | { kind: "stoch"; k: Num[]; d: Num[] }
  | { kind: "none" };

function computeStudy(s: Study, src: OHLCBar[], intraday: boolean): StudyData {
  const n = s.len ?? 14;
  switch (s.k) {
    case "sma": return { kind: "line", v: sma(src, n) };
    case "ema": return { kind: "line", v: ema(src, n) };
    case "rsi": return { kind: "line", v: rsi(src, n) };
    case "atr": return { kind: "line", v: atr(src, n) };
    case "vwap": return { kind: "line", v: vwap(src, intraday) };
    case "bb": return { kind: "bb", ...boll(src, n, 2) };
    case "macd": return { kind: "macd", ...macd(src) };
    case "stoch": return { kind: "stoch", ...stoch(src, n) };
    default: return { kind: "none" }; // volume reads the bars directly
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Study store — shared by every chart, persisted per browser
   ══════════════════════════════════════════════════════════════════════ */

interface ChartPrefs { studies: Study[]; favs: StudyKind[]; log: boolean }

const PREFS_KEY = "mc.chart.prefs.v1";
const DEFAULT_PREFS: ChartPrefs = {
  studies: [
    { id: "vol", k: "vol", len: null, col: "#6b7688", on: true },
    { id: "sma50", k: "sma", len: 50, col: "#f3b24a", on: true },
    { id: "sma200", k: "sma", len: 200, col: "#4a67d8", on: true },
  ],
  favs: ["sma", "rsi"],
  log: false,
};

const KINDS = new Set<StudyKind>(["atr", "bb", "ema", "macd", "rsi", "sma", "stoch", "vol", "vwap"]);

/** Accepts only well-formed saved prefs; anything else falls back to defaults. */
function parsePrefs(raw: string | null): ChartPrefs | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ChartPrefs>;
    if (!Array.isArray(p.studies)) return null;
    const studies = p.studies.filter((s): s is Study =>
      !!s && typeof s.id === "string" && KINDS.has(s.k) && typeof s.col === "string" && typeof s.on === "boolean"
      && (s.len === null || (typeof s.len === "number" && s.len >= 1 && s.len <= 500)));
    const favs = Array.isArray(p.favs) ? p.favs.filter((k): k is StudyKind => KINDS.has(k)) : DEFAULT_PREFS.favs;
    return { studies, favs, log: p.log === true };
  } catch {
    return null;
  }
}

let prefsCache: ChartPrefs | null = null;
const prefsListeners = new Set<() => void>();

function readPrefs(): ChartPrefs {
  if (prefsCache) return prefsCache;
  let stored: string | null = null;
  try { stored = window.localStorage.getItem(PREFS_KEY); } catch { /* storage blocked */ }
  prefsCache = parsePrefs(stored) ?? DEFAULT_PREFS;
  return prefsCache;
}

function writePrefs(update: (p: ChartPrefs) => ChartPrefs) {
  prefsCache = update(readPrefs());
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefsCache)); } catch { /* storage blocked */ }
  prefsListeners.forEach(l => l());
}

const subscribePrefs = (l: () => void) => { prefsListeners.add(l); return () => { prefsListeners.delete(l); }; };
const serverPrefs = () => DEFAULT_PREFS;

function useChartPrefs(): ChartPrefs {
  return useSyncExternalStore(subscribePrefs, readPrefs, serverPrefs);
}

function nextStudyColor(k: StudyKind, studies: readonly Study[]): string {
  const used = new Set(studies.map(s => s.col));
  const own = cat(k).col!;
  if (!used.has(own)) return own;
  return LINE_PALETTE.find(c => !used.has(c)) ?? LINE_PALETTE[studies.length % LINE_PALETTE.length];
}

let studyUid = 0;
const newStudyId = (k: StudyKind) => `${k}-${Date.now().toString(36)}-${(++studyUid).toString(36)}`;

/* ══════════════════════════════════════════════════════════════════════
   Formatting
   ══════════════════════════════════════════════════════════════════════ */

const money = (v: number) => "$" + v.toFixed(v < 1 ? 3 : 2);
const f2 = (v: Num | undefined) => (v == null || !isFinite(v) ? null : v.toFixed(2));
const bigVol = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : `${Math.round(v)}`;

/** One "nice" step for ~`target` gridlines over `range`. */
function niceStep(range: number, target: number): number {
  const raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/* ══════════════════════════════════════════════════════════════════════
   Canvas renderer
   ══════════════════════════════════════════════════════════════════════ */

const PAD = { t: 14, r: 70, b: 28, l: 8 };

/** Colours resolved from CSS (see `.cc` in iq.css) so the canvas follows the theme. */
interface Palette {
  up: string; down: string; grid: string; text: string; cross: string; last: string; lastInk: string;
  er: string; erInk: string; tag: string; tagInk: string; paneLabel: string; band: string; avg: string; bg: string; font: string;
}

function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    up: v("--cc-up", "#4bd99a"), down: v("--cc-down", "#f2555f"), grid: v("--cc-grid", "#151c27"),
    text: v("--cc-text", "#8b94a7"), cross: v("--cc-cross", "#4a5567"), last: v("--cc-last", "#8b7ef0"),
    lastInk: v("--cc-last-ink", "#0b0713"), er: v("--cc-er", "#7fd8ff"), erInk: v("--cc-er-ink", "#06131c"),
    tag: v("--cc-tag", "#2a3346"), tagInk: v("--cc-tag-ink", "#e7ecf4"), paneLabel: v("--cc-pane-label", "#4b5566"),
    band: v("--cc-band", "#2a3346"), avg: v("--cc-avg", "rgba(150,160,180,.55)"), bg: v("--cc-bg", "#0b0d10"),
    font: v("--f-mono", "ui-monospace, monospace"),
  };
}

interface View { from: number; to: number }
interface Hover { i: number; y: number }
interface ErHit { k: number; x: number; y: number }

interface DrawModel {
  W: number; H: number;
  data: OHLCBar[];
  seed: number; // offset of data[0] inside each study series
  studies: Study[];
  computed: Map<string, StudyData>;
  view: View;
  hover: Hover | null;
  chartType: string;
  log: boolean;
  intraday: boolean;
  monthly: boolean;
  erMarks: Array<{ i: number; e: ChartEarnings }>;
  pal: Palette;
}

interface Geo { l: number; r: number; w: number; top: number; priceB: number; bottom: number; panes: Array<{ s: Study; top: number; bot: number }> }

function geometry(W: number, H: number, panes: Study[]): Geo {
  const l = PAD.l, r = W - PAD.r, w = r - l, body = H - PAD.t - PAD.b, gap = 9;
  const share = panes.length ? Math.min(0.17, 0.52 / panes.length) : 0;
  const ph = body * share;
  const priceB = PAD.t + body - panes.length * (ph + gap);
  return {
    l, r, w, top: PAD.t, priceB, bottom: PAD.t + body,
    panes: panes.map((s, i) => { const top = priceB + gap + i * (ph + gap); return { s, top, bot: top + ph }; }),
  };
}

const isOverlay = (s: Study) => cat(s.k).type === "overlay";
const isPane = (s: Study) => cat(s.k).type === "pane";

/** Draws one frame and returns the earnings-marker hit targets. */
function drawChart(ctx: CanvasRenderingContext2D, m: DrawModel): ErHit[] {
  const { W, H, data, seed, studies, computed, view, hover, pal } = m;
  const n = data.length;
  ctx.clearRect(0, 0, W, H);
  if (n === 0 || W < PAD.l + PAD.r + 20) return [];
  const font = `12px ${pal.font}`;
  ctx.font = font; ctx.textBaseline = "middle"; ctx.lineWidth = 1;

  const on = studies.filter(s => s.on);
  const overlays = on.filter(isOverlay);
  const g = geometry(W, H, on.filter(isPane));
  const span = view.to - view.from;
  const xOf = (i: number) => g.l + (i + 0.5 - view.from) * (g.w / span);
  const i0 = Math.max(0, Math.floor(view.from)), i1 = Math.min(n - 1, Math.ceil(view.to));
  if (i1 < i0) return [];
  const at = (arr: Num[], i: number) => arr[i + seed];

  // ── price range over the visible bars + overlays ──
  let hi = -Infinity, lo = Infinity;
  const bump = (v: Num | undefined) => { if (v != null && isFinite(v)) { if (v > hi) hi = v; if (v < lo) lo = v; } };
  const scan = Math.max(1, Math.floor((i1 - i0) / 900));
  for (let i = i0; i <= i1; i += scan) {
    bump(data[i].h); bump(data[i].l);
    for (const s of overlays) {
      const d = computed.get(s.id);
      if (d?.kind === "bb") { bump(at(d.u, i)); bump(at(d.lo, i)); }
      else if (d?.kind === "line") bump(at(d.v, i));
    }
  }
  if (!isFinite(hi)) { hi = 1; lo = 0; }
  // A multi-year history can span thousands of percent: switch to log on its own.
  const useLog = (m.log || hi / lo > 8) && lo > 0;
  if (useLog) { const k = Math.pow(hi / lo, 0.05); hi *= k; lo = Math.max(lo / k, 1e-4); }
  else { const p = (hi - lo) * 0.07 || 1; hi += p; lo -= p; }
  const ph = g.priceB - g.top;
  const lgHi = Math.log(hi), lgLo = Math.log(Math.max(lo, 1e-4));
  const yOf = useLog
    ? (p: number) => g.top + ((lgHi - Math.log(Math.max(p, 1e-4))) / (lgHi - lgLo)) * ph
    : (p: number) => g.top + ((hi - p) / (hi - lo)) * ph;

  // ── grid + right axis ──
  const ticks: number[] = [];
  if (useLog) {
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
      for (const mult of [1, 2, 5]) { const v = mult * Math.pow(10, e); if (v > lo && v < hi) ticks.push(v); }
    }
    // a narrow log window can hold < 2 decade marks — fall back to linear steps
    if (ticks.length < 3) {
      ticks.length = 0;
      const st = niceStep(hi - lo, 6);
      for (let p = Math.ceil(lo / st) * st; p < hi; p += st) ticks.push(p);
    }
  } else {
    const st = niceStep(hi - lo, 6);
    for (let p = Math.ceil(lo / st) * st; p < hi; p += st) ticks.push(p);
  }
  ctx.textAlign = "left";
  for (const p of ticks) {
    const y = yOf(p);
    ctx.strokeStyle = pal.grid; ctx.beginPath(); ctx.moveTo(g.l, y); ctx.lineTo(g.r, y); ctx.stroke();
    ctx.fillStyle = pal.text; ctx.fillText(money(p), g.r + 9, y);
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(g.l, g.top, g.w, g.priceB - g.top); ctx.clip();

  // ── Bollinger fill (under the candles) ──
  for (const s of overlays) {
    const d = computed.get(s.id);
    if (d?.kind !== "bb") continue;
    ctx.globalAlpha = 0.09; ctx.fillStyle = s.col; ctx.beginPath();
    let started = false;
    for (let i = i0; i <= i1; i++) {
      const u = at(d.u, i); if (u == null) continue;
      if (started) ctx.lineTo(xOf(i), yOf(u)); else { ctx.moveTo(xOf(i), yOf(u)); started = true; }
    }
    for (let i = i1; i >= i0; i--) { const l = at(d.lo, i); if (l != null) ctx.lineTo(xOf(i), yOf(l)); }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }

  // ── price series ──
  const bw = Math.max(1, Math.min(18, (g.w / span) * 0.7));
  const stride = Math.max(1, Math.floor(span / g.w));
  const ct = m.chartType;
  if (ct === "line" || ct === "area") {
    const up = data[i1].c >= data[i0].c, col = up ? pal.up : pal.down;
    ctx.beginPath();
    for (let i = i0, k = 0; i <= i1; i += stride, k++) {
      const x = xOf(i), y = yOf(data[i].c);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    if (ct === "area") {
      ctx.save();
      ctx.lineTo(xOf(i1), g.priceB); ctx.lineTo(xOf(i0), g.priceB); ctx.closePath();
      const grad = ctx.createLinearGradient(0, g.top, 0, g.priceB);
      grad.addColorStop(0, col); grad.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.22; ctx.fillStyle = grad; ctx.fill();
      ctx.restore();
      ctx.beginPath();
      for (let i = i0, k = 0; i <= i1; i += stride, k++) {
        const x = xOf(i), y = yOf(data[i].c);
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
    }
    ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke(); ctx.lineWidth = 1;
  } else if (stride > 1) {
    // more bars than pixels: one high-low stroke per bucket
    for (let i = i0; i <= i1; i += stride) {
      const end = Math.min(i + stride - 1, i1);
      let hh = -Infinity, ll = Infinity;
      for (let j = i; j <= end; j++) { if (data[j].h > hh) hh = data[j].h; if (data[j].l < ll) ll = data[j].l; }
      ctx.strokeStyle = data[end].c >= data[i].o ? pal.up : pal.down;
      const x = xOf(i + (end - i) / 2);
      ctx.beginPath(); ctx.moveTo(x, yOf(hh)); ctx.lineTo(x, yOf(ll)); ctx.stroke();
    }
  } else {
    for (let i = i0; i <= i1; i++) {
      const b = data[i], x = xOf(i), up = b.c >= b.o, col = up ? pal.up : pal.down;
      ctx.strokeStyle = ctx.fillStyle = col;
      ctx.lineWidth = bw < 2 ? 1 : 1.3;
      if (ct === "bars") {
        const tw = Math.max(2, bw / 2);
        ctx.beginPath();
        ctx.moveTo(x, yOf(b.h)); ctx.lineTo(x, yOf(b.l));
        ctx.moveTo(x - tw, yOf(b.o)); ctx.lineTo(x, yOf(b.o));
        ctx.moveTo(x, yOf(b.c)); ctx.lineTo(x + tw, yOf(b.c));
        ctx.stroke();
        continue;
      }
      ctx.beginPath(); ctx.moveTo(x, yOf(b.h)); ctx.lineTo(x, yOf(b.l)); ctx.stroke();
      if (bw >= 2) {
        const yo = yOf(b.o), yc = yOf(b.c), top = Math.min(yo, yc), h = Math.max(1.2, Math.abs(yc - yo));
        if (ct === "hollow" && up) {
          ctx.fillStyle = pal.bg; // hollow: punch through to the card behind
          ctx.fillRect(x - bw / 2, top, bw, h);
          ctx.strokeRect(x - bw / 2 + 0.5, top + 0.5, bw - 1, Math.max(0.5, h - 1));
        } else {
          ctx.fillRect(x - bw / 2, top, bw, h);
        }
      }
    }
    ctx.lineWidth = 1;
  }

  // ── overlays ──
  const line = (arr: Num[], col: string, yf: (v: number) => number, w = 1.6, dash: number[] | null = null) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); let drawing = false;
    for (let i = i0; i <= i1; i++) {
      const v = at(arr, i);
      if (v == null || !isFinite(v)) { drawing = false; continue; }
      const x = xOf(i), y = yf(v);
      if (drawing) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      drawing = true;
    }
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
  };
  for (const s of overlays) {
    const d = computed.get(s.id);
    if (d?.kind === "bb") { line(d.u, s.col, yOf, 1); line(d.lo, s.col, yOf, 1); line(d.mid, s.col, yOf, 1, [4, 4]); }
    else if (d?.kind === "line") line(d.v, s.col, yOf, 1.6, s.k === "vwap" ? [6, 3] : null);
  }

  // ── earnings markers (daily-and-up only; dropped where too dense to read) ──
  const hits: ErHit[] = [];
  let lastEr = -1e9;
  m.erMarks.forEach(({ i }, k) => {
    if (i < i0 || i > i1) return;
    const x = xOf(i);
    if (x < g.l || x > g.r || x - lastEr < 20) return;
    lastEr = x;
    const y = Math.min(yOf(data[i].l) + 16, g.priceB - 8);
    ctx.fillStyle = pal.er; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.erInk; ctx.font = `bold 9px ${pal.font}`; ctx.textAlign = "center";
    ctx.fillText("E", x, y + 0.5); ctx.font = font;
    hits.push({ k, x, y });
  });
  ctx.restore();

  // ── study panes ──
  for (const p of g.panes) drawPane(ctx, p, g, m, i0, i1, xOf, line, at);

  // ── time axis ──
  ctx.fillStyle = pal.text; ctx.textAlign = "center";
  const spanMs = data[i1].t - data[i0].t;
  let lastX = -1e9, prevT: number | null = null;
  for (let i = i0; i <= i1; i++) {
    const x = xOf(i);
    if (x < g.l + 24 || x > g.r - 24 || x - lastX < 80) continue;
    ctx.fillText(axisLabel(data[i].t, m.intraday, prevT, spanMs), x, g.bottom + 16);
    lastX = x; prevT = data[i].t;
  }

  // ── last price ──
  const last = data[n - 1], ly = yOf(last.c);
  if (ly > g.top && ly < g.priceB) {
    ctx.setLineDash([4, 4]); ctx.strokeStyle = pal.last;
    ctx.beginPath(); ctx.moveTo(g.l, ly); ctx.lineTo(g.r, ly); ctx.stroke(); ctx.setLineDash([]);
    tag(ctx, g.r, ly, money(last.c), pal.last, pal.lastInk);
  }

  // ── crosshair ──
  if (hover && hover.i >= i0 && hover.i <= i1) {
    const x = xOf(hover.i);
    ctx.setLineDash([3, 4]); ctx.strokeStyle = pal.cross;
    ctx.beginPath(); ctx.moveTo(x, g.top); ctx.lineTo(x, g.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.l, hover.y); ctx.lineTo(g.r, hover.y); ctx.stroke();
    ctx.setLineDash([]);
    if (hover.y >= g.top && hover.y < g.priceB) {
      const p = useLog
        ? Math.exp(lgHi - ((hover.y - g.top) / ph) * (lgHi - lgLo))
        : hi - ((hover.y - g.top) / ph) * (hi - lo);
      tag(ctx, g.r, hover.y, money(p), pal.tag, pal.tagInk);
    }
    const lbl = crossLabel(data[hover.i].t, m.intraday, m.monthly);
    const tw = ctx.measureText(lbl).width + 16;
    const tx = Math.max(g.l + tw / 2, Math.min(g.r - tw / 2, x));
    ctx.fillStyle = pal.tag; ctx.fillRect(tx - tw / 2, g.bottom + 4, tw, 18);
    ctx.fillStyle = pal.tagInk; ctx.textAlign = "center"; ctx.fillText(lbl, tx, g.bottom + 13);
  }
  return hits;
}

function tag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, bg: string, fg: string) {
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = bg; ctx.fillRect(x + 2, y - 9, w, 18);
  ctx.fillStyle = fg; ctx.textAlign = "left"; ctx.fillText(text, x + 10, y);
}

function drawPane(
  ctx: CanvasRenderingContext2D,
  p: { s: Study; top: number; bot: number },
  g: Geo, m: DrawModel, i0: number, i1: number,
  xOf: (i: number) => number,
  line: (arr: Num[], col: string, yf: (v: number) => number, w?: number, dash?: number[] | null) => void,
  at: (arr: Num[], i: number) => Num | undefined,
) {
  const { pal, data, view } = m;
  const st = p.s, h = p.bot - p.top, span = view.to - view.from;
  ctx.strokeStyle = pal.grid; ctx.strokeRect(g.l, p.top, g.w, h);
  ctx.fillStyle = pal.paneLabel; ctx.textAlign = "left";
  ctx.fillText(studyLabel(st), g.l + 5, p.top + 9);
  ctx.save();
  ctx.beginPath(); ctx.rect(g.l, p.top, g.w, h); ctx.clip();
  const auto = (arrs: Num[][]) => {
    let hi = -Infinity, lo = Infinity;
    for (const a of arrs) for (let i = i0; i <= i1; i++) {
      const v = at(a, i);
      if (v != null && isFinite(v)) { if (v > hi) hi = v; if (v < lo) lo = v; }
    }
    if (!isFinite(hi)) { hi = 1; lo = 0; }
    const pad = (hi - lo) * 0.12 || 1; hi += pad; lo -= pad;
    return (v: number) => p.top + ((hi - v) / (hi - lo)) * h;
  };
  const band = (v: number) => p.top + ((100 - v) / 100) * h;
  const d = m.computed.get(st.id);
  const bandLabels: Array<[number, number]> = [];

  if (st.k === "vol") {
    const step = Math.max(1, Math.floor(span / g.w));
    let mv = 0, sum = 0, cnt = 0;
    for (let i = i0; i <= i1; i += step) { mv = Math.max(mv, data[i].v); sum += data[i].v; cnt++; }
    if (mv > 0) {
      const w = Math.max(1, Math.min(16, (g.w / span) * 0.66));
      ctx.globalAlpha = 0.34;
      for (let i = i0; i <= i1; i += step) {
        const b = data[i], bh = (b.v / mv) * h;
        ctx.fillStyle = b.c >= b.o ? pal.up : pal.down;
        ctx.fillRect(xOf(i) - w / 2, p.bot - bh, w, bh);
      }
      ctx.globalAlpha = 1;
      // average of what is currently on screen
      const avg = sum / cnt, ay = p.bot - (avg / mv) * h;
      ctx.setLineDash([5, 4]); ctx.strokeStyle = pal.avg;
      ctx.beginPath(); ctx.moveTo(g.l, ay); ctx.lineTo(g.r, ay); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `10px ${pal.font}`; ctx.fillStyle = pal.text; ctx.textAlign = "right";
      ctx.fillText(`avg vol ${bigVol(avg)}`, g.r - 6, Math.max(p.top + 8, ay - 6));
      ctx.font = `12px ${pal.font}`;
    }
  } else if ((st.k === "rsi" && d?.kind === "line") || (st.k === "stoch" && d?.kind === "stoch")) {
    const bands: [number, number] = st.k === "rsi" ? [30, 70] : [20, 80];
    ctx.setLineDash([3, 4]); ctx.strokeStyle = pal.band;
    for (const v of bands) { ctx.beginPath(); ctx.moveTo(g.l, band(v)); ctx.lineTo(g.r, band(v)); ctx.stroke(); }
    ctx.setLineDash([]);
    if (d.kind === "line") line(d.v, st.col, band, 1.5);
    else { line(d.k, st.col, band, 1.5); line(d.d, "#f3b24a", band, 1.2); }
    bandLabels.push([bands[1], band(bands[1])], [bands[0], band(bands[0])]);
  } else if (st.k === "macd" && d?.kind === "macd") {
    const y = auto([d.m, d.s, d.h]), zero = y(0);
    ctx.strokeStyle = pal.band; ctx.beginPath(); ctx.moveTo(g.l, zero); ctx.lineTo(g.r, zero); ctx.stroke();
    const w = Math.max(1, Math.min(10, (g.w / span) * 0.55));
    ctx.globalAlpha = 0.55;
    for (let i = i0; i <= i1; i++) {
      const hv = at(d.h, i); if (hv == null) continue;
      const yy = y(hv);
      ctx.fillStyle = hv >= 0 ? pal.up : pal.down;
      ctx.fillRect(xOf(i) - w / 2, Math.min(zero, yy), w, Math.abs(yy - zero));
    }
    ctx.globalAlpha = 1;
    line(d.m, st.col, y, 1.4); line(d.s, "#f3b24a", y, 1.2);
  } else if (st.k === "atr" && d?.kind === "line") {
    line(d.v, st.col, auto([d.v]), 1.5);
  }
  ctx.restore();
  ctx.fillStyle = pal.text; ctx.textAlign = "left";
  for (const [v, y] of bandLabels) ctx.fillText(String(v), g.r + 9, y);
}

/* ══════════════════════════════════════════════════════════════════════
   Small UI pieces
   ══════════════════════════════════════════════════════════════════════ */

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.1 3.9C1.7 4.9.9 7 .9 7s2.1 3.7 6.1 3.7c1 0 1.9-.2 2.6-.6" />
      <path d="M11.6 9.3c.9-.9 1.5-2.3 1.5-2.3S11 3.3 7 3.3c-.6 0-1.1.1-1.6.2" />
      <path d="M5.8 5.8a1.7 1.7 0 0 0 2.4 2.4" /><path d="M2 12 12 2" />
    </svg>
  ) : (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M0.9 7S3 3.3 7 3.3 13.1 7 13.1 7 11 10.7 7 10.7.9 7 .9 7Z" />
      <circle cx="7" cy="7" r="1.8" />
    </svg>
  );
}

/** Focus moves between a menu's items with the arrow keys. */
function menuArrowNav(e: ReactKeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
  if (!items.length) return;
  e.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
  items[next].focus();
}

/**
 * Candle-size picker, grouped Minutes / Hours / Days, as in the design: the
 * button shows the short key (1D), the menu the full name with a check on the
 * active size. The group headings tell "1m" (minute) and "1M" (month) apart.
 */
export function IntervalMenu({ value, onChange }: { value: BarInterval; onChange: (v: BarInterval) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="cc-tools-wrap" ref={wrapRef}>
      <button ref={btnRef} type="button" className="cc-tvbtn" aria-haspopup="menu" aria-expanded={open}
        title={`Candle interval · ${BAR_INTERVAL_LABELS[value]}`} onClick={() => setOpen(o => !o)}>
        <b>{value}</b><span className="cc-caret" aria-hidden="true">▼</span>
      </button>
      {open && (
        <div className="cc-menu" role="menu" aria-label="Candle interval" ref={menuRef} onKeyDown={menuArrowNav}>
          {BAR_INTERVAL_GROUPS.map(([group, ivs], gi) => (
            <div key={group}>
              {gi > 0 && <div className="cc-menu-div" />}
              <h6>{group}</h6>
              {ivs.map(iv => (
                <button key={iv} type="button" role="menuitemradio" aria-checked={iv === value}
                  onClick={() => { onChange(iv); setOpen(false); btnRef.current?.focus(); }}>
                  <span className="cc-tick" aria-hidden="true">✓</span>
                  <span className="cc-grow">{BAR_INTERVAL_LABELS[iv]}</span>
                  <span className="cc-k">{iv}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Settings dialog — length + colour, for adding a study or editing one. */
function StudySettings({ k, study, studies, onCommit, onClose }: {
  k: StudyKind; study: Study | null; studies: readonly Study[];
  onCommit: (len: number | null, col: string) => void; onClose: () => void;
}) {
  const c = cat(k);
  const [len, setLen] = useState(String(study?.len ?? c.param?.def ?? ""));
  const [col, setCol] = useState(study?.col ?? nextStudyColor(k, studies));
  const commit = () => {
    const parsed = parseInt(len, 10);
    const l = c.param ? Math.max(1, Math.min(500, Number.isFinite(parsed) ? parsed : c.param.def)) : null;
    onCommit(l, col);
  };
  return (
    <div className="cc-modal-back sub" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cc-modal sm" role="dialog" aria-modal="true" aria-labelledby="cc-param-title">
        <div className="cc-modal-hd">
          <h3 id="cc-param-title">{study ? "Edit " : ""}{c.alias ?? c.name}</h3>
          <button type="button" className="cc-x" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="cc-param-bd">
          {c.param && (
            <>
              <div className="cc-fld">
                <label htmlFor="cc-param-len">{c.param.label}</label>
                <input id="cc-param-len" type="number" min={1} max={500} step={1} inputMode="numeric" autoFocus
                  value={len} onChange={e => setLen(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />
              </div>
              <div className="cc-chips">
                {c.param.opts.map(o => (
                  <button key={o} type="button" aria-pressed={String(o) === len} onClick={() => setLen(String(o))}>{o}</button>
                ))}
              </div>
            </>
          )}
          <div className="cc-fld col">
            <span>Colour</span>
            <div className="cc-swatches">
              {LINE_PALETTE.map(p => (
                <button key={p} type="button" style={{ background: p, color: p }} aria-pressed={p === col}
                  aria-label={`Colour ${p}`} onClick={() => setCol(p)} />
              ))}
            </div>
          </div>
        </div>
        <div className="cc-modal-ft">
          <button type="button" className="cc-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="cc-btn primary" onClick={commit} autoFocus={!c.param}>{study ? "Update" : "Add to chart"}</button>
        </div>
      </div>
    </div>
  );
}

/** Searchable list of indicators with favourites and an "on chart" count. */
function IndicatorBrowser({ prefs, onPick, onClose }: {
  prefs: ChartPrefs; onPick: (k: StudyKind) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const items = CAT
    .filter(c => !q || `${c.name} ${c.alias ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const favs = new Set(prefs.favs);
  const toggleFav = (k: StudyKind) =>
    writePrefs(p => ({ ...p, favs: p.favs.includes(k) ? p.favs.filter(x => x !== k) : [...p.favs, k] }));
  const row = (c: CatEntry) => {
    const n = c.k ? prefs.studies.filter(s => s.k === c.k).length : 0;
    const fav = !!c.k && favs.has(c.k);
    return (
      <div key={c.name} className={`cc-item${c.k ? "" : " off"}${fav ? " fav" : ""}`}>
        {c.k ? (
          <button type="button" className="cc-star" aria-pressed={fav} aria-label={`${fav ? "Unfavourite" : "Favourite"} ${c.name}`}
            onClick={() => toggleFav(c.k!)}>{fav ? "★" : "☆"}</button>
        ) : <span className="cc-star" aria-hidden="true">☆</span>}
        <button type="button" className="cc-item-main" disabled={!c.k} onClick={() => c.k && onPick(c.k)}>
          {c.col && <span className="cc-swatch" style={{ background: c.col }} />}
          <span>{c.name}</span>
          {c.alias && <span className="cc-alias">{c.alias}</span>}
          {c.badge && <span className={`cc-badge ${c.badge}`}>{c.badge}</span>}
          <span className="cc-right">
            {n ? <span className="cc-on">{n > 1 ? `${n} ` : ""}on chart</span> : c.k ? null : <span className="cc-soon">soon</span>}
          </span>
        </button>
      </div>
    );
  };
  const pinned = items.filter(c => c.k && favs.has(c.k));
  const rest = items.filter(c => !(c.k && favs.has(c.k)));
  return (
    <div className="cc-modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cc-modal" role="dialog" aria-modal="true" aria-labelledby="cc-ind-title">
        <div className="cc-modal-hd">
          <h3 id="cc-ind-title">Technical indicators</h3>
          <button type="button" className="cc-x" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="cc-srch">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="7" cy="7" r="4.6" /><path d="m10.6 10.6 3.4 3.4" />
          </svg>
          <input type="search" placeholder="Search" autoComplete="off" aria-label="Search indicators" autoFocus
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="cc-modal-bd">
          <div className="cc-list">
            {!items.length && <div className="cc-blank"><b>No matches</b>Nothing matches “{query}”.</div>}
            {pinned.length > 0 && <><h6>Favourites</h6>{pinned.map(row)}</>}
            {rest.length > 0 && <><h6>Script name</h6>{rest.map(row)}</>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CandleChart
   ══════════════════════════════════════════════════════════════════════ */

type CandleChartProps = {
  sym: string;
  /** Date-range timeframe (1D…5Y) — the backend picks the bar size. Ignored when `interval` is set. */
  tf: string;
  /** Kept for API compatibility; the chart reads prices from `realBars`. */
  px?: number;
  /** Candle-size mode: `realBars` come from /live/bars?interval=… and are drawn
   *  as-is (no 5Y pool, no warm-up fetch — the backend already returns ~300+
   *  candles). Omit for range mode (`tf`). */
  interval?: BarInterval;
  chartType?: string;
  /** Kept for API compatibility (the legend no longer shows the exchange). */
  exchange?: string;
  /** Real OHLCV bars for this ticker/timeframe, oldest-first. */
  realBars?: OHLCBar[];
  /** Bars are being fetched — shows a loading state instead of "not enough history". */
  loading?: boolean;
  /** Latest live (delayed) quote, folded onto the newest bar while that bar is still forming. */
  live?: { price: number; high: number | null; low: number | null; at?: number | null } | null;
  /** Reported quarters to mark on the chart. Omit (or pass []) to hide them. */
  earnings?: ChartEarnings[];
  /** Hide the legend's OHLC readout (e.g. when the caller shows it elsewhere). */
  hideHudOhlc?: boolean;
  /** Fired whenever the hovered bar (or, with no hover, the latest bar) changes. */
  onBarHover?: (bar: ChartHoverOhlc | null) => void;
  /** Plot height in px. Omit for the stock-detail sizing (560px, shorter on short viewports). */
  height?: number;
  /** Rendered at the start of the chart toolbar — the caller's timeframe / type pickers. */
  toolbarStart?: ReactNode;
  /** Rendered before the toolbar's log / full-screen buttons — vendor chips, freshness stamps. */
  toolbarEnd?: ReactNode;
};

/**
 * BUG-DATA-002: never fabricate a chart. With fewer than two real bars there is
 * nothing honest to plot, so this shows an explicit empty state instead.
 */
export function CandleChart(props: CandleChartProps) {
  if (!props.realBars || props.realBars.length < 2) {
    return (
      <div className="cc">
        {(props.toolbarStart || props.toolbarEnd) && (
          <div className="cc-tools">{props.toolbarStart}<span className="cc-spacer" />{props.toolbarEnd}</div>
        )}
        <DataState loading={props.loading} label="Not enough price history to plot a chart yet." height={props.height ?? 376} />
      </div>
    );
  }
  return <CandleChartInner {...props} />;
}

function CandleChartInner({
  sym, tf, interval, chartType = "candles", realBars, live, earnings = [], hideHudOhlc, onBarHover,
  height, toolbarStart, toolbarEnd,
}: CandleChartProps) {
  const prefs = useChartPrefs();
  const { studies } = prefs;

  /* ── data ─────────────────────────────────────────────────────────── */
  const isDailyTf = !interval && DAILY_TF.has(tf);
  // Daily ranges all read the SAME longest daily series (5Y). Skipped for
  // intraday ranges, interval mode, and when the button already IS 5Y.
  const { bars: poolBars } = useBackendBars(sym, POOL_TF, isDailyTf && tf !== POOL_TF);
  const baseBars = isDailyTf ? (tf === POOL_TF ? realBars : (poolBars ?? realBars)) : realBars;

  const data = useMemo(() => {
    const base = baseBars && baseBars.length > 1 ? baseBars : [];
    if (!(live && live.price > 0 && base.length > 1)) return base;
    // Fold the live price onto the newest bar ONLY while that bar is still
    // forming. Unconditionally overlaying it rewrote a completed candle (pre-
    // market, the last bar is the PREVIOUS session) and could flip its colour.
    // No synthetic bar is ever added: a live quote has no honest open.
    const last = base[base.length - 1];
    const c = live.price;
    if (interval) {
      // Placed by the tick's OWN time: a delayed tick belongs to the candle it
      // traded in. Without one (REST-poll path) nothing is folded — the next
      // bars refetch brings the candle current.
      if (live.at == null || !candleIsOpen(last.t, interval, live.at)) return base;
      // live.high/low are the SESSION's extremes: they fit inside a 1D/1W/1M
      // candle, but would stretch a 5-minute one to the whole day's range.
      const dayRange = !isIntradayInterval(interval);
      const h = Math.max(last.h, c, dayRange ? (live.high ?? c) : c);
      const l = Math.min(last.l, c, dayRange ? (live.low ?? c) : c);
      return [...base.slice(0, -1), { ...last, c, h, l }];
    }
    if (live.at == null || etSessionDate(last.t) !== etSessionDate(live.at)) return base;
    const h = Math.max(last.h, live.high ?? c, c);
    const l = Math.min(last.l, live.low ?? c, c);
    return [...base.slice(0, -1), { ...last, c, h, l }];
  }, [baseBars, live, interval]);

  const n = data.length;
  /** Typical bar spacing: decides intraday vs daily labels, VWAP anchoring and earnings markers. */
  const barMs = useMemo(() => {
    if (n < 2) return 86_400_000;
    const gaps: number[] = [];
    for (let i = Math.max(1, n - 60); i < n; i++) gaps.push(data[i].t - data[i - 1].t);
    gaps.sort((a, b) => a - b);
    return gaps[gaps.length >> 1];
  }, [data, n]);
  const intraday = interval ? isIntradayInterval(interval) : barMs < 20 * 3_600_000;
  const monthly = interval ? interval === "1M" : barMs > 20 * 86_400_000;

  // Range mode only: older same-granularity bars, fetched purely to seed the
  // studies (never drawn) while anything besides volume is on.
  const needsWarmup = studies.some(s => s.k !== "vol");
  const warmupTf = needsWarmup && !isDailyTf && !interval ? MA_WARMUP_TF[tf] : undefined;
  const { bars: warmupSource } = useBackendBars(sym, warmupTf ?? POOL_TF, warmupTf != null);
  const series = useMemo(() => {
    if (!warmupTf || !warmupSource || n === 0) return { bars: data, seed: 0 };
    const firstT = data[0].t;
    // Strictly BEFORE the window so no bar is counted twice; capped at what a
    // 200-period study can use.
    const prior = warmupSource.filter(b => b.t < firstT).slice(-600);
    return { bars: [...prior, ...data], seed: prior.length };
  }, [warmupTf, warmupSource, data, n]);

  const computed = useMemo(() => {
    const out = new Map<string, StudyData>();
    for (const s of studies) out.set(s.id, computeStudy(s, series.bars, intraday));
    return out;
  }, [studies, series, intraday]);

  // Earnings markers sit on daily-and-up bars only: a report is dated by DAY,
  // so it has no honest position among a session's minute bars.
  const erMarks = useMemo(
    () => (intraday ? [] : mapEarningsToBars(data, earnings)),
    [intraday, data, earnings],
  );

  /* ── view (zoom / pan window, in bar indices) ─────────────────────── */
  const initialSpan = interval
    ? Math.min(n, INTERVAL_INITIAL_LEN)
    : isDailyTf ? Math.min(n, DAILY_INITIAL_LEN[tf] ?? n) : n;
  const fitView = useCallback((): View => {
    const s = Math.max(Math.min(MIN_BARS, n), initialSpan);
    return { from: n - s, to: n + s * 0.06 };
  }, [n, initialSpan]);
  const [view, setView] = useState<View>(fitView);
  // Reset on a new ticker / mode; when only new bars arrive, keep the window
  // and — if it was showing the newest bar — slide it along with them.
  // Adjusted during render (remembered-key pattern) so a switch never paints
  // a frame with the previous series' window.
  const viewKey = `${sym}|${interval ?? tf}`;
  const [prevView, setPrevView] = useState({ key: viewKey, n });
  if (prevView.key !== viewKey || prevView.n !== n) {
    setPrevView({ key: viewKey, n });
    if (prevView.key !== viewKey || prevView.n < 2) setView(fitView());
    else if (n > prevView.n && view.to >= prevView.n - 0.5) {
      const d = n - prevView.n;
      setView({ from: view.from + d, to: view.to + d });
    }
  }

  const clampView = useCallback((v: View): View => {
    const s = v.to - v.from;
    if (s >= n) { const slack = (s - n) / 2; return { from: -slack, to: n + slack }; } // whole series fits: centre it
    const room = s * 0.35;
    if (v.to > n + room) return { from: n + room - s, to: n + room };
    if (v.from < -room) return { from: -room, to: -room + s };
    return v;
  }, [n]);

  /* ── canvas, sizing, drawing ──────────────────────────────────────── */
  const rootRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<Hover | null>(null);
  const [erTip, setErTip] = useState<{ k: number; x: number; y: number } | null>(null);
  const erHitsRef = useRef<ErHit[]>([]);
  const [folded, setFolded] = useState(false);
  const [full, setFull] = useState(false);

  useLayoutEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize(s => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }));
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const cv = cvRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx || size.w === 0 || size.h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(size.w * dpr), ph = Math.round(size.h * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    erHitsRef.current = drawChart(ctx, {
      W: size.w, H: size.h, data, seed: series.seed, studies, computed, view, hover,
      chartType: chartType.toLowerCase(), log: prefs.log, intraday, monthly, erMarks,
      pal: readPalette(cv),
    });
  });

  /* ── geometry helpers for pointer math (CSS px) ───────────────────── */
  const plotW = Math.max(1, size.w - PAD.l - PAD.r);
  const idxAt = useCallback((x: number) =>
    Math.round(view.from + ((x - PAD.l) / plotW) * (view.to - view.from) - 0.5), [view, plotW]);

  const zoomAt = useCallback((factor: number, px?: number) => {
    setView(v => {
      const span = v.to - v.from;
      const anchor = v.from + (((px ?? PAD.l + plotW / 2) - PAD.l) / plotW) * span;
      const s = Math.min(Math.max(span * factor, Math.min(MIN_BARS, n)), n * 1.2);
      const ratio = (anchor - v.from) / span;
      const from = anchor - s * ratio;
      return clampView({ from, to: from + s });
    });
  }, [plotW, n, clampView]);

  const pan = useCallback((bars: number) => {
    setView(v => clampView({ from: v.from + bars, to: v.to + bars }));
  }, [clampView]);

  const resetView = useCallback(() => setView(fitView()), [fitView]);

  // Wheel: zoom around the cursor; horizontal / shift-wheel pans. A native
  // non-passive listener — React's synthetic wheel is passive, which drops
  // preventDefault() and scrolls the page instead.
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const x = e.clientX - cv.getBoundingClientRect().left;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setView(v => clampView({ from: v.from + (e.deltaX || e.deltaY) * 0.01 * (v.to - v.from), to: v.to + (e.deltaX || e.deltaY) * 0.01 * (v.to - v.from) }));
      } else zoomAt(e.deltaY > 0 ? 1.05 : 1 / 1.05, x); // gentle step: trackpads fire often
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [zoomAt, clampView]);

  // Drag-to-pan follows the pointer even outside the canvas until release.
  const dragRef = useRef<{ x: number; view: View } | null>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const db = ((e.clientX - d.x) / plotW) * (d.view.to - d.view.from);
      setView(clampView({ from: d.view.from - db, to: d.view.to - db }));
    };
    const onUp = () => { dragRef.current = null; setDragging(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, plotW, clampView]);

  const onCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const i = Math.min(n - 1, Math.max(0, idxAt(mx)));
    setHover(h => (h && h.i === i && h.y === my ? h : { i, y: my }));
    const hit = erHitsRef.current.find(p => Math.hypot(p.x - mx, p.y - my) <= 11);
    setErTip(t => (hit ? (t && t.k === hit.k && t.x === hit.x && t.y === hit.y ? t : { k: hit.k, x: hit.x, y: hit.y }) : null));
  };

  // Touch: one finger pans, two pinch-zoom.
  const touchRef = useRef<{ x: number; view: View; pinch: number | null } | null>(null);
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const onStart = (e: TouchEvent) => {
      const t = e.touches;
      touchRef.current = t.length === 2
        ? { x: (t[0].clientX + t[1].clientX) / 2, view, pinch: Math.abs(t[0].clientX - t[1].clientX) }
        : { x: t[0].clientX, view, pinch: null };
    };
    const onMove = (e: TouchEvent) => {
      const s = touchRef.current; if (!s) return;
      e.preventDefault();
      const t = e.touches, span = s.view.to - s.view.from;
      if (s.pinch != null && t.length === 2) {
        const d = Math.max(1, Math.abs(t[0].clientX - t[1].clientX));
        const ns = Math.min(Math.max((span * s.pinch) / d, Math.min(MIN_BARS, n)), n * 1.2);
        const mid = (s.view.from + s.view.to) / 2;
        setView(clampView({ from: mid - ns / 2, to: mid + ns / 2 }));
      } else if (s.pinch == null && t.length === 1) {
        const db = ((t[0].clientX - s.x) / plotW) * span;
        setView(clampView({ from: s.view.from - db, to: s.view.to - db }));
      }
    };
    const onEnd = () => { touchRef.current = null; };
    cv.addEventListener("touchstart", onStart, { passive: true });
    cv.addEventListener("touchmove", onMove, { passive: false });
    cv.addEventListener("touchend", onEnd);
    return () => {
      cv.removeEventListener("touchstart", onStart);
      cv.removeEventListener("touchmove", onMove);
      cv.removeEventListener("touchend", onEnd);
    };
  }, [view, n, plotW, clampView]);

  /* ── full screen: native API where allowed, fixed overlay otherwise ── */
  const toggleFull = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!full) {
      el.requestFullscreen?.().catch(() => { /* overlay fallback below still applies */ });
      setFull(true);
    } else {
      if (document.fullscreenElement === el) document.exitFullscreen().catch(() => {});
      setFull(false);
    }
  }, [full]);
  useEffect(() => {
    if (!full) return;
    const onFsChange = () => { if (!document.fullscreenElement) setFull(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.fullscreenElement) setFull(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("keydown", onKey);
    document.body.classList.add("cc-locked");
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("cc-locked");
    };
  }, [full]);

  const onCanvasKey = (e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const span = view.to - view.from;
    const act: Record<string, () => void> = {
      ArrowLeft: () => pan(-span * 0.1), ArrowRight: () => pan(span * 0.1),
      "+": () => zoomAt(1 / 1.15), "=": () => zoomAt(1 / 1.15), "-": () => zoomAt(1.15),
      "0": resetView, f: toggleFull, F: toggleFull,
    };
    const fn = act[e.key];
    if (fn) { e.preventDefault(); fn(); }
  };

  /* ── studies: browser, settings, legend actions ───────────────────── */
  const [browserOpen, setBrowserOpen] = useState(false);
  const [editing, setEditing] = useState<{ k: StudyKind; study: Study | null } | null>(null);
  const indBtnRef = useRef<HTMLButtonElement>(null);
  // Dialogs portal out of the card (a hovered .card is transformed, which
  // would trap position:fixed) into the themed .iq-root — or into the chart
  // itself while it is full screen, the only subtree the browser then shows.
  const [modalHost, setModalHost] = useState<Element | null>(null);
  const resolveHost = () => {
    const root = rootRef.current;
    const host = !root ? null : full ? root : (root.closest(".iq-root") ?? document.body);
    setModalHost(host);
  };
  const openBrowser = () => { resolveHost(); setBrowserOpen(true); };
  const openSettings = (k: StudyKind, study: Study | null) => { resolveHost(); setEditing({ k, study }); };

  const pickStudy = (k: StudyKind) => {
    if (cat(k).param) { openSettings(k, null); return; } // pick a length first
    // no settings: straight toggle
    writePrefs(p => {
      const has = p.studies.find(s => s.k === k);
      return has
        ? { ...p, studies: p.studies.filter(s => s.id !== has.id) }
        : { ...p, studies: [...p.studies, { id: newStudyId(k), k, len: null, col: nextStudyColor(k, p.studies), on: true }] };
    });
  };
  const commitStudy = (len: number | null, col: string) => {
    const ed = editing; if (!ed) return;
    writePrefs(p => ({
      ...p,
      studies: ed.study
        ? p.studies.map(s => (s.id === ed.study!.id ? { ...s, len, col } : s))
        : [...p.studies, { id: newStudyId(ed.k), k: ed.k, len, col, on: true }],
    }));
    setEditing(null);
  };
  const toggleStudy = (id: string) =>
    writePrefs(p => ({ ...p, studies: p.studies.map(s => (s.id === id ? { ...s, on: !s.on } : s)) }));
  const dropStudy = (id: string) =>
    writePrefs(p => ({ ...p, studies: p.studies.filter(s => s.id !== id) }));
  const closeBrowser = useCallback(() => { setBrowserOpen(false); indBtnRef.current?.focus(); }, []);

  useEffect(() => {
    if (!browserOpen && !editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editing) setEditing(null); else closeBrowser();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [browserOpen, editing, closeBrowser]);

  /* ── legend readings ──────────────────────────────────────────────── */
  const hoverIdx = hover && hover.i >= 0 && hover.i < n ? hover.i : null;
  const di = hoverIdx ?? n - 1;
  const bar = data[di], prev = data[Math.max(0, di - 1)];
  const chg = bar.c - prev.c, chgPct = prev.c ? (chg / prev.c) * 100 : 0;
  const studyVal = (s: Study): string | null => {
    const d = computed.get(s.id), i = di + series.seed;
    if (s.k === "vol") return bigVol(bar.v);
    if (!d) return null;
    switch (d.kind) {
      case "line": return f2(d.v[i]);
      case "bb": return d.u[i] == null ? null : `${f2(d.u[i])} · ${f2(d.lo[i])}`;
      case "macd": return d.m[i] == null ? null : `${f2(d.m[i])} / ${f2(d.s[i])}`;
      case "stoch": return d.k[i] == null ? null : `${f2(d.k[i])} / ${f2(d.d[i])}`;
      default: return null;
    }
  };

  // Parent OHLC readout (e.g. a toolbar) — the hovered bar, else the latest.
  useEffect(() => {
    onBarHover?.({ o: bar.o, h: bar.h, l: bar.l, c: bar.c, pctChg: bar.o > 0 ? ((bar.c - bar.o) / bar.o) * 100 : 0 });
  }, [onBarHover, bar]);

  /* ── earnings tooltip ─────────────────────────────────────────────── */
  const tip = erTip && erMarks[erTip.k] ? (() => {
    const { i, e } = erMarks[erTip.k];
    const surp = e.epsActual != null && e.epsEstimate != null && e.epsEstimate !== 0
      ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100 : null;
    // Reaction bar: an after-close report trades on the NEXT session.
    const r = e.session && /amc|after/i.test(e.session) ? i + 1 : i;
    const d1 = !monthly && barMs < 2 * 86_400_000 && r > 0 && r < n ? ((data[r].c - data[r - 1].c) / data[r - 1].c) * 100 : null;
    const sgn = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
    const eps = (v: number | null | undefined) => (v == null ? "—" : `$${v.toFixed(2)}`);
    const dt = new Date(`${e.date}T12:00:00Z`);
    const left = Math.max(84, Math.min(size.w - 84, erTip.x));
    const top = erTip.y + 16 + 74 > size.h ? erTip.y - 78 : erTip.y + 16;
    return (
      <div className="cc-er-tip" style={{ left, top }} role="tooltip">
        <span>
          <span className="d">{dt.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" })} &apos;{String(dt.getUTCFullYear()).slice(2)}</span>
          {surp != null && <> · <b className={surp >= 0 ? "up" : "down"}>{surp >= 0 ? "beat" : "miss"} {sgn(surp)}</b></>}
        </span>
        <span>EPS <b>{eps(e.epsActual)}</b> vs {eps(e.epsEstimate)} est</span>
        {d1 != null && <span>Next day <b className={d1 >= 0 ? "up" : "down"}>{sgn(d1)}</b></span>}
      </div>
    );
  })() : null;

  return (
    <div ref={rootRef} className={`cc${full ? " is-full" : ""}`}>
      <div className="cc-tools">
        {toolbarStart}
        {toolbarStart && <span className="cc-tool-sep" />}
        <button ref={indBtnRef} type="button" className="cc-tvbtn" onClick={openBrowser}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M1.5 11.5 5 7l3 2.5L14.5 3" /><path d="M1.5 14.5h13" />
          </svg>
          Indicators
        </button>
        <span className="cc-hint">scroll to zoom · drag to pan · double-click to reset</span>
        <span className="cc-spacer" />
        {toolbarEnd}
        <button type="button" className="cc-tvbtn cc-log" aria-pressed={prefs.log}
          title="Logarithmic price scale (turns on by itself for very wide ranges)"
          onClick={() => writePrefs(p => ({ ...p, log: !p.log }))}>Log</button>
        <button type="button" className="cc-tvbtn icon" aria-pressed={full}
          title={full ? "Exit full screen (F)" : "Full screen (F)"}
          aria-label={full ? "Exit full screen" : "Expand chart to full screen"} onClick={toggleFull}>
          {full ? (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M1.5 5.5H6V1M14.5 5.5H10V1M1.5 10.5H6V15M14.5 10.5H10V15" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 1.5H1.5V6M10 1.5h4.5V6M6 14.5H1.5V10M10 14.5h4.5V10" />
            </svg>
          )}
        </button>
      </div>

      <div className={`cc-stage${height == null ? " responsive" : ""}`}
        style={height != null && !full ? { height } : undefined}>
        <div className={`cc-hud${folded ? " folded" : ""}`}>
          <div className="cc-lg-hd">
            <span className="cc-lg-id">
              {studies.length > 0 && (
                <button type="button" className="cc-lg-fold" aria-expanded={!folded}
                  title={folded ? "Show indicators" : "Hide indicators"} aria-label={folded ? "Show indicators" : "Hide indicators"}
                  onClick={() => setFolded(f => !f)}>{folded ? "▲" : "▼"}</button>
              )}
            </span>
            {!hideHudOhlc && (
              <span className="cc-lg-q">
                <span><s>O</s><b>{bar.o.toFixed(2)}</b></span>
                <span><s>H</s><b>{bar.h.toFixed(2)}</b></span>
                <span><s>L</s><b>{bar.l.toFixed(2)}</b></span>
                <span><s>C</s><b>{bar.c.toFixed(2)}</b></span>
                <span className={chg >= 0 ? "up" : "down"}>
                  {chg >= 0 ? "+" : ""}{chg.toFixed(2)} ({chg >= 0 ? "+" : ""}{chgPct.toFixed(2)}%)
                </span>
              </span>
            )}
          </div>
          {studies.map(s => {
            const v = s.on ? studyVal(s) : null;
            const label = studyLabel(s);
            const editable = !!cat(s.k).param;
            return (
              <div key={s.id} className={`cc-lg-row${s.on ? "" : " hidden"}`}>
                <i style={{ background: s.col }} />
                <span className={`n${editable ? " edit" : ""}`} role={editable ? "button" : undefined} tabIndex={editable ? 0 : undefined}
                  title={editable ? "Settings" : undefined}
                  onClick={editable ? () => openSettings(s.k, s) : undefined}
                  onKeyDown={editable ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSettings(s.k, s); } } : undefined}>
                  {label}
                </span>
                <span className="v" title={v == null && s.on && s.len ? `Not enough history yet (needs ${s.len} bars)` : undefined}>
                  {s.on ? (v ?? "—") : ""}
                </span>
                <span className="cc-acts">
                  <button type="button" className="eye" aria-pressed={s.on}
                    title={s.on ? "Hide on chart" : "Show on chart"} aria-label={`${s.on ? "Hide" : "Show"} ${label}`}
                    onClick={() => toggleStudy(s.id)}><EyeIcon off={!s.on} /></button>
                  <button type="button" className="del" title="Remove" aria-label={`Remove ${label}`}
                    onClick={() => dropStudy(s.id)}>✕</button>
                </span>
              </div>
            );
          })}
        </div>
        <canvas
          ref={cvRef}
          tabIndex={0}
          aria-label={`${sym} price chart. Use arrow keys to pan, plus and minus to zoom, F for full screen.`}
          style={{ cursor: dragging ? "grabbing" : erTip ? "pointer" : "crosshair" }}
          onMouseDown={e => { if (e.button === 0) { dragRef.current = { x: e.clientX, view }; setDragging(true); setErTip(null); } }}
          onMouseMove={onCanvasMove}
          onMouseLeave={() => { setHover(null); setErTip(null); }}
          onDoubleClick={resetView}
          onKeyDown={onCanvasKey}
        />
        {tip}
      </div>

      {modalHost && browserOpen && createPortal(
        <IndicatorBrowser prefs={prefs} onPick={pickStudy} onClose={closeBrowser} />, modalHost)}
      {modalHost && editing && createPortal(
        <StudySettings key={editing.study?.id ?? editing.k} k={editing.k} study={editing.study} studies={studies}
          onCommit={commitStudy} onClose={() => setEditing(null)} />, modalHost)}
    </div>
  );
}
