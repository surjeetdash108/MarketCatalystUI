/**
 * The "Pattern" overlay for the Market Catalyst candle chart: the shared
 * detector (app/iq/patterns) drawn on the canvas with the same colours, lines
 * and non-overlapping name tags as the Money Flow hover chart.
 */
import { detectPatterns, layoutLabels, patternGlyphs, patternsToShow, type DetectOptions, type PatternHit, type PBar } from "./patterns";

/** Detector options from the bars: daily-and-up unless intraday; weekly when bars are ~7 days apart. */
export function chartPatternOptions(data: Array<{ t: number }>, intraday: boolean): DetectOptions {
  if (intraday || data.length < 3) return { daily: false };
  const gaps = data.slice(1).map((b, k) => b.t - data[k].t).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)] / 86_400_000;
  return { daily: true, weekly: median >= 5.5 && median < 20 };
}

export function chartPatterns(data: Array<PBar & { t: number }>, intraday: boolean): PatternHit[] {
  return detectPatterns(data, chartPatternOptions(data, intraday));
}

export interface PatternOps {
  lines: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; dash: number[] }>;
  points: Array<{ x: number; y: number; text: string; color: string }>;
  tags: Array<{ x: number; y: number; w: number; h: number; text: string; color: string; ax: number; ay: number }>;
}

/** Canvas draw operations for the hits overlapping bars [from, to], in plot coordinates. */
export function patternDrawOps(
  hits: PatternHit[], from: number, to: number,
  xOf: (i: number) => number, yOf: (p: number) => number,
  plot: { l: number; r: number; top: number; bottom: number }, font = 12,
): PatternOps {
  const shown = patternsToShow(hits, Math.max(0, Math.floor(from)), Math.ceil(to));
  const glyphs = shown.map(patternGlyphs);
  const h = font + 6;
  const tags = layoutLabels(glyphs.map((g) => {
    const w = g.label.text.length * font * 0.56 + 10, ax = xOf(g.label.i), ay = yOf(g.label.p);
    return { x: Math.max(plot.l, Math.min(plot.r - w, ax - w / 2)), y: g.label.above ? ay - h - 6 : ay + 6, w, h, above: g.label.above };
  })).map((b) => ({ ...b, y: Math.max(plot.top, Math.min(plot.bottom - b.h, b.y)) }));
  const ops: PatternOps = { lines: [], points: [], tags: [] };
  glyphs.forEach((g, k) => {
    for (const l of g.lines) ops.lines.push({ x1: xOf(l.i0), y1: yOf(l.p0), x2: xOf(l.i1), y2: yOf(l.p1), color: g.color, dash: l.dash });
    for (const p of g.points) ops.points.push({ x: xOf(p.i), y: yOf(p.p) + (g.label.above ? -6 : font + 4), text: p.label, color: g.color });
    const t = tags[k];
    ops.tags.push({ x: t.x, y: t.y, w: t.w, h: t.h, text: g.label.text, color: g.color, ax: xOf(g.label.i), ay: yOf(g.label.p) });
  });
  return ops;
}

/** Draws the operations on a 2D canvas context (caller clips to the price area). */
export function drawPatternOps(ctx: CanvasRenderingContext2D, ops: PatternOps, fontFamily: string, bg: string, font = 12) {
  ctx.save();
  ctx.lineWidth = 1.3;
  for (const l of ops.lines) {
    ctx.strokeStyle = l.color; ctx.globalAlpha = 0.85; ctx.setLineDash(l.dash);
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.font = `bold ${font - 1}px ${fontFamily}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const p of ops.points) { ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y); }
  ctx.font = `bold ${font}px ${fontFamily}`; ctx.textAlign = "left";
  for (const t of ops.tags) {
    ctx.strokeStyle = t.color; ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.moveTo(t.ax, t.ay); ctx.lineTo(Math.max(t.x, Math.min(t.x + t.w, t.ax)), t.ay < t.y ? t.y : t.y + t.h); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = bg; ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeStyle = t.color; ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x + 5, t.y + t.h / 2 + 0.5);
  }
  ctx.restore();
}
