/**
 * The Money Flow pop-up's "Full Chart": the stock screen's zoomable chart with
 * only the pop-up's six layers on it. This file turns a bar series into what
 * the Order blocks, FVG, Liquidity and Structure layers draw, as plain shapes in
 * bar-index / price space; CandleChart paints them. VWAP and Patterns are the
 * chart's own VWAP study and pattern overlay, so they produce nothing here.
 *
 * The detection is the pop-up's (engine.ts), so both charts mark the same
 * blocks, gaps and swings. Over a multi-day series the session-anchored parts
 * of Structure (day range, EQ, opening range, HOD/LOD, PDH/PDL) use the latest
 * session; swings, BOS and the other layers use the whole series. On 1D / 1W /
 * 1M candles there is no session to anchor to, so Structure keeps only the
 * swing tags, BOS and the price pattern.
 */
import { etSessionDate } from "../indicators";
import { computeFvgs, computeOrderBlocks, computeSwings, formatCurrency, type PopTf, type SwingPoint } from "./engine";

type Bar = { t: number; o: number; h: number; l: number; c: number; v: number };

export interface SmcLayers { ob: boolean; vwap: boolean; fvg: boolean; liq: boolean; str: boolean; pat: boolean }

/**
 * A shape to paint. `i0`/`i1` are bar indices; a box spans from the left edge
 * of bar i0 to the left edge of bar i1, a line from the centre of i0 to the
 * centre of i1. `null` means the left edge of the plot (i0) or its right edge
 * (i1, still running).
 */
export type SmcOp =
  | { k: "box"; i0: number; i1: number | null; lo: number; hi: number; rgb: string; fill: number; stroke: number; dash: boolean; label?: string; labelBelow?: boolean }
  | { k: "line"; i0: number | null; i1: number | null; p: number; color: string; width: number; alpha: number; dash: number[]; label?: string; at?: "start" | "mid" | "end"; below?: boolean }
  | { k: "text"; i: number; p: number; text: string; color: string; below: boolean }
  | { k: "badge"; text: string; color: string };

/** Backend candle size for a pop-up timeframe; 3m has none, so it is grouped from 1m. */
export function fullChartInterval(tf: PopTf): { interval: "1m" | "5m" | "15m" | "1D" | "1W" | "1M"; group: number } {
  if (typeof tf === "string") return { interval: tf, group: 1 };
  if (tf === 5) return { interval: "5m", group: 1 };
  if (tf === 15) return { interval: "15m", group: 1 };
  return { interval: "1m", group: tf === 3 ? 3 : 1 };
}

/**
 * Groups oldest-first 1-minute bars into `minutes`-minute candles. Buckets are
 * whole multiples of `minutes` since the epoch; for 3 that lines up with 9:30 ET
 * (ET is a whole number of hours off UTC, and 570 is a multiple of 3).
 */
export function groupBars<B extends Bar>(bars: B[], minutes: number): Bar[] {
  if (minutes <= 1) return bars;
  const ms = minutes * 60_000, out: Bar[] = [];
  let key = NaN;
  for (const b of bars) {
    const k = Math.floor(b.t / ms);
    const cur = out[out.length - 1];
    if (k !== key || !cur) {
      out.push({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
      key = k;
    } else {
      cur.h = Math.max(cur.h, b.h);
      cur.l = Math.min(cur.l, b.l);
      cur.c = b.c;
      cur.v += b.v;
    }
  }
  return out;
}

const MAX_OB = 12, MAX_LIQ = 10, MAX_SWING_TAGS = 30, MAX_BOS = 4;

export function smcOverlays(bars: Bar[], layers: SmcLayers, tf: PopTf): SmcOp[] {
  const ops: SmcOp[] = [];
  const n = bars.length;
  if (n < 3) return ops;
  const swingN = typeof tf === "string" ? 3 : tf <= 3 ? 4 : tf >= 15 ? 2 : 3;
  const swings = layers.liq || layers.str ? computeSwings(bars, swingN) : [];

  if (layers.ob) {
    for (const b of computeOrderBlocks(bars).slice(-MAX_OB)) {
      const rgb = b.bull ? "61,220,132" : "240,86,90";
      ops.push({
        k: "box", i0: b.i, i1: b.mit ? b.end + 1 : null, lo: b.lo, hi: b.hi, rgb,
        fill: b.mit ? 0.06 : 0.16, stroke: b.mit ? 0.3 : 0.85, dash: b.mit,
        label: b.mit ? undefined : b.bull ? "BULL OB" : "BEAR OB", labelBelow: b.bull,
      });
    }
  }

  if (layers.fvg) {
    for (const g of computeFvgs(bars)) {
      const rgb = g.bull ? "90,169,230" : "230,120,190";
      ops.push({
        k: "box", i0: g.i, i1: g.end != null ? g.end + 1 : null, lo: g.lo, hi: g.hi, rgb,
        fill: g.end != null ? 0.07 : 0.2, stroke: g.end != null ? 0.35 : 0.8, dash: true,
        label: g.end == null ? "FVG" : undefined,
      });
    }
  }

  if (layers.liq) {
    for (const p of swings.slice(-MAX_LIQ)) {
      let sw: number | null = null;
      for (let j = p.i + 1; j < n; j++) {
        if (p.hi ? bars[j].h > p.p : bars[j].l < p.p) { sw = j; break; }
      }
      const color = p.hi ? "#f0a24a" : "#4ad0c9";
      ops.push(sw == null
        ? { k: "line", i0: p.i, i1: null, p: p.p, color, width: 1.2, alpha: 0.9, dash: [1, 3], label: `${p.hi ? "BSL" : "SSL"} ${formatCurrency(p.p)}`, at: "end", below: !p.hi }
        : { k: "line", i0: p.i, i1: sw, p: p.p, color, width: 0.8, alpha: 0.45, dash: [1, 3], label: "✕ swept", at: "mid", below: !p.hi });
    }
  }

  if (layers.str) structure(bars, swings, tf, ops);
  return ops;
}

/** Structure layer: latest-session range, EQ, opening range, HOD/LOD, PDH/PDL (intraday only); swing tags, BOS, the price pattern. */
function structure(bars: Bar[], swings: SwingPoint[], tf: PopTf, ops: SmcOp[]) {
  if (typeof tf === "number") sessionStructure(bars, tf, ops);
  swingStructure(bars, swings, ops);
}

/** The session-anchored part of Structure, on intraday candles of `tf` minutes. */
function sessionStructure(bars: Bar[], tf: number, ops: SmcOp[]) {
  const n = bars.length;
  const dates = bars.map((b) => etSessionDate(b.t));
  const today = dates[n - 1];
  let s0 = n - 1;
  while (s0 > 0 && dates[s0 - 1] === today) s0--;
  const day = bars.slice(s0);
  const hiAll = Math.max(...day.map((b) => b.h)), loAll = Math.min(...day.map((b) => b.l));
  const eq = (hiAll + loAll) / 2;

  ops.push({ k: "box", i0: s0, i1: null, lo: eq, hi: hiAll, rgb: "240,86,90", fill: 0.035, stroke: 0, dash: false, label: "PREMIUM", labelBelow: false });
  ops.push({ k: "box", i0: s0, i1: null, lo: loAll, hi: eq, rgb: "61,220,132", fill: 0.035, stroke: 0, dash: false, label: "DISCOUNT", labelBelow: true });
  ops.push({ k: "line", i0: s0, i1: null, p: eq, color: "rgba(230,235,232,.6)", width: 1, alpha: 0.6, dash: [1, 4], label: "EQ 50%", at: "end" });

  // Previous session's high / low, when the series reaches back that far.
  if (s0 > 0) {
    const prevDate = dates[s0 - 1];
    let p0 = s0 - 1;
    while (p0 > 0 && dates[p0 - 1] === prevDate) p0--;
    const prev = bars.slice(p0, s0);
    const pdh = Math.max(...prev.map((b) => b.h)), pdl = Math.min(...prev.map((b) => b.l));
    ops.push({ k: "line", i0: p0, i1: null, p: pdh, color: "#9aa7ff", width: 1, alpha: 0.6, dash: [2, 5], label: `PDH ${formatCurrency(pdh)}`, at: "start" });
    ops.push({ k: "line", i0: p0, i1: null, p: pdl, color: "#9aa7ff", width: 1, alpha: 0.6, dash: [2, 5], label: `PDL ${formatCurrency(pdl)}`, at: "start", below: true });
  }

  // Opening range: the session's first 30 minutes.
  const orb = day.slice(0, Math.max(1, Math.round(30 / tf)));
  const orh = Math.max(...orb.map((b) => b.h)), orl = Math.min(...orb.map((b) => b.l));
  ops.push({ k: "box", i0: s0, i1: s0 + orb.length, lo: orl, hi: orh, rgb: "201,162,74", fill: 0.08, stroke: 0.4, dash: false });
  ops.push({ k: "line", i0: s0, i1: null, p: orh, color: "#c9a24a", width: 1, alpha: 0.5, dash: [3, 3], label: `ORH $${formatCurrency(orh)}`, at: "end" });
  ops.push({ k: "line", i0: s0, i1: null, p: orl, color: "#c9a24a", width: 1, alpha: 0.5, dash: [3, 3], label: `ORL $${formatCurrency(orl)}`, at: "end", below: true });

  const ih = s0 + day.findIndex((b) => b.h === hiAll), il = s0 + day.findIndex((b) => b.l === loAll);
  ops.push({ k: "text", i: ih, p: hiAll, text: `▼ HOD $${formatCurrency(hiAll)}`, color: "#f0565a", below: false });
  ops.push({ k: "text", i: il, p: loAll, text: `▲ LOD $${formatCurrency(loAll)}`, color: "#3ddc84", below: true });
}

/** Swing tags (HH / HL / LH / LL), breaks of structure and the price pattern, over the whole series. */
function swingStructure(bars: Bar[], swings: SwingPoint[], ops: SmcOp[]) {
  const n = bars.length;
  const sorted = swings.slice().sort((a, b) => a.i - b.i);
  let lH: SwingPoint | null = null, lL: SwingPoint | null = null;
  const tags: SmcOp[] = [];
  for (const p of sorted) {
    let tag: string;
    if (p.hi) { tag = lH == null ? "H" : p.p > lH.p ? "HH" : "LH"; lH = p; }
    else { tag = lL == null ? "L" : p.p > lL.p ? "HL" : "LL"; lL = p; }
    const color = tag === "HH" || tag === "HL" ? "#3ddc84" : tag === "LH" || tag === "LL" ? "#f0565a" : "#aab3b0";
    tags.push({ k: "text", i: p.i, p: p.p, text: tag, color, below: !p.hi });
  }
  ops.push(...tags.slice(-MAX_SWING_TAGS));

  const ev: Array<{ p: SwingPoint; j: number }> = [];
  for (const p of sorted) {
    for (let j = p.i + 3; j < n; j++) {
      if (p.hi ? bars[j].c > p.p : bars[j].c < p.p) { ev.push({ p, j }); break; }
    }
  }
  for (const e of ev.slice(-MAX_BOS)) {
    ops.push({ k: "line", i0: e.p.i, i1: e.j, p: e.p.p, color: e.p.hi ? "#3ddc84" : "#f0565a", width: 1.2, alpha: 0.85, dash: [], label: "BOS", at: "mid", below: !e.p.hi });
  }

  // The price pattern from the last two swing highs and lows (same rule as the pop-up).
  const SH = sorted.filter((p) => p.hi), SL = sorted.filter((p) => !p.hi);
  if (SH.length >= 2 && SL.length >= 2) {
    const slope = (a: SwingPoint, b: SwingPoint) => (b.p - a.p) / (b.i - a.i || 1);
    const s1 = slope(SH[SH.length - 2], SH[SH.length - 1]), s2 = slope(SL[SL.length - 2], SL[SL.length - 1]);
    const flat = bars[n - 1].c * 0.00002;
    const text =
      s1 < 0 && s2 > 0 ? "SYMMETRICAL TRIANGLE"
      : s1 < 0 && s2 < 0 && s1 < s2 ? "FALLING WEDGE"
      : s1 > 0 && s2 > 0 && s2 > s1 ? "RISING WEDGE"
      : Math.abs(s1) < flat && s2 > 0 ? "ASCENDING TRIANGLE"
      : s1 < 0 && Math.abs(s2) < flat ? "DESCENDING TRIANGLE"
      : s1 > 0 && s2 > 0 ? "ASCENDING CHANNEL"
      : s1 < 0 && s2 < 0 ? "DESCENDING CHANNEL"
      : "RANGE";
    ops.push({ k: "badge", text, color: "#3ddc84" });
  }
}
