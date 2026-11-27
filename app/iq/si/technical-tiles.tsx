"use client";

import type { ReactNode } from "react";
import { InfoTip } from "./read-cards";
import { UP, DN, usd, type SiFacts } from "./data";
import type { Level } from "./si-reads";

/**
 * The Technicals tab's top row (Trend, Momentum, 52W High, Risk) and the price ladder beside the chart,
 * from the redesign. The tile words and colours come from the engine's own reads; the line under each
 * says which figure it rests on.
 */

const BLUE = "#4fb3ff";

/** How each tile is worked out (shown by its "i" button). */
export const TECH_TILE_INFO: [string, string][] = [
  ["Trend:", "Bullish if price is above both the 50 and 200 DMA, Bearish if below both, otherwise Mixed."],
  ["Momentum:", "From 14-day RSI. 70+ Overbought, 55–70 Strong, 45–55 Neutral, 30–45 Weak, under 30 Oversold."],
  ["52W High:", "How far price sits below its 52-week high. Within 3% reads as at / near the high."],
  ["Risk:", "From 30-day realized volatility. 50%+ High, 30–50% Elevated, under 30% Moderate."],
];

export type TileRead = { k: string; v: string; col: string };

/** The tile names as written on screen (the engine's keys are upper case). */
const TILE_LABEL: Record<string, string> = { TREND: "Trend", MOMENTUM: "Momentum", "52W HIGH": "52W High", RISK: "Risk" };

const strong = (text: string, color: string) => (
  <span style={{ color, fontWeight: 700 }}>{text}</span>
);

function sideOf(a: number | null | undefined, b: number | null | undefined) {
  return a != null && b != null ? (a >= b ? "above" : "below") : null;
}

/** The line under a tile: the figures it rests on, coloured, or why there are none. */
function tileLine(key: string, f: SiFacts, high52: number | null): ReactNode {
  if (key === "TREND") {
    const s50 = sideOf(f.price, f.sma50);
    const s200 = sideOf(f.price, f.sma200);
    if (f.price == null || f.sma50 == null || f.sma200 == null || !s50 || !s200) return "Not enough price history";
    return (
      <>
        Price {strong(s50, s50 === "above" ? UP : DN)} the 50 DMA and {strong(s200, s200 === "above" ? UP : DN)} the 200 DMA
      </>
    );
  }
  if (key === "MOMENTUM") return f.rsi14 != null ? <>RSI {strong(f.rsi14.toFixed(0), BLUE)} on the 14-day</> : "RSI unavailable";
  if (key === "52W HIGH") return high52 != null ? <>52-week high {strong(usd(high52), BLUE)}</> : "52-week high unavailable";
  if (key === "RISK") return f.realizedVol30 != null ? <>{strong(`${f.realizedVol30.toFixed(0)}%`, BLUE)} 30-day realized volatility</> : "Volatility unavailable";
  return null;
}

export function TechnicalTiles({ reads, facts, high52 }: { reads: ReadonlyArray<TileRead>; facts: SiFacts; high52: number | null }) {
  const keys = ["TREND", "MOMENTUM", "52W HIGH", "RISK"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
      {keys.map((key) => {
        const read = reads.find((r) => r.k === key);
        const color = read ? read.col : "var(--si-text-mid, #93a1af)";
        return (
          <div
            key={key}
            style={{ border: `1px solid ${color}`, background: "var(--si-card, rgba(20, 23, 28, 0.9))", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center" }}>
                <span data-tc style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.14em", color: "var(--si-text-white, #ffffff)", opacity: 0.7 }}>
                  {TILE_LABEL[key]}
                </span>
                <InfoTip lines={TECH_TILE_INFO.filter(([name]) => name.toUpperCase().startsWith(key))} />
              </span>
              <span style={{ fontSize: 24, fontWeight: 800, color, textAlign: "right" }}>{read ? read.v : "No data"}</span>
            </span>
            <span style={{ fontSize: 17, color: "var(--si-text-white, #ffffff)", lineHeight: 1.5 }}>{tileLine(key, facts, high52)}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Where the price sits among its nearest levels: resistance above (furthest first), the price in a box, support
 * below (nearest first), each with its distance from the price drawn as a bar scaled to the furthest one shown.
 */
export function PriceLadder({ price, supports, resistances, max = 3 }: { price: number | null; supports: Level[]; resistances: Level[]; max?: number }) {
  if (price == null || (!supports.length && !resistances.length)) {
    return <div style={{ fontSize: 13.5, color: "var(--si-text-mid, #93a1af)" }}>Not enough price history to place support and resistance yet.</div>;
  }
  const above = resistances.slice(0, max).reverse();
  const below = supports.slice(0, max);
  const scale = Math.max(1, ...[...above, ...below].map((l) => Math.abs(l.pct)));
  const row = (level: Level, nearest: boolean) => {
    const color = level.kind === "support" ? UP : DN;
    return (
      <div
        key={level.label}
        style={{ flex: 1, display: "grid", gridTemplateColumns: "92px 104px minmax(40px, 1fr) 70px", alignItems: "center", gap: 14, padding: "12px 0", minHeight: 44, opacity: nearest ? 1 : 0.85 }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color, letterSpacing: "0.03em" }}>{level.label}</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{usd(level.value)}</span>
        <span style={{ display: "block", height: 8, borderRadius: 4, background: "var(--si-card-tert, #232830)" }}>
          <span style={{ display: "block", height: 8, borderRadius: 4, width: `${(Math.abs(level.pct) / scale) * 100}%`, background: color, opacity: nearest ? 1 : 0.6 }} />
        </span>
        <span style={{ fontSize: 15, fontWeight: 600, color, textAlign: "right" }}>
          {level.pct >= 0 ? "+" : ""}
          {level.pct.toFixed(1)}%
        </span>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {above.map((l, i) => row(l, i === above.length - 1))}
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0", padding: "14px 16px", border: "1px solid var(--si-accent, #5980a6)", background: "var(--si-accent-bg, rgba(89,128,166,0.14))" }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", color: "var(--si-accent-light, #a9c6e3)" }}>PRICE</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{usd(price)}</span>
      </div>
      {below.map((l, i) => row(l, i === 0))}
    </div>
  );
}
