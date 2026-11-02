/**
 * Pattern detection shared by the Money Flow hover chart and the Market
 * Catalyst stock chart. Pure functions over OHLC(V) bars; every rule is a
 * fixed, documented definition (catalog.ts) applied the same way to every
 * stock — nothing is tuned to a ticker.
 */

export interface PBar {
  t?: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export type PatternGroup = "candle" | "bar" | "gap" | "chart" | "setup" | "harmonic";
export type PatternSignal = "bull" | "bear" | "either";

/** A line to draw, in bar index / price space. */
export interface PatternLine {
  i0: number;
  p0: number;
  i1: number;
  p1: number;
  role: "trend" | "neckline" | "level" | "target" | "leg";
}

export interface PatternHit {
  /** Catalog id (catalog.ts) — name, signal and the rule text come from there. */
  id: string;
  name: string;
  group: PatternGroup;
  signal: PatternSignal;
  /** First and last bar of the pattern. */
  i0: number;
  i1: number;
  /** Where the marker sits: bar index and price (above the bar for bearish, below for bullish). */
  at: number;
  price: number;
  lines?: PatternLine[];
  points?: Array<{ i: number; p: number; label: string }>;
  /** Chart patterns: true once price closed through the confirming line. */
  confirmed?: boolean;
  /** Measured-move target where the rule defines one. */
  target?: number | null;
}

export interface DetectOptions {
  /** Bars are one day or longer (enables daily-only setups such as Darvas boxes and flat bases). */
  daily?: boolean;
  /** Bars are weekly (enables horn / pipe and weekly reversals). */
  weekly?: boolean;
}
