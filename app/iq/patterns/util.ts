import type { PBar } from "./types";

export const body = (b: PBar) => Math.abs(b.c - b.o);
export const range = (b: PBar) => b.h - b.l;
export const upper = (b: PBar) => b.h - Math.max(b.o, b.c);
export const lower = (b: PBar) => Math.min(b.o, b.c) - b.l;
export const up = (b: PBar) => b.c > b.o;
export const down = (b: PBar) => b.c < b.o;
export const top = (b: PBar) => Math.max(b.o, b.c);
export const bot = (b: PBar) => Math.min(b.o, b.c);
export const mid = (b: PBar) => (b.o + b.c) / 2;

/** Rolling context computed once per bar series. */
export interface Ctx {
  bars: PBar[];
  /** Mean body / range of the 10 bars before i (i itself excluded). */
  avgBody: number[];
  avgRange: number[];
  /** Wilder ATR(14) at i (simple mean of true range while warming up). */
  atr: number[];
  /** 10-bar simple average of the close at i. */
  sma10: number[];
  /** Mean volume of the 20 bars before i (NaN without volume). */
  avgVol: number[];
}

export function context(bars: PBar[]): Ctx {
  const n = bars.length;
  const avgBody = new Array<number>(n).fill(NaN), avgRange = new Array<number>(n).fill(NaN);
  const atr = new Array<number>(n).fill(NaN), sma10 = new Array<number>(n).fill(NaN), avgVol = new Array<number>(n).fill(NaN);
  let tr = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i], p = bars[i - 1];
    const t = p ? Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c)) : b.h - b.l;
    tr = i < 14 ? (tr * i + t) / (i + 1) : (tr * 13 + t) / 14;
    atr[i] = tr;
    if (i >= 1) {
      const k = Math.min(10, i);
      let sb = 0, sr = 0;
      for (let j = i - k; j < i; j++) { sb += body(bars[j]); sr += range(bars[j]); }
      avgBody[i] = sb / k;
      avgRange[i] = sr / k;
    }
    if (i >= 9) {
      let s = 0;
      for (let j = i - 9; j <= i; j++) s += bars[j].c;
      sma10[i] = s / 10;
    }
    if (i >= 1) {
      const k = Math.min(20, i);
      let s = 0, ok = true;
      for (let j = i - k; j < i; j++) { const v = bars[j].v; if (v == null || !Number.isFinite(v)) { ok = false; break; } s += v; }
      avgVol[i] = ok ? s / k : NaN;
    }
  }
  return { bars, avgBody, avgRange, atr, sma10, avgVol };
}

/**
 * Trend going into bar i, from the bar before it: "down" when that close is
 * below its 10-bar average and below the close five bars earlier; "up" for the
 * mirror; otherwise "flat". Candlestick reversal patterns need the trend they
 * reverse.
 */
export function trendInto(x: Ctx, i: number): "up" | "down" | "flat" {
  const j = i - 1;
  if (j < 9 || j - 5 < 0) return "flat";
  const c = x.bars[j].c, a = x.sma10[j], c5 = x.bars[j - 5].c;
  if (c < a && c < c5) return "down";
  if (c > a && c > c5) return "up";
  return "flat";
}

/** "Same price" tolerance for equal highs / lows / closes: 5% of the average range (min 0.05% of price). */
export const sameTol = (x: Ctx, i: number) => Math.max(0.05 * (x.avgRange[i] || range(x.bars[i])), 0.0005 * x.bars[i].c);

/** Doji: body at most 10% of the bar's range. */
export const isDoji = (b: PBar) => range(b) > 0 && body(b) <= 0.1 * range(b);
/** Long candle: body at least the 10-bar average body and at least half its range. */
export const isLong = (x: Ctx, i: number) => {
  const b = x.bars[i];
  return body(b) >= (x.avgBody[i] || 0) && range(b) > 0 && body(b) >= 0.5 * range(b);
};
/** Small body: at most half the 10-bar average body. */
export const isSmall = (x: Ctx, i: number) => body(x.bars[i]) <= 0.5 * (x.avgBody[i] || body(x.bars[i]));
