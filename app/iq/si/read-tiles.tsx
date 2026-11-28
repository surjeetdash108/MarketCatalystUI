"use client";

import type { CSSProperties, ReactNode } from "react";
import { highlightNumbers } from "./read-cards";
import type { Read } from "./si-reads";

/** The tiles, the lead sentence and the levels strip of the Overview's Fundamentals and Technicals panels. */

const UP = "#4ade80";
const DN = "#f05656";
const STEEL = "#7fa8d0";
const CAUTION = "#f5b031";
const MANROPE = "'Manrope', sans-serif";
const MONO = "'JetBrains Mono', monospace";
const INTER = "var(--font-inter, 'Inter'), system-ui, sans-serif";
const MUTED = "var(--si-text-mid, #93a1af)";
const HI = "var(--si-text-hi, #e8eef4)";

const dirColor = (dir: Read["dir"]) => (dir === "up" ? UP : dir === "down" ? DN : STEEL);
const dirGlyph = (dir: Read["dir"]) => (dir === "up" ? "▲" : dir === "down" ? "▼" : "▬");

/** The one-sentence read above the tiles. */
export function LeadLine({ text }: { text: string }) {
  return <div style={{ fontFamily: MANROPE, fontSize: 17, fontWeight: 600, lineHeight: 1.5, color: HI, paddingLeft: 0 }}>{highlightNumbers(text)}</div>;
}

function ReadTile({ read, glow, chart, title }: { read: Read; glow?: boolean; chart?: ReactNode; title?: string }) {
  const color = read.caution ? CAUTION : dirColor(read.dir);
  return (
    <div style={{ border: "1px solid var(--si-border, #232830)", borderRadius: 6, background: "var(--si-card, rgba(20, 23, 28, 0.9))", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span
          style={
            glow
              ? { fontFamily: MANROPE, fontSize: 16, fontWeight: 700, letterSpacing: "0.01em", color: "#6db3ff", textShadow: "0 0 10px rgba(79,163,255,0.375), 0 0 22px rgba(79,163,255,0.175)" }
              : { fontFamily: MANROPE, fontSize: 13.5, fontWeight: 600, letterSpacing: "0.01em", color: MUTED }
          }
        >
          {title ?? read.k}
        </span>
        <span style={{ fontFamily: MANROPE, fontSize: 20, fontWeight: 750, lineHeight: 1.2, color, textAlign: "right", whiteSpace: "nowrap" }}>
          <span aria-hidden="true" style={{ fontSize: 12, marginRight: 7 }}>{read.caution ? "◆" : dirGlyph(read.dir)}</span>
          {read.headline}
        </span>
      </span>
      {chart ?? <span style={{ fontFamily: MANROPE, fontSize: 15, lineHeight: 1.45, color: HI }}>{highlightNumbers(read.detail)}</span>}
    </div>
  );
}

/** The reads as tiles in a grid (two across for four, otherwise up to three). `chartFor` draws a chart in place of a tile's sentence. */
export function ReadTiles({ reads, glow, chartFor }: { reads: Read[]; glow?: boolean; chartFor?: (read: Read) => ReactNode | undefined }) {
  const columns = reads.length === 4 ? 2 : Math.max(1, Math.min(reads.length, 3));
  const hasValuation = reads.some((r) => r.k === "Valuation");
  return (
    <div className="si-tiles" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 12 }}>
      {reads.map((r) => (
        <ReadTile key={r.k} read={r} glow={glow} chart={chartFor?.(r)} title={r.k === "Analysts" ? (hasValuation ? "Analyst targets" : "Valuation") : undefined} />
      ))}
    </div>
  );
}

/** Where the row of labels under the ruler bar starts, and how wide (px, with a little air) each label is. */
const LABEL_ROW = 82;
const END_W = 84;
const SUPPORT_W = 120;
const RESISTANCE_W = 128;

export type RulerLevel = { value: number; pct: number };
export type RulerProps = {
  price: number;
  low52: number | null;
  high52: number | null;
  support: RulerLevel | null;
  resistance: RulerLevel | null;
  /** The top analysts' average target and median (or the single mean target, with no median). */
  target: { avg: number; median: number | null; n: number | null } | null;
  money: (v: number) => string;
};

/** Where the price sits between the 52-week low and high, with the nearest support and resistance and the analysts' target. */
export function LevelsRuler({ price, low52, high52, support, resistance, target, money }: RulerProps) {
  if (low52 == null || high52 == null || !(high52 > low52)) return null;
  const at = (v: number) => Math.max(0, Math.min(100, ((v - low52) / (high52 - low52)) * 100));
  const avg = target?.avg ?? null;
  const upside = avg != null ? (avg / price - 1) * 100 : null;
  const targetColor = avg != null && avg < price ? DN : UP;
  const label = (color: string): CSSProperties => ({ fontFamily: MONO, fontSize: 13, fontWeight: 700, color, whiteSpace: "nowrap" });
  const sub: CSSProperties = { fontFamily: INTER, fontSize: 12, color: MUTED, whiteSpace: "nowrap" };
  const legend = [
    { k: "low", v: money(low52), sub: "52W low", c: HI },
    ...(support ? [{ k: "sup", v: money(support.value), sub: `Support · ${support.pct.toFixed(1)}%`, c: "#fb923c" }] : []),
    ...(resistance ? [{ k: "res", v: money(resistance.value), sub: `Resistance · +${resistance.pct.toFixed(1)}%`, c: UP }] : []),
    { k: "high", v: money(high52), sub: "52W high", c: HI },
  ];
  const targetBox = (className: string, style: CSSProperties) =>
    avg != null && upside != null && (
      <div
        className={className}
        style={{ ...style, display: "flex", flexDirection: "column", gap: 2, border: `1px solid color-mix(in srgb, ${targetColor} 40%, transparent)`, background: `color-mix(in srgb, ${targetColor} 8%, transparent)`, borderRadius: 10, padding: "8px 12px", boxSizing: "border-box" }}
      >
        <span style={{ fontFamily: INTER, fontSize: 12, color: MUTED }}>{target?.n ? `Top ${target.n} analysts avg target` : "Avg target"}</span>
        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: targetColor, overflowWrap: "anywhere" }}>
          {money(avg)} {"·"} {upside >= 0 ? "+" : ""}
          {upside.toFixed(1)}%
          {target?.median != null && <span style={{ marginLeft: 6, fontWeight: 600, whiteSpace: "nowrap", color: HI }}>(median {money(target.median)})</span>}
        </span>
      </div>
    );
  const targetAt = avg != null && avg < price ? `min(${at(avg)}%, calc(${at(price)}% - 210px))` : `max(${at(avg ?? price)}%, calc(${at(price)}% + 210px))`;

  return (
    <div className="si-ruler" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <style>{".si-ruler .si-rl-flow{display:none !important}@media (max-width:640px){.si-ruler .si-rl-abs{display:none !important}.si-ruler .si-rl-leg{display:grid !important}.si-ruler .si-rl-track{height:84px !important}.si-ruler .si-rl-flow{display:flex !important;width:100%}}"}</style>
      <div className="si-rl-track" style={{ position: "relative", height: LABEL_ROW + 38, margin: "0 6px" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 62, height: 6, borderRadius: 3, background: "var(--si-border, #243140)" }} />
        {support && resistance && (
          <div style={{ position: "absolute", left: `${at(support.value)}%`, width: `${Math.max(1.5, at(resistance.value) - at(support.value))}%`, top: 52, height: 26, borderRadius: 5, background: "rgba(96,165,250,0.14)", border: "1px dashed #60a5fa" }} />
        )}
        {avg != null && avg !== price && (
          <div style={{ position: "absolute", left: `${Math.min(at(price), at(avg))}%`, width: `${Math.abs(at(avg) - at(price))}%`, top: 63, height: 4, backgroundImage: `repeating-linear-gradient(90deg, ${targetColor} 0 5px, transparent 5px 10px)`, opacity: 0.6 }} />
        )}
        {avg != null && (
          <div title={`Analysts' average target ${money(avg)}`} style={{ position: "absolute", left: `${at(avg)}%`, top: 48, width: 3, height: 34, background: targetColor, transform: "translateX(-50%)", boxShadow: `0 0 8px 1px ${targetColor}` }} />
        )}
        <span style={{ position: "absolute", left: `clamp(54px, ${at(price)}%, calc(100% - 54px))`, top: 0, transform: "translateX(-50%)", padding: "3px 8px", borderRadius: 5, background: "#e6edf3", color: "#0b0f14", fontFamily: MONO, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
          NOW {money(price)}
        </span>
        <div style={{ position: "absolute", left: `${at(price)}%`, top: 24, width: 2, height: 38, background: "#e6edf3", transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", left: `${at(price)}%`, top: 59, width: 12, height: 12, borderRadius: "50%", background: "#e6edf3", border: "3px solid var(--si-card-sec, #0b0f14)", boxSizing: "border-box", transform: "translateX(-50%)" }} />
        {targetBox("si-rl-abs", { position: "absolute", top: 0, width: 310, left: `clamp(155px, ${targetAt}, calc(100% - 155px))`, transform: "translateX(-50%)" })}
        {/* The four labels under the bar (52W low, support, resistance, 52W high) share one row. Support and
            resistance follow their levels, but not into the room the two end labels need, so a level close to the
            52-week low or high never prints over them. */}
        {support && (
          <div className="si-rl-abs" style={{ position: "absolute", left: `max(${at(support.value)}%, ${END_W + SUPPORT_W}px)`, top: LABEL_ROW, transform: "translateX(-100%)", paddingRight: 5, textAlign: "right", display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={label("#fb923c")}>{money(support.value)}</span>
            <span style={sub}>Support {"·"} {support.pct.toFixed(1)}%</span>
          </div>
        )}
        {resistance && (
          <div className="si-rl-abs" style={{ position: "absolute", left: `min(${at(resistance.value)}%, calc(100% - ${END_W + RESISTANCE_W}px))`, top: LABEL_ROW, paddingLeft: 5, display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={label(UP)}>{money(resistance.value)}</span>
            <span style={sub}>Resistance {"·"} +{resistance.pct.toFixed(1)}%</span>
          </div>
        )}
        <div className="si-rl-abs" style={{ position: "absolute", left: 0, top: LABEL_ROW, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ ...label(HI), fontWeight: 600 }}>{money(low52)}</span>
          <span style={sub}>52W low</span>
        </div>
        <div className="si-rl-abs" style={{ position: "absolute", right: 0, top: LABEL_ROW, textAlign: "right", display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ ...label(HI), fontWeight: 600 }}>{money(high52)}</span>
          <span style={sub}>52W high</span>
        </div>
      </div>
      <div className="si-rl-leg" style={{ display: "none", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 14px" }}>
        {legend.map((l) => (
          <div key={l.k} style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ ...label(l.c), fontWeight: 600 }}>{l.v}</span>
            <span style={sub}>{l.sub}</span>
          </div>
        ))}
      </div>
      {targetBox("si-rl-flow", { alignSelf: "flex-end", maxWidth: "100%" })}
    </div>
  );
}
