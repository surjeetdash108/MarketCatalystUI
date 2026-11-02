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
