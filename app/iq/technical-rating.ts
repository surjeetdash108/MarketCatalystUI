/**
 * Technical rating computed from one candle series — the same candles the
 * price chart is showing — so switching the chart's interval re-rates on that
 * basis (1 minute … 1 month). Method follows the stock-detail design:
 *
 *   - 8 oscillators and 12 moving averages each vote buy / sell / neutral;
 *   - score = (buy − sell) / votes, in −1…1;
 *   - bands: > 0.5 Strong Buy, > 0.1 Buy, < −0.5 Strong Sell, < −0.1 Sell,
 *     else Neutral — the same boundaries the gauge draws, so the needle always
 *     lands in the band the label names.
 *
 * An indicator without enough candles yet (e.g. SMA 200 on ~60 monthly
 * candles) reads "–" and votes neutral rather than being guessed.
 */

import { adx, awesome, cci, ema, macd, rsi, sma, stoch, willr, type Num, type OHLCBar } from "./indicators";

export type Vote = "buy" | "sell" | "neutral";
export type RatingLabel = "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell";

export interface RatingRow { name: string; value: string | null; vote: Vote }
export interface Tally { buy: number; neutral: number; sell: number }

export interface TechnicalRating {
  /** Candles the rating was computed from. */
  count: number;
  oscillators: RatingRow[];
  movingAverages: RatingRow[];
  osc: Tally; ma: Tally; all: Tally;
  /** −1…1, for the gauge needle. */
  score: number;
  label: RatingLabel;
}

/** Fewest candles worth rating — below this most oscillators have no reading at all. */
export const MIN_RATING_BARS = 30;

export const tally = (rows: RatingRow[]): Tally => ({
  buy: rows.filter(r => r.vote === "buy").length,
  neutral: rows.filter(r => r.vote === "neutral").length,
  sell: rows.filter(r => r.vote === "sell").length,
});

export const scoreOf = (t: Tally): number => (t.buy - t.sell) / Math.max(1, t.buy + t.neutral + t.sell);

export function labelOf(score: number): RatingLabel {
  return score > 0.5 ? "Strong Buy" : score > 0.1 ? "Buy" : score < -0.5 ? "Strong Sell" : score < -0.1 ? "Sell" : "Neutral";
}

const fmt = (v: Num | undefined) => (v == null || !isFinite(v) ? null : v.toFixed(2));

/** Buy below `lo`, sell above `hi` (inverted: sell below, buy above). */
const band = (v: Num | undefined, lo: number, hi: number, inverted = false): Vote =>
  v == null ? "neutral" : v < lo ? (inverted ? "sell" : "buy") : v > hi ? (inverted ? "buy" : "sell") : "neutral";

export function computeTechnicalRating(bars: OHLCBar[]): TechnicalRating | null {
  const n = bars.length;
  if (n < MIN_RATING_BARS) return null;
  const last = n - 1, c = bars[last].c;

  const R = rsi(bars, 14)[last];
  const K = stoch(bars, 14).k[last];
  const M = macd(bars);
  const A = adx(bars, 14)[last];
  const AO = awesome(bars)[last];
  const CC = cci(bars, 20)[last];
  const WR = willr(bars, 14)[last];
  const mom = n > 10 ? c - bars[last - 10].c : null;
  const m = M.m[last], s = M.s[last];

  const oscillators: RatingRow[] = [
    { name: "Relative Strength Index (14)", value: fmt(R), vote: band(R, 30, 70) },
    { name: "Stochastic %K (14, 3, 3)", value: fmt(K), vote: band(K, 20, 80) },
    { name: "MACD Level (12, 26)", value: fmt(m), vote: m == null || s == null ? "neutral" : m > s ? "buy" : "sell" },
    { name: "Average Directional Index (14)", value: fmt(A?.adx), vote: !A || A.adx < 20 ? "neutral" : A.pDI > A.nDI ? "buy" : "sell" },
    { name: "Awesome Oscillator", value: fmt(AO), vote: AO == null ? "neutral" : AO > 0 ? "buy" : "sell" },
    { name: "Momentum (10)", value: fmt(mom), vote: mom == null ? "neutral" : mom > 0 ? "buy" : "sell" },
    { name: "Commodity Channel Index (20)", value: fmt(CC), vote: band(CC, -100, 100, true) },
    { name: "Williams Percent Range (14)", value: fmt(WR), vote: band(WR, -80, -20) },
  ];

  const movingAverages: RatingRow[] = [];
  for (const p of [10, 20, 30, 50, 100, 200]) {
    const e = ema(bars, p)[last], sm = sma(bars, p)[last];
    movingAverages.push({ name: `Exponential Moving Average (${p})`, value: fmt(e), vote: e == null ? "neutral" : c > e ? "buy" : "sell" });
    movingAverages.push({ name: `Simple Moving Average (${p})`, value: fmt(sm), vote: sm == null ? "neutral" : c > sm ? "buy" : "sell" });
  }

  const osc = tally(oscillators), ma = tally(movingAverages);
  const all = { buy: osc.buy + ma.buy, neutral: osc.neutral + ma.neutral, sell: osc.sell + ma.sell };
  const score = scoreOf(all);
  return { count: n, oscillators, movingAverages, osc, ma, all, score, label: labelOf(score) };
}
