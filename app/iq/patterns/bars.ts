import { CATALOG } from "./catalog";
import { mark } from "./candles";
import type { DetectOptions, PatternHit } from "./types";
import { down, range, trendInto, up, type Ctx } from "./util";

/** Bar / short-term patterns (inside, outside, key reversal, NR4/NR7, two-bar reversal, Shark-32, weekly reversal). */
export function detectBars(x: Ctx, opt: DetectOptions = {}): PatternHit[] {
  const B = x.bars, out: PatternHit[] = [];
  const add = (id: string, i0: number, i1: number) => out.push(mark(x, id, i0, i1));
  for (let i = 1; i < B.length; i++) {
    const b = B[i], a = B[i - 1];
    if (b.h < a.h && b.l > a.l) add("inside-bar", i - 1, i);
    if (b.h > a.h && b.l < a.l) add("outside-bar", i - 1, i);
    if (i >= 5) {
      const prior = B.slice(i - 5, i);
      if (b.l < Math.min(...prior.map((q) => q.l)) && b.c > a.c) add("key-reversal-up", i - 1, i);
      if (b.h > Math.max(...prior.map((q) => q.h)) && b.c < a.c) add("key-reversal-down", i - 1, i);
    }
    if (i >= 6 && B.slice(i - 6, i).every((q) => range(q) > range(b))) add("nr7", i - 6, i);
    else if (i >= 3 && B.slice(i - 3, i).every((q) => range(q) > range(b))) add("nr4", i - 3, i);
    const big = range(a) >= 1.5 * (x.avgRange[i - 1] || Infinity);
    if (big && down(a) && up(b) && b.c > a.o) add("two-bar-reversal-bull", i - 1, i);
    if (big && up(a) && down(b) && b.c < a.o) add("two-bar-reversal-bear", i - 1, i);
    if (i >= 2) {
      const z = B[i - 2];
      if (a.h < z.h && a.l > z.l && b.h < a.h && b.l > a.l) add("shark-32", i - 2, i);
    }
    if (opt.weekly) {
      if (b.l < a.l && b.c > a.c && trendInto(x, i) !== "up") add("weekly-reversal-up", i - 1, i);
      if (b.h > a.h && b.c < a.c && trendInto(x, i) !== "down") add("weekly-reversal-down", i - 1, i);
    }
  }
  return out;
}

const gapUp = (x: Ctx, i: number) => {
  const a = x.bars[i - 1], b = x.bars[i];
  return b.l > a.h && b.l - a.h >= 0.25 * (x.avgRange[i] || 0);
};
const gapDown = (x: Ctx, i: number) => {
  const a = x.bars[i - 1], b = x.bars[i];
  return b.h < a.l && a.l - b.h >= 0.25 * (x.avgRange[i] || 0);
};

/** Gaps (classified breakaway / runaway / exhaustion / common) and island reversals. */
export function detectGaps(x: Ctx): PatternHit[] {
  const B = x.bars, out: PatternHit[] = [];
  for (let i = 1; i < B.length; i++) {
    const upG = gapUp(x, i), dnG = gapDown(x, i);
    if (!upG && !dnG) continue;
    const a = B[i - 1], b = B[i];
    let id = "gap-common";
    const w = B.slice(Math.max(0, i - 20), i);
    const rHi = Math.max(...w.map((q) => q.h)), rLo = Math.min(...w.map((q) => q.l));
    const vOk = b.v != null && Number.isFinite(x.avgVol[i]) && b.v >= 1.5 * x.avgVol[i];
    const move = i >= 20 ? a.c - B[i - 20].c : 0;
    const filled = B.slice(i + 1, i + 4).some((q) => (upG ? q.l <= a.h : q.h >= a.l));
    const tr = trendInto(x, i);
    if (w.length >= 10 && vOk && (upG ? b.l > rHi : b.h < rLo)) id = "gap-breakaway";
    else if (Math.abs(move) >= 6 * (x.atr[i - 1] || Infinity) && Math.sign(move) === (upG ? 1 : -1) && filled) id = "gap-exhaustion";
    else if ((upG && tr === "up") || (dnG && tr === "down")) id = "gap-runaway";
    const d = CATALOG[id];
    out.push({
      id, name: d.name + (upG ? " ↑" : " ↓"), group: "gap", signal: upG ? "bull" : "bear", i0: i - 1, i1: i, at: i,
      price: upG ? a.h : a.l,
      lines: [{ i0: i - 1, p0: upG ? a.h : a.l, i1: i, p1: upG ? b.l : b.h, role: "level" }],
    });
  }
  // Islands: a gap one way, 1–30 bars clear of it, then a gap the other way.
  for (let a = 1; a < B.length; a++) {
    const upA = gapUp(x, a), dnA = gapDown(x, a);
    if (!upA && !dnA) continue;
    for (let e = a + 1; e < B.length && e - a <= 30; e++) {
      const isl = B.slice(a, e);
      if (upA && gapDown(x, e) && Math.min(...isl.map((q) => q.l)) > Math.max(B[a - 1].h, B[e].h)) {
        const id = e - a >= 5 ? "island-long-top" : "island-top";
        out.push({ ...mark(x, id, a, e - 1), at: e - 1 });
        break;
      }
      if (dnA && gapUp(x, e) && Math.max(...isl.map((q) => q.h)) < Math.min(B[a - 1].l, B[e].l)) {
        const id = e - a >= 5 ? "island-long-bottom" : "island-bottom";
        out.push({ ...mark(x, id, a, e - 1), at: e - 1 });
        break;
      }
      // the island must stay clear of the first gap
      if (upA ? B[e].l <= B[a - 1].h : B[e].h >= B[a - 1].l) break;
    }
  }
  return out;
}
