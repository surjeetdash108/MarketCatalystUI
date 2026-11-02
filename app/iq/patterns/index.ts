import { detectBars, detectGaps } from "./bars";
import { detectCandles } from "./candles";
import { CATALOG, NOT_DETECTED, patternRule } from "./catalog";
import { detectEvents, detectFlags, detectLinePatterns, detectRounding, detectSwingPatterns } from "./chart";
import { detectHarmonics } from "./harmonics";
import { detectSetups } from "./setups";
import { zigzag } from "./swings";
import type { DetectOptions, PatternHit, PBar } from "./types";
import { context } from "./util";

export type { DetectOptions, PatternHit, PBar } from "./types";
export { CATALOG, NOT_DETECTED, patternRule };

/** Every pattern in the bars, ordered by the bar it completes on. */
export function detectPatterns(bars: PBar[], opt: DetectOptions = {}): PatternHit[] {
  const clean = bars.filter((b) => [b.o, b.h, b.l, b.c].every((v) => Number.isFinite(v)) && b.h >= b.l);
  if (clean.length < 3) return [];
  const x = context(clean), s = zigzag(x, 1.5);
  return dedupe([
    ...detectCandles(x),
    ...detectBars(x, opt),
    ...detectGaps(x),
    ...detectSwingPatterns(x, s),
    ...detectLinePatterns(x, s),
    ...detectFlags(x, opt),
    ...detectRounding(x),
    ...detectEvents(x, opt),
    ...detectSetups(x, s, opt),
    ...detectHarmonics(x, s),
  ]).sort((a, b) => a.i1 - b.i1 || a.i0 - b.i0);
}

/** The same multi-bar pattern found from overlapping swing windows is reported once: the longest. */
function dedupe(hits: PatternHit[]): PatternHit[] {
  const one = hits.filter((h) => h.group === "candle" || h.group === "bar");
  const many = hits.filter((h) => h.group !== "candle" && h.group !== "bar").sort((a, b) => b.i1 - b.i0 - (a.i1 - a.i0));
  const kept: PatternHit[] = [];
  for (const h of many) {
    const dup = kept.some((k) => k.id === h.id && Math.min(k.i1, h.i1) - Math.max(k.i0, h.i0) > 0.5 * Math.max(1, h.i1 - h.i0));
    if (!dup) kept.push(h);
  }
  return [...one, ...kept];
}

/**
 * What to draw in a chart window [from, to]: the latest few candlestick / bar
 * marks (they are frequent) plus up to `others` larger patterns overlapping
 * the window — chart patterns first, then harmonics, setups and gaps.
 */
export function patternsToShow(hits: PatternHit[], from: number, to: number, opts: { candles?: number; others?: number } = {}): PatternHit[] {
  const nC = opts.candles ?? 6, nO = opts.others ?? 6;
  const inView = hits.filter((h) => h.i1 >= from && h.i0 <= to);
  const small = inView.filter((h) => h.group === "candle" || h.group === "bar");
  // Larger patterns: chart patterns first, then harmonics, setups and gaps, newest first within each.
  const order: Record<string, number> = { chart: 0, harmonic: 1, setup: 2, gap: 3 };
  const big = inView.filter((h) => h.group !== "candle" && h.group !== "bar").sort((a, b) => order[a.group] - order[b.group] || b.i1 - a.i1);
  // One mark per bar for candles: the longest pattern ending there.
  const perBar = new Map<number, PatternHit>();
  for (const h of small) { const cur = perBar.get(h.at); if (!cur || h.i1 - h.i0 > cur.i1 - cur.i0) perBar.set(h.at, h); }
  return [...[...perBar.values()].sort((a, b) => a.at - b.at).slice(-nC), ...big.slice(0, nO)];
}

export const signalColor = (sig: PatternHit["signal"]) => (sig === "bull" ? "#3ddc84" : sig === "bear" ? "#f0565a" : "#7fa8d0");
export const patternTitle = (h: PatternHit) => `${h.name}${h.confirmed === false ? " (forming)" : ""} — ${patternRule(h.id)}`;
export const catalogSize = () => Object.keys(CATALOG).length;

export interface PatternGlyphs {
  color: string;
  title: string;
  lines: Array<{ i0: number; p0: number; i1: number; p1: number; dash: number[] }>;
  points: Array<{ i: number; p: number; label: string }>;
  /** The name tag: at bar `i`, price `p`; above the bar for bearish / neutral, below for bullish. */
  label: { i: number; p: number; text: string; above: boolean };
}

/** How a hit is drawn on any chart: colour by signal, dashed pattern lines, swing labels and a name tag. */
export function patternGlyphs(h: PatternHit): PatternGlyphs {
  const dash = (role: string) => (role === "level" ? [2, 3] : role === "leg" ? [] : [5, 4]);
  return {
    color: signalColor(h.signal),
    title: patternTitle(h),
    lines: (h.lines ?? []).map((l) => ({ i0: l.i0, p0: l.p0, i1: l.i1, p1: l.p1, dash: dash(l.role) })),
    points: h.points ?? [],
    label: { i: h.at, p: h.price, text: h.name + (h.confirmed === false ? " (forming)" : ""), above: h.signal !== "bull" },
  };
}

/**
 * Name-tag placement: tags that would overlap an earlier one are moved away
 * from their bar (up for tags above the bar, down for tags below) until free.
 */
export function layoutLabels<T extends { x: number; y: number; w: number; h: number; above: boolean }>(boxes: T[]): T[] {
  const placed: T[] = [];
  const hits = (a: T, b: T) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const b0 of boxes) {
    const b = { ...b0 };
    for (let k = 0; k < 40 && placed.some((p) => hits(p, b)); k++) b.y += b.above ? -(b.h + 2) : b.h + 2;
    placed.push(b);
  }
  return placed;
}
