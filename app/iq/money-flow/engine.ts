/**
 * Money Flow — view helpers over the backend board (GET /live/money-flow).
 *
 * Every number comes from the board: the backend computes flows, levels and
 * scores from intraday bars (FMP first, Polygon as fallback) and FMP quotes
 * (money-flow.calc.ts, where each basis
 * is documented and returned as `board.basis`). This file only formats, maps
 * and lays out; the popover chart's 1/3/5/15-minute candles are grouped here
 * from real 1-minute bars.
 */

import { normalizeSector } from "../sector-filter";

// ── Board payload (mirrors the backend's MoneyFlowBoard) ────────────────────

export interface PivotLevels {
  pivot: number | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
}

export interface BoardBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vwap: number;
}

export interface BoardStock {
  t: string;
  name: string | null;
  sector: string | null;
  inSp500: boolean;
  inNasdaq100: boolean;
  price: number;
  prevClose: number;
  pctChange: number;
  marketCap: number | null;
  dayVolume: number | null;
  avgVolume20: number | null;
  rvol: number | null;
  vwap: number | null;
  netFlow: number;
  buyPct: number | null;
  m30: number | null;
  vsSector: number | null;
  chop: boolean;
  pivots: PivotLevels | null;
  prevHigh: number | null;
  prevLow: number | null;
  zone: { lo: number; hi: number; startT: number } | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  rr: number | null;
  confidence: { score: number; parts: Array<[string, number, number]> } | null;
  bars: BoardBar[];
}

export interface BoardSector {
  name: string;
  netFlow: number;
  inflow: number;
  outflow: number;
  buyPct: number | null;
  avgPct: number;
  count: number;
}

export interface MoneyFlowBoard {
  asOf: string;
  sessionDate: string;
  prevSessionDate: string | null;
  sessionComplete: boolean;
  barsThrough: number | null;
  delayMinutes: number;
  universe: { sp500: number; nasdaq100: number; total: number; priced: number; withBars: number };
  breadth: { advancers: number; decliners: number; unchanged: number; total: number };
  sectors: BoardSector[];
  gainers: BoardStock[];
  losers: BoardStock[];
  basis: Record<string, string>;
}

// ── Formatting ──────────────────────────────────────────────────────────────

type LevelName = `R${number}` | `S${number}`;

/**
 * Classic pivots out to R5/S5 — TradingView "Pivot Points Standard",
 * Traditional type. The board sends P, R1–R3, S1–S3; the session high and low
 * are recovered from them (R1 = 2P − L, S1 = 2P − H) for R4/R5 and S4/S5.
 */
export function extendedPivots(p: PivotLevels): Record<"R1" | "R2" | "R3" | "R4" | "R5" | "S1" | "S2" | "S3" | "S4" | "S5", number | null> {
  return {
    R1: pivotLevel(p, "R", 1), R2: pivotLevel(p, "R", 2), R3: pivotLevel(p, "R", 3), R4: pivotLevel(p, "R", 4), R5: pivotLevel(p, "R", 5),
    S1: pivotLevel(p, "S", 1), S2: pivotLevel(p, "S", 2), S3: pivotLevel(p, "S", 3), S4: pivotLevel(p, "S", 4), S5: pivotLevel(p, "S", 5),
  };
}

/**
 * Level n on one side. R1–R3 / S1–S3 are the board's own; beyond them the
 * Traditional formulas follow one rule — from R2 up, R_n = H + (n − 1)(P − L),
 * and from S2 down, S_n = L − (n − 1)(H − P) — which gives R4/R5 and S4/S5 and
 * keeps going past them at the same step, so a stock that gaps past R5 still
 * has levels above it. Null when the inputs are missing or degenerate.
 */
export function pivotLevel(p: PivotLevels, side: "R" | "S", n: number): number | null {
  const own = side === "R" ? [p.r1, p.r2, p.r3][n - 1] : [p.s1, p.s2, p.s3][n - 1];
  if (own != null && Number.isFinite(own)) return own;
  const P = p.pivot;
  if (P == null || p.r1 == null || p.s1 == null || ![P, p.r1, p.s1].every(Number.isFinite)) return null;
  const H = 2 * P - p.s1, L = 2 * P - p.r1;
  if (n === 1) return side === "R" ? 2 * P - L : 2 * P - H;
  return side === "R" ? H + (n - 1) * (P - L) : L - (n - 1) * (H - P);
}

/** A level as shown: its name counted from the current price, and the classic level it is. */
export interface LiveLevel { name: "R1" | "R2" | "S1" | "S2"; v: number; from: LevelName }

/** How far up / down the ladder to look for levels beyond price. */
const MAX_LEVEL = 400;

/**
 * Always two resistances above price and two supports below it, each side
 * renumbered on its own: once price touches or passes R1, R2 is shown as R1
 * and R3 as R2 (on past R5 with the same step, see pivotLevel); once price
 * touches or passes S1, S2 is shown as S1 and S3 as S2. Crossing one side
 * never renames the other. Ordered top to bottom: R2, R1, S1, S2.
 */
export function liveLevels(p: PivotLevels | null | undefined, price: number): LiveLevel[] {
  if (!p || !Number.isFinite(price)) return [];
  const pick = (side: "R" | "S") => {
    const out: Array<{ v: number; from: LevelName }> = [];
    for (let n = 1; n <= MAX_LEVEL && out.length < 2; n++) {
      const v = pivotLevel(p, side, n);
      if (v == null || v <= 0) break; // no data, or below zero on the way down
      if (side === "R" ? v > price : v < price) out.push({ v, from: `${side}${n}` });
    }
    return out.map((l, i) => ({ name: `${side}${i + 1}` as LiveLevel["name"], v: l.v, from: l.from }));
  };
  return [...pick("R").reverse(), ...pick("S")];
}

/**
 * The hover chart's frame: the price area only. The right column (R1/R2/S1/S2
 * boxes and the last-price tag, `gutter` wide) sits outside it, inside the pop-up.
 */
export const chartFrame = (w: number, h: number, gutter: number) => ({ x: 0, y: 0, w: w - gutter, h });

/**
 * Fixed rows for the pop-up chart's levels: R2 then R1 at the top, S1 then S2
 * at the bottom, whatever their values. They never move; only the names and
 * values in them change as price crosses a level (liveLevels). The candles are
 * scaled into `band`, between R1 and S1. With pattern callouts on (`laneH` > 0)
 * a lane of that height sits between each pair of rows and the candles.
 */
export function popLevelRows(top: number, bottom: number, rowH: number, laneH = 0, laneBottomH = laneH) {
  const edge = rowH * 0.5;
  const r2 = top + edge, r1 = r2 + rowH, s2 = bottom - edge, s1 = s2 - rowH;
  const laneT = laneH ? laneH + 8 : 0, laneB = laneBottomH ? laneBottomH + 8 : 0;
  return {
    y: { R2: r2, R1: r1, S1: s1, S2: s2 } as Record<LiveLevel["name"], number>,
    band: { top: r1 + edge + laneT, bottom: s1 - edge - laneB },
    lanes: {
      top: [r1 + edge, r1 + edge + laneH] as [number, number],
      bottom: [s1 - edge - laneBottomH, s1 - edge] as [number, number],
    },
  };
}

/** Rows a callout lane needs per side: as many callouts as are in view on it, at most two. */
export function calloutLaneRows(labels: Array<{ above: boolean }>): { above: number; below: number } {
  const up = labels.filter((l) => l.above).length, down = labels.length - up;
  const rows = (n: number) => (n > 2 ? 2 : n > 0 ? 1 : 0);
  return { above: rows(up), below: rows(down) };
}

export interface EdgeLabelIn { price: number; name: string; color: string }
export interface EdgeLabelOut { y: number; text: string; color: string; offScale: "above" | "below" | null }

/** A label drawn inside the chart (zone, order block, FVG, swing tag, BOS …). `y` is its baseline. */
export interface ChartLabel {
  key: string;
  text: string;
  x: number;
  y: number;
  fz: number;
  anchor: "start" | "middle" | "end";
  color: string;
  /** Which way to move it first if it collides: -1 up (labels above their line), 1 down. */
  dir: -1 | 1;
  /** Set by declutterLabels when no free spot is left: the label is not drawn. */
  hidden?: boolean;
}

/**
 * In-chart labels from several overlays (order blocks, VWAP, FVG, liquidity,
 * structure) were each placed on their own and printed over one another. Each
 * label, in the order given, keeps its spot if free; otherwise it steps one
 * line at a time in its preferred direction, then the other, until it touches
 * no label already placed — staying inside the plot; with no free spot left it
 * is marked hidden and not drawn. Text is pulled back from the left / right edges. `fixed` boxes (e.g. the right-edge price tags) are
 * avoided but never moved.
 */
export type LabelBox = { x0: number; x1: number; y0: number; y1: number };
export function declutterLabels(items: ChartLabel[], b: { top: number; bottom: number; left: number; right: number }, gap = 2, fixed: LabelBox[] = []): ChartLabel[] {
  type Box = LabelBox;
  const placed: Box[] = [...fixed];
  const hits = (a: Box) => placed.some((p) => a.x0 < p.x1 && p.x0 < a.x1 && a.y0 < p.y1 && p.y0 < a.y1);
  return items.map((l) => {
    const w = l.text.length * l.fz * 0.62, asc = l.fz * 0.8, desc = l.fz * 0.2, step = l.fz + gap;
    let x0 = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
    x0 = Math.max(b.left, Math.min(b.right - w, x0));
    const x = l.anchor === "start" ? x0 : l.anchor === "end" ? x0 + w : x0 + w / 2;
    const inside = (yb: number) => yb - asc >= b.top && yb + desc <= b.bottom;
    const boxAt = (yb: number): Box => ({ x0, x1: x0 + w, y0: yb - asc, y1: yb + desc });
    const y0 = Math.max(b.top + asc, Math.min(b.bottom - desc, l.y));
    const tries = [y0];
    for (let k = 1; k <= 40; k++) tries.push(y0 + l.dir * k * step, y0 - l.dir * k * step);
    const yb = tries.find((t) => inside(t) && !hits(boxAt(t)));
    // No free spot in a crowded plot: leave it out rather than print it over another label.
    if (yb == null) return { ...l, x, y: y0, hidden: true };
    placed.push(boxAt(yb));
    return { ...l, x, y: yb };
  });
}

/**
 * The chart's right-edge labels (BSL / SSL, ORH / ORL, PDH / PDL, HOD / LOD,
 * EQ): labels at the same price become one ("ORL · LOD · SSL $143.65"); a
 * level beyond the candles' scale is pinned to the edge of the price area with
 * ▲ / ▼ instead of being hidden (the scale stays fitted to the candles); then
 * they are pushed apart by `gap` so none overlap, inside [top, bottom].
 */
export function layoutEdgeLabels(labels: EdgeLabelIn[], y: (p: number) => number, top: number, bottom: number, gap: number): EdgeLabelOut[] {
  const groups = new Map<string, { price: number; names: string[]; color: string }>();
  for (const l of labels) {
    if (!Number.isFinite(l.price)) continue;
    const key = l.price.toFixed(2);
    const g = groups.get(key);
    if (!g) groups.set(key, { price: l.price, names: [l.name], color: l.color });
    else if (!g.names.includes(l.name)) g.names.push(l.name);
  }
  const out: EdgeLabelOut[] = [...groups.values()].map((g) => {
    const raw = y(g.price);
    const offScale = raw < top ? "above" : raw > bottom ? "below" : null;
    const text = `${offScale === "above" ? "▲ " : offScale === "below" ? "▼ " : ""}${g.names.join(" · ")} $${formatCurrency(g.price)}`;
    return { y: offScale === "above" ? top + gap / 2 : offScale === "below" ? bottom - gap / 2 : raw, text, color: g.color, offScale };
  });
  out.sort((a, b) => a.y - b.y);
  for (let i = 1; i < out.length; i++) out[i].y = Math.max(out[i].y, out[i - 1].y + gap);
  if (out.length && out[out.length - 1].y > bottom) {
    out[out.length - 1].y = bottom;
    for (let i = out.length - 2; i >= 0; i--) out[i].y = Math.min(out[i].y, out[i + 1].y - gap);
  }
  return out;
}

/**
 * A level's tag in the right column at `x`: the name alone in a box (mono at
 * `fz`, 4px padding each side), and the value printed beside it, outside the box.
 */
export function levelTag(name: string, value: number, fz: number, x: number) {
  const w = name.length * fz * 0.62 + 8;
  return { name, box: { x, w }, value: { x: x + w + 5, text: formatCurrency(value) } };
}

/** Smallest on-screen text size in the stock pop-up (CSS px, after the box's scale). */
export const POP_MIN_TEXT_PX = 12;

/**
 * Font size to draw at inside the pop-up so the text is never smaller than
 * POP_MIN_TEXT_PX on screen: the design size when the box is at full size or
 * larger, bigger when the box is scaled down to fit a smaller window or a
 * wide chart.
 */
export const popText = (base: number, scale: number): number => Math.max(base, POP_MIN_TEXT_PX / (scale > 0 ? scale : 1));

/**
 * Time-axis ticks for the hover chart, in ET: every hour on 5- and 15-minute
 * candles, every 30 minutes on 1- and 3-minute ones. `i` is the candle slot
 * (minutes since 09:30 ÷ candle size), matching the chart's x positions.
 */
export function timeTicks(tf: number): Array<{ i: number; label: string }> {
  const step = tf <= 3 ? 30 : 60, out: Array<{ i: number; label: string }> = [];
  for (let m = 0; m < 390; m += step) {
    const t = 570 + m;
    out.push({ i: m / tf, label: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}` });
  }
  return out;
}

/** What is open in the stock pop-up: which tile, and whether a click pinned it. */
export interface PopoverState { key: string; pinned: boolean }
export type PopoverEvent = { type: "enter" | "click"; key: string } | { type: "leave" } | { type: "dismiss" };

/**
 * One pop-up for hover and click. Hover opens it; leaving closes it unless a
 * click pinned it. A pinned pop-up stays while the pointer moves elsewhere,
 * moves to another tile on that tile's click, and closes on dismiss (a click
 * outside or Esc).
 */
/**
 * Whether the pop-up takes the pointer: whenever it is open, so the pointer can
 * move from the tile onto a hover preview (the leave grace period covers the gap)
 * and use its controls. Entering another tile closes an unpinned preview at
 * once, so it does not linger over the board.
 */
export const popoverInteractive = (cur: PopoverState | null): boolean => !!cur;

/** Pop-up chart placeholder while its bars load: the timeframe shown (5m by default), not the 1-minute bars it is grouped from. */
export const popChartLoadingText = (sym: string, minutes: number): string => `Loading ${sym} ${minutes}m chart…`;

/** A key press on the open pop-up: Esc closes it, pinned or not. */
export const popoverKey = (cur: PopoverState | null, key: string): PopoverState | null =>
  key === "Escape" ? null : cur;

export function popoverNext(cur: PopoverState | null, ev: PopoverEvent): PopoverState | null {
  switch (ev.type) {
    case "enter":
      return cur?.pinned ? cur : { key: ev.key, pinned: false };
    case "click":
      return { key: ev.key, pinned: true };
    case "leave":
      return cur?.pinned ? cur : null;
    case "dismiss":
      return null;
  }
}

/** The pop-up's open buttons; the ticker is already in the pop-up's title. */
export const popoverButtons = (): [string, string] => ["Open in Market Catalyst →", "Open in Stock Intelligence →"];

/**
 * Headings over the #1–#3 cards. The cards are the three biggest % movers on
 * each side, whatever their setup, so the sub-heading says that, not "setups".
 */
export const BOARD_HEADINGS = {
  bull: ["Top 3 Bullish Stocks", "Biggest Gainers"],
  bear: ["Top 3 Bearish Stocks", "Biggest Losers"],
} as const;

/** The pop-up's chart toggle: the one-day Money Flow chart, or the zoomable full chart. */
export const popChartModes = (): Array<{ full: boolean; label: string }> => [
  { full: false, label: "Intra-Day Chart" },
  { full: true, label: "Full Chart" },
];

/**
 * A stat's value in the pop-up: never clipped. It sits right-aligned on its
 * label's line, and wraps to the next line (whole) when both do not fit.
 */
export const POP_STAT_VALUE_STYLE: { whiteSpace: "nowrap"; marginLeft: "auto"; textAlign: "right"; overflow?: string; textOverflow?: string } = {
  whiteSpace: "nowrap",
  marginLeft: "auto",
  textAlign: "right",
};

/** The Intra-Day chart's visible window, in candle slots (0 = 9:30, nb = the close). */
export interface IntradayView { from: number; to: number }

/** Fewest candle slots the Intra-Day chart zooms in to. */
const MIN_INTRADAY_SPAN = 8;

export const fullSessionView = (nb: number): IntradayView => ({ from: 0, to: nb });

/** Keeps a window inside today's session (slots 0..nb), never narrower than a few candles. */
function clampIntradayView(from: number, span: number, nb: number): IntradayView {
  const s = Math.min(nb, Math.max(Math.min(MIN_INTRADAY_SPAN, nb), span));
  const f = Math.min(Math.max(0, from), nb - s);
  return { from: f, to: f + s };
}

/** Zoom by `factor` (< 1 zooms in) around `anchor`, the pointer's fraction across the plot. */
export function zoomIntradayView(v: IntradayView, factor: number, anchor: number, nb: number): IntradayView {
  const span = v.to - v.from, a = Math.min(1, Math.max(0, anchor));
  const at = v.from + a * span, s = span * factor;
  return clampIntradayView(at - a * Math.min(nb, Math.max(Math.min(MIN_INTRADAY_SPAN, nb), s)), s, nb);
}

/** Scroll by `slots` candles (negative = earlier), stopping at 9:30 and at the close. */
export const panIntradayView = (v: IntradayView, slots: number, nb: number): IntradayView =>
  clampIntradayView(v.from + slots, v.to - v.from, nb);

/** Candle sizes (minutes) on the pop-up's timeframe buttons; each works on both charts. */
export const POP_TIMEFRAMES = [1, 3, 5, 15] as const;

/** A pop-up timeframe: minutes (both charts), or a daily-and-up size (full chart only). */
export type PopTf = (typeof POP_TIMEFRAMES)[number] | "1D" | "1W" | "1M";

/** The timeframe buttons for a chart: the full chart adds 1D, 1W and 1M. */
export const popTimeframes = (full: boolean): PopTf[] => (full ? [...POP_TIMEFRAMES, "1D", "1W", "1M"] : [...POP_TIMEFRAMES]);

export const popTfLabel = (tf: PopTf): string => (typeof tf === "number" ? `${tf}m` : tf);

/** The timeframe to keep when switching charts: the Money Flow chart has no 1D / 1W / 1M, so those fall back to 5m. */
export const popTfForMode = (tf: PopTf, full: boolean): PopTf => (full || typeof tf === "number" ? tf : 5);

/**
 * Width of the hover chart's right gutter: wide enough for the widest pivot
 * label box (mono at `levelFz`, drawn 2px inside the gutter with 4px padding
 * each side) and the last-price tag (mono at `tagFz`, 4px inside), plus a
 * margin; never narrower than the original 72px.
 */
export function chartRightGutter(pivotLabels: string[], priceLabel: string, levelFz = 13.5, tagFz = 12): number {
  const MONO = 0.62, MARGIN = 8;
  const box = Math.max(0, ...pivotLabels.map((t) => 2 + t.length * levelFz * MONO + 8));
  const tag = 4 + priceLabel.length * tagFz * MONO;
  return Math.max(72, Math.ceil(Math.max(box, tag) + MARGIN));
}

export function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Signed flow: +$840M, −$2.4B, +$1.05T. */
export function formatCompactDollars(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+$" : "−$";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  return `${sign}${(abs / 1e6).toFixed(0)}M`;
}

/** Unsigned size: $5.11T, $75.3B, $840M. */
export function formatMarketCap(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  return formatCompactDollars(v).replace(/^\+/, "");
}

export function formatPct(v: number): string {
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${Math.abs(v).toFixed(2)}%`;
}

/** An index card's level and move from the tape, or dashes when the tape has none. */
export function indexCard(
  item: { value: number; pctChange: number } | undefined,
  fmt: (v: number) => string,
): { px: string; chg: string; isUp: boolean | null } {
  if (!item || !Number.isFinite(item.value) || !Number.isFinite(item.pctChange)) {
    return { px: "—", chg: "—", isUp: null };
  }
  const isUp = item.pctChange >= 0;
  return { px: fmt(item.value), chg: `${isUp ? "+" : ""}${item.pctChange.toFixed(2)}%`, isUp };
}

/** A price, or an em dash when the level does not exist. */
/**
 * Relative volume as the page shows it — the popover's Vol row, the tiles and
 * the cards all use this, from the board's one `rvol` (backend buildBoard).
 */
export const formatRvol = (rvol: number | null | undefined): string =>
  rvol == null || !Number.isFinite(rvol) ? "—" : `${rvol.toFixed(1)}×`;

/** Relative volume from which a card is tagged ACCUMULATION / DISTRIBUTION. */
export const RVOL_HEAVY = 1.4;

/**
 * A card's tag: CHOPPY, else ACCUMULATION / DISTRIBUTION from RVOL_HEAVY up,
 * else MOMENTUM UP / DOWN. Tested on the relative volume as shown (one
 * decimal), so the tag never disagrees with the number on screen.
 */
export function phaseTag(s: { chop: boolean; rvol: number | null }, bull: boolean):
  "CHOPPY" | "ACCUMULATION" | "DISTRIBUTION" | "MOMENTUM UP" | "MOMENTUM DOWN" {
  if (s.chop) return "CHOPPY";
  const shown = s.rvol == null || !Number.isFinite(s.rvol) ? null : Math.round(s.rvol * 10) / 10;
  if (shown != null && shown >= RVOL_HEAVY) return bull ? "ACCUMULATION" : "DISTRIBUTION";
  return bull ? "MOMENTUM UP" : "MOMENTUM DOWN";
}

export function formatLevel(v: number | null | undefined, dp = 2): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(dp);
}

/** The #1–#3 card's level row: zone, the live R/S levels and R:R, at the pop-up's two decimals. */
export function cardLevels(s: BoardStock): Array<{ k: "ZONE" | LiveLevel["name"] | "R:R"; v: string }> {
  const ll = liveLevels(s.pivots, s.price);
  return [
    { k: "ZONE", v: s.zone ? `${formatLevel(s.zone.lo)}–${formatLevel(s.zone.hi)}` : "—" },
    ...(["R2", "R1", "S1", "S2"] as const).map((k) => ({ k, v: formatLevel(ll.find((l) => l.name === k)?.v) })),
    { k: "R:R", v: s.rr == null ? "—" : `1:${s.rr.toFixed(1)}` },
  ];
}

// ── Candles ─────────────────────────────────────────────────────────────────

export interface OHLCVBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** Regular-session VWAP through this bar. */
  vw: number;
}

export function boardCandles(s: BoardStock): OHLCVBar[] {
  return s.bars.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, vw: b.vwap }));
}

const ET_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** ET calendar date and minutes after midnight of an instant (DST-aware). */
export function etClock(ms: number): { date: string; minutes: number } {
  const p = Object.fromEntries(ET_FMT.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}

/** "1:25 PM" in ET. */
export function etTimeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

/**
 * How fresh the board's flows are: the end of the latest bar, and how far it
 * trails the board's build (measured, since the bar feed's lag varies).
 */
export function flowsLagLabel(b: Pick<MoneyFlowBoard, "asOf" | "barsThrough" | "sessionComplete">): string {
  if (b.barsThrough == null) return "flows start after 9:30 AM ET";
  const at = etTimeLabel(b.barsThrough);
  if (b.sessionComplete) return `flows through ${at} ET (session closed)`;
  const behind = Math.max(0, Math.round((Date.parse(b.asOf) - b.barsThrough) / 60_000));
  return `flows through ${at} ET (${behind} min behind)`;
}

/** "Oct 29" for a YYYY-MM-DD session date. */
export function sessionDateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;

/**
 * `tf`-minute candles of `sessionDate`'s regular session from 1-minute bars,
 * grouped on the clock (09:30, 09:35, … for 5m) with the running session VWAP.
 */
export function sessionCandles(
  bars1m: Array<{ t: number; o: number; h: number; l: number; c: number; v: number; vw?: number | null }>,
  sessionDate: string,
  tf: number,
): OHLCVBar[] {
  const out: OHLCVBar[] = [];
  let pv = 0;
  let vol = 0;
  let slot = -1;
  for (const b of [...bars1m].sort((a, z) => a.t - z.t)) {
    const { date, minutes } = etClock(b.t);
    if (date !== sessionDate || minutes < OPEN_MIN || minutes >= CLOSE_MIN) continue;
    const v = Number.isFinite(b.v) && b.v > 0 ? b.v : 0;
    pv += (b.vw != null && Number.isFinite(b.vw) ? b.vw : (b.h + b.l + b.c) / 3) * v;
    vol += v;
    const vw = vol > 0 ? pv / vol : b.c;
    const s = Math.floor((minutes - OPEN_MIN) / tf);
    if (s !== slot) {
      slot = s;
      out.push({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v, vw });
    } else {
      const cur = out[out.length - 1];
      cur.h = Math.max(cur.h, b.h);
      cur.l = Math.min(cur.l, b.l);
      cur.c = b.c;
      cur.v += v;
      cur.vw = vw;
    }
  }
  return out;
}

/** Index of the first candle at or after `t` (the zone's start), else -1. */
export function candleIndexAt(c: Array<{ t: number }>, t: number): number {
  return c.findIndex((x) => x.t >= t);
}

// ── Structure (chart layers) ────────────────────────────────────────────────

export interface OrderBlock {
  i: number;
  hi: number;
  lo: number;
  bull: boolean;
  mit: boolean;
  end: number;
}

export interface SwingPoint {
  i: number;
  p: number;
  hi: boolean;
}

/** Same definition as the backend: strict swing high/low over `n` bars each side. */
export function computeSwings(c: Array<Pick<OHLCVBar, "h" | "l">>, n: number = 3): SwingPoint[] {
  const S: SwingPoint[] = [];
  for (let i = n; i < c.length - n; i++) {
    let H = true;
    let L = true;
    for (let j = i - n; j <= i + n; j++) {
      if (j === i) continue;
      if (c[j].h >= c[i].h) H = false;
      if (c[j].l <= c[i].l) L = false;
    }
    if (H) S.push({ i, p: c[i].h, hi: true });
    if (L) S.push({ i, p: c[i].l, hi: false });
  }
  return S;
}

/** Same definition as the backend: last opposite candle before a >0.18% displacement. */
export interface FairValueGap { i: number; lo: number; hi: number; bull: boolean; /** Bar that filled it, or null while open. */ end: number | null }

/**
 * Three-bar fair value gaps (a gap of more than 0.06% between bar i−1 and bar
 * i+1), each with the bar that later filled it. The latest `keep` only (0 = all).
 */
export function computeFvgs(c: Array<Pick<OHLCVBar, "h" | "l">>, keep = 7): FairValueGap[] {
  const F: FairValueGap[] = [];
  for (let i = 1; i < c.length - 1; i++) {
    const a = c[i - 1], b = c[i + 1];
    if (b.l > a.h && (b.l - a.h) / (a.h || 1) > 0.0006) F.push({ i, lo: a.h, hi: b.l, bull: true, end: null });
    if (b.h < a.l && (a.l - b.h) / (a.l || 1) > 0.0006) F.push({ i, lo: b.h, hi: a.l, bull: false, end: null });
  }
  const out = keep > 0 ? F.slice(-keep) : F;
  for (const g of out) {
    for (let j = g.i + 2; j < c.length; j++) {
      if (g.bull ? c[j].l <= g.lo : c[j].h >= g.hi) { g.end = j; break; }
    }
  }
  return out;
}

export function computeOrderBlocks(c: Array<Pick<OHLCVBar, "o" | "h" | "l" | "c">>): OrderBlock[] {
  const OB: OrderBlock[] = [];
  for (let i = 2; i < c.length - 2; i++) {
    const bar = c[i];
    const nxt1 = c[i + 1];
    const nxt2 = c[i + 2];
    const bullImb = bar.c < bar.o && nxt1.c > nxt1.o && (nxt2.c - bar.h) / bar.h > 0.0018;
    const bearImb = bar.c > bar.o && nxt1.c < nxt1.o && (bar.l - nxt2.c) / bar.l > 0.0018;
    if (bullImb || bearImb) {
      let mit = false;
      let end = c.length - 1;
      for (let j = i + 2; j < c.length; j++) {
        if (bullImb ? c[j].l <= bar.l : c[j].h >= bar.h) {
          mit = true;
          end = j;
          break;
        }
      }
      OB.push({ i, hi: bar.h, lo: bar.l, bull: bullImb, mit, end });
    }
  }
  return OB.slice(-6);
}

// ── Sectors ─────────────────────────────────────────────────────────────────

export interface SectorFlowItem {
  name: string;
  flowVal: number;
  flowFormatted: string;
  avgPct: number;
  avgPctFormatted: string;
  /** The % move's colour: green up, red down, grey flat (independent of the flow's direction). */
  pctColor: string;
  buyPct: number | null;
  barWidthPct: string;
  color: string;
  stockCount: number;
  isPositive: boolean;
}

/**
 * Sector list (inflows first), the two largest inflows, the two largest
 * outflows, and the rest. A sector is an inflow only with net flow > 0 and an
 * outflow only with net flow < 0, so a one-sided day shows fewer boxes rather
 * than mislabelling a sector.
 */
/** Sectors pulled into the inflow / outflow boxes, each side. */
export const TOP_SECTORS = 3;

/**
 * An inflow / outflow box's size. flexShrink 0: in a short column (a small
 * window) the boxes keep their content height and the column grows, instead of
 * squeezing the text out of view.
 */
export const SECTOR_BOX_SIZE = { flexShrink: 0, minHeight: 58, padding: "5px 10px" } as const;

/**
 * The sector name inside a box. overflow hidden (for the sideways ellipsis)
 * lets a flex item shrink to no height at all, so it is pinned at its line.
 */
export const SECTOR_NAME_STYLE = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--th-eef2f4)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  lineHeight: 1.3,
  flexShrink: 0,
} as const;

/**
 * The board with the app's sector labels on its sector list too. backend.ts
 * renames every JSON "sector" field as responses are parsed (normalizeSector,
 * e.g. Consumer Non-Durables → Consumer Defensive), which reaches each stock's
 * `sector` but not the sector list's `name`; without this the pop-up and the
 * board named one sector two ways and clicking it matched none of its stocks.
 */
export function withSectorLabels<B extends Pick<MoneyFlowBoard, "sectors" | "gainers" | "losers">>(b: B): B {
  const label = (n: string | null) => (n == null ? n : normalizeSector(n));
  return {
    ...b,
    sectors: b.sectors.map((x) => ({ ...x, name: normalizeSector(x.name) })),
    gainers: b.gainers.map((x) => ({ ...x, sector: label(x.sector) })),
    losers: b.losers.map((x) => ({ ...x, sector: label(x.sector) })),
  };
}

/** A sector row's tooltip: the full name (rows truncate it), its net flow and its average move. */
export const sectorRowTitle = (s: Pick<SectorFlowItem, "name" | "flowFormatted" | "avgPctFormatted">): string =>
  `${s.name} · ${s.flowFormatted} net flow · ${s.avgPctFormatted} avg move`;

export function sectorView(sectors: BoardSector[]): {
  sectors: SectorFlowItem[];
  topInflow: SectorFlowItem[];
  topOutflow: SectorFlowItem[];
  remaining: SectorFlowItem[];
} {
  const maxAbs = Math.max(1, ...sectors.map((s) => Math.abs(s.netFlow)));
  const list: SectorFlowItem[] = [...sectors]
    .sort((a, b) => b.netFlow - a.netFlow)
    .map((s) => ({
      name: s.name,
      flowVal: s.netFlow,
      flowFormatted: formatCompactDollars(s.netFlow),
      avgPct: s.avgPct,
      avgPctFormatted: formatPct(s.avgPct),
      pctColor: s.avgPct > 0 ? "var(--th-3ddc84)" : s.avgPct < 0 ? "var(--th-f0565a)" : "var(--th-7a8481)",
      buyPct: s.buyPct,
      barWidthPct: `${Math.max(4, Math.min(100, (Math.abs(s.netFlow) / maxAbs) * 100))}%`,
      color: s.netFlow >= 0 ? "var(--th-3ddc84)" : "var(--th-f0565a)",
      stockCount: s.count,
      isPositive: s.netFlow >= 0,
    }));
  const topInflow = list.filter((s) => s.flowVal > 0).slice(0, TOP_SECTORS);
  const topOutflow = list.filter((s) => s.flowVal < 0).slice(-TOP_SECTORS).reverse();
  const pulled = new Set([...topInflow, ...topOutflow].map((s) => s.name));
  return { sectors: list, topInflow, topOutflow, remaining: list.filter((s) => !pulled.has(s.name)) };
}

/**
 * Notice when the highlighted sector has no stock among the 15 gainers or 15
 * losers, so its highlight would otherwise show nothing.
 */
export function sectorNotOnBoardText(
  sector: string | null,
  sectors: BoardSector[],
  onBoard: BoardStock[],
): string {
  if (!sector) return "";
  const row = sectors.find((s) => s.name === sector);
  if (!row || row.count === 0 || onBoard.some((s) => s.sector === sector)) return "";
  const n = row.count;
  return `No ${sector} stock is in today’s top 15 gainers or losers — its ${n} stock${n > 1 ? "s are" : " is"} counted in the sector flow only.`;
}

// ── Tiles (#4–#15 each side) ────────────────────────────────────────────────

export interface TileLayout {
  t: string;
  L: string;
  T: string;
  W: string;
  H: string;
  rank: string;
  chg: string;
  px: string;
  conf: number | null;
  confC: string;
  confDeg: string;
  ringS: string;
  ringI: string;
  ringF: string;
  padR: string;
  logoD: string;
  rankD: string;
  rowD: string;
  miniB: string;
  fs: string;
  rsTxt: string;
  rsC: string;
  m30: string;
  m30C: string;
  volx: string;
  bg: string;
  bd: string;
}

/** Squarified treemap of the movers ranked #4–#15; area ∝ ⌊|% move|⌋ + 1. */
export function computeSquarifiedTiles(items: BoardStock[], bull: boolean): TileLayout[] {
  if (!items.length) return [];
  const weight = (s: BoardStock) => Math.floor(Math.abs(s.pctChange)) + 1;
  const asc = items.map((x, i) => ({ x, i }));
  const tot = asc.reduce((a, o) => a + weight(o.x), 0);
  const AR = 0.8;
  const rect: Record<string, { L: number; T: number; W: number; H: number }> = {};

  const worst = (row: typeof asc, s: number) => {
    const h = s / tot;
    return Math.max(
      ...row.map((o) => {
        const r = ((weight(o.x) / s) * AR) / h;
        return Math.max(r, 1 / r);
      }),
    );
  };

  const rows: Array<[typeof asc, number]> = [];
  let cur: typeof asc = [];
  let cs = 0;
  asc.forEach((o) => {
    const v = weight(o.x);
    if (!cur.length) {
      cur = [o];
      cs = v;
      return;
    }
    if (worst(cur.concat([o]), cs + v) <= worst(cur, cs) && cur.length < 3) {
      cur.push(o);
      cs += v;
    } else {
      rows.push([cur, cs]);
      cur = [o];
      cs = v;
    }
  });
  if (cur.length) rows.push([cur, cs]);

  while (rows.length > 1 && rows[rows.length - 1][1] / tot < 0.16) {
    const lr = rows.pop()!;
    const pr = rows[rows.length - 1];
    pr[0] = pr[0].concat(lr[0]);
    pr[1] += lr[1];
  }

  let y = 0;
  rows.forEach(([row, s]) => {
    const h = (s / tot) * 100;
    let x0 = 0;
    row.forEach((o) => {
      const w = (weight(o.x) / s) * 100;
      rect[o.x.t] = { L: y, T: x0, W: h, H: w };
      x0 += w;
    });
    y += h;
  });

  return asc.map(({ x, i }) => {
    const R0 = rect[x.t] || { L: 0, T: 0, W: 20, H: 20 };
    const area = (R0.W * R0.H) / 100;
    const c = bull ? "61,220,132" : "240,86,90";
    const wide = R0.W >= 24;
    const conf = x.confidence?.score ?? null;
    return {
      t: x.t,
      L: `${R0.L.toFixed(2)}%`,
      T: `${R0.T.toFixed(2)}%`,
      W: `${R0.W.toFixed(2)}%`,
      H: `${R0.H.toFixed(2)}%`,
      rank: String(i + 4),
      chg: formatPct(x.pctChange),
      px: formatCurrency(x.price),
      conf,
      confC: bull ? "var(--th-3ddc84)" : "var(--th-f0565a)",
      confDeg: `${(conf ?? 0) * 3.6}deg`,
      ringS: wide ? "22px" : "14px",
      ringI: wide ? "17px" : "11px",
      ringF: wide ? "8.5px" : "6.5px",
      padR: wide ? "24px" : "14px",
      logoD: wide ? "grid" : "none",
      rankD: R0.W >= 20 ? "inline" : "none",
      rowD: R0.H >= 22 ? "flex" : "none",
      miniB: R0.H >= 22 ? "32px" : "5px",
      fs: area >= 16 ? "18px" : area >= 9 ? "15px" : "12px",
      rsTxt: x.vsSector == null ? "—" : `${x.vsSector >= 0 ? "+" : "−"}${Math.abs(x.vsSector).toFixed(2)}%`,
      rsC: (x.vsSector ?? 0) >= 0 ? "var(--th-3ddc84)" : "var(--th-f0565a)",
      m30: x.m30 == null ? "—" : `${x.m30 >= 0 ? "▲" : "▼"}${Math.abs(x.m30).toFixed(2)}%`,
      m30C: (x.m30 ?? 0) >= 0 ? "var(--th-3ddc84)" : "var(--th-f0565a)",
      volx: formatRvol(x.rvol),
      bg: `linear-gradient(160deg,rgba(${c},${Math.max(0.06, 0.2 - i * 0.012)}),rgba(${c},0.03))`,
      bd: `rgba(${c},0.32)`,
    };
  });
}

// ── Hover box ───────────────────────────────────────────────────────────────

/**
 * Hover box design size. It is laid out at this size for a `baseW × baseH`
 * window and scaled by the window, so it keeps its proportions on any screen.
 */
export const POPOVER = { w: 460, chartH: 440, baseW: 1920, baseH: 960 } as const;

/** A zone entry further than this from price is a WATCH, not a PICK. */
export const WATCH_DIST_PCT = 1.2;

export type PopTone = "up" | "down" | "zone" | "muted" | "plain";
export interface PopStat {
  k: string;
  v: string;
  tone: PopTone;
  bold?: boolean;
}

/** Signed share count: +280K, +3.1M, −16M. */
function formatShares(n: number): string {
  const a = Math.abs(n);
  const s = n >= 0 ? "+" : "−";
  if (a >= 1e7) return `${s}${Math.round(a / 1e6)}M`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M`;
  return `${s}${Math.round(a / 1e3)}K`;
}

/** The hover box's stats, in two-column order, from the board's own fields. */
export function popoverStats(s: BoardStock, board: Pick<MoneyFlowBoard, "gainers" | "losers">): PopStat[] {
  const onGainers = board.gainers.some((g) => g.t === s.t);
  const bull = onGainers || (!board.losers.some((l) => l.t === s.t) && s.pctChange >= 0);
  const side = bull ? board.gainers : board.losers;
  const i = side.findIndex((x) => x.t === s.t);
  const rank = i >= 0 ? `#${i + 1}` : "#—";
  const dir: PopTone = bull ? "up" : "down";
  const above = s.vwap != null ? s.price > s.vwap : null;
  const flow =
    s.price > 0
      ? `${formatShares(s.netFlow / s.price)}${above == null ? "" : above ? " · ▲ price above VWAP" : " · ▼ price below VWAP"}`
      : "—";
  const noSetup = s.chop || s.entry == null;
  const dist = s.entry != null && s.price > 0 ? (Math.abs(s.price - s.entry) / s.price) * 100 : null;
  const rule = noSetup
    ? "NO SETUP"
    : `${dist != null && dist > WATCH_DIST_PCT ? "WATCH" : "PICK"} · ${bull ? "BULLISH" : "BEARISH"}${i >= 0 ? ` #${i + 1}` : ""}`;
  return [
    { k: "Confidence", v: s.confidence ? String(s.confidence.score) : "—", tone: dir, bold: true },
    // The side of the move only; whether there is a trade is the Rule (and the card badge).
    { k: "Direction", v: `${bull ? "Bullish" : "Bearish"}${s.chop ? " · choppy" : ""}`, tone: s.chop ? "muted" : dir },
    { k: "Rank", v: `${rank} / ${side.length} ${bull ? "gainers" : "losers"}`, tone: "plain" },
    {
      k: "Vol",
      v: `${formatRvol(s.rvol)} · ${s.buyPct == null ? "—" : `${Math.round(s.buyPct)}%`} inflow`,
      tone: "plain",
    },
    { k: "Δ", v: flow, tone: s.netFlow >= 0 ? "up" : "down" },
    { k: "VWAP", v: formatLevel(s.vwap), tone: "plain" },
    { k: "OB", v: s.zone ? `${formatLevel(s.zone.lo)}–${formatLevel(s.zone.hi)}` : "—", tone: "zone" },
    { k: "Entry/Stop", v: `${formatLevel(s.entry)} · ${formatLevel(s.stop)}`, tone: "zone" },
    { k: "R:R", v: s.rr == null ? "—" : `1 : ${s.rr.toFixed(1)}${s.target != null ? ` (tgt ${formatLevel(s.target)})` : ""}`, tone: "plain" },
    { k: "Rule", v: rule, tone: noSetup ? "muted" : dir, bold: true },
  ];
}

/** Scale for the window; phones fit the box to their width instead. */
export function popoverScale(vw: number, vh: number, w: number = POPOVER.w): number {
  if (vw < 768) return Math.min(1, (vw - 24) / w);
  // A box wider than the design size (a wide chart) shrinks just enough to fit.
  return Math.min(vw / POPOVER.baseW, vh / POPOVER.baseH, (vw - 16) / w);
}

/**
 * Screen position for the scaled box (height `h`, already scaled): right of
 * the tile when it fits, otherwise left of it, a little above the tile's top
 * and inside the window.
 */
export function popoverPlacement(
  tile: { left: number; right: number; top: number },
  vw: number,
  vh: number,
  scale: number,
  h: number,
  boxW: number = POPOVER.w,
): { left: number; top: number } {
  const w = boxW * scale;
  const left =
    vw < 768
      ? Math.max(8, (vw - w) / 2)
      : tile.right + w + 16 < vw
        ? tile.right + 12
        : tile.left - w - 12 >= 8
          ? tile.left - w - 12
          : Math.max(8, Math.min(vw - w - 8, tile.right + 12));
  const top = Math.max(8, Math.min(vh - h - 8, tile.top - 120 * scale));
  return { left, top };
}

/** Candle width per timeframe, px. */
const POP_CANDLE_PX: Record<number, number> = { 1: 5, 3: 7, 5: 8, 15: 16 };
/** FullChartSvg's left + right padding. */
const POP_CHART_PAD = 78;

/** The chart is a full session wide at a readable candle width; it scrolls. */
export function popoverChartWidth(tf: number): number {
  const nb = Math.round(390 / tf) + 1;
  return Math.max(430, nb * (POP_CANDLE_PX[tf] ?? 8) + POP_CHART_PAD);
}

/** Box padding (2×14) + box border (2×1) + chart frame border (2×1). */
const POP_BOX_CHROME = 32;

/** Box width that holds the whole chart with no horizontal scroll. */
export function popoverWidth(tf: number): number {
  return Math.max(POPOVER.w, popoverChartWidth(tf) + POP_BOX_CHROME);
}

/** scrollLeft that puts the live candle three quarters across the view. */
export function popoverLiveScroll(width: number, tf: number, nCandles: number, viewW: number): number {
  if (nCandles <= 0) return 0;
  const nb = Math.round(390 / tf) + 1;
  const cw = (width - POP_CHART_PAD) / nb;
  return Math.max(0, 6 + (nCandles - 0.5) * cw - viewW * 0.75);
}
