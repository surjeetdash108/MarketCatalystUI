import { CATALOG } from "./catalog";
import type { PatternHit } from "./types";
import { body, bot, down, isDoji, isLong, isSmall, lower, mid, range, sameTol, top, trendInto, up, upper, type Ctx } from "./util";

/** A hit for a candle / bar pattern spanning bars i0..i1, marked at i1 (below the bar if bullish, above otherwise). */
export function mark(x: Ctx, id: string, i0: number, i1: number): PatternHit {
  const d = CATALOG[id];
  const lo = Math.min(...x.bars.slice(i0, i1 + 1).map((b) => b.l)), hi = Math.max(...x.bars.slice(i0, i1 + 1).map((b) => b.h));
  return { id, name: d.name, group: d.group, signal: d.signal, i0, i1, at: i1, price: d.signal === "bull" ? lo : hi };
}

/** Candlestick patterns ending at each bar (Nison definitions; see catalog.ts for each rule). */
export function detectCandles(x: Ctx): PatternHit[] {
  const B = x.bars, out: PatternHit[] = [];
  const add = (id: string, i0: number, i1: number) => out.push(mark(x, id, i0, i1));
  for (let i = 1; i < B.length; i++) {
    const b = B[i], r = range(b), bd = body(b), tr = trendInto(x, i);
    if (r <= 0) continue;
    // ── single ──
    if (isDoji(b)) {
      if (upper(b) <= 0.1 * r && lower(b) >= 0.6 * r) add("dragonfly-doji", i, i);
      else if (lower(b) <= 0.1 * r && upper(b) >= 0.6 * r) add("gravestone-doji", i, i);
      else if (upper(b) >= 0.3 * r && lower(b) >= 0.3 * r) add("long-legged-doji", i, i);
      else add("doji", i, i);
    } else {
      if (lower(b) >= 2 * bd && upper(b) <= 0.1 * r) {
        if (tr === "down") add("hammer", i, i);
        else if (tr === "up") add("hanging-man", i, i);
      }
      if (upper(b) >= 2 * bd && lower(b) <= 0.1 * r) {
        if (tr === "down") add("inverted-hammer", i, i);
        else if (tr === "up") add("shooting-star", i, i);
      }
      if (bd >= 0.95 * r && bd >= (x.avgBody[i] || 0)) add(up(b) ? "marubozu-bull" : "marubozu-bear", i, i);
      if (bd > 0.1 * r && bd <= 0.3 * r && upper(b) >= bd && lower(b) >= bd) add("spinning-top", i, i);
      if (bd > 0.1 * r && bd <= 0.15 * r && upper(b) >= 0.35 * r && lower(b) >= 0.35 * r && r >= 1.5 * (x.avgRange[i] || Infinity)) add("high-wave", i, i);
      if (isLong(x, i)) {
        if (tr === "down" && up(b) && lower(b) <= 0.02 * r) add("belt-hold-bull", i, i);
        if (tr === "up" && down(b) && upper(b) <= 0.02 * r) add("belt-hold-bear", i, i);
      }
    }
    // ── two ──
    const a = B[i - 1], ta = trendInto(x, i - 1), tol = sameTol(x, i);
    if (tr === "down" && down(a) && up(b) && b.o <= a.c && b.c >= a.o && bd > body(a)) add("engulfing-bull", i - 1, i);
    if (tr === "up" && up(a) && down(b) && b.o >= a.c && b.c <= a.o && bd > body(a)) add("engulfing-bear", i - 1, i);
    if (isLong(x, i - 1) && bd <= 0.5 * body(a) && top(b) <= top(a) && bot(b) >= bot(a)) {
      if (ta === "down" && down(a)) add(isDoji(b) ? "harami-cross-bull" : "harami-bull", i - 1, i);
      if (ta === "up" && up(a)) add(isDoji(b) ? "harami-cross-bear" : "harami-bear", i - 1, i);
    }
    if (ta === "down" && down(a) && isLong(x, i - 1) && up(b) && b.o < a.c && b.c > mid(a) && b.c < a.o) add("piercing-line", i - 1, i);
    if (ta === "up" && up(a) && isLong(x, i - 1) && down(b) && b.o > a.c && b.c < mid(a) && b.c > a.o) add("dark-cloud-cover", i - 1, i);
    if (ta === "down" && down(a) && up(b) && Math.abs(a.l - b.l) <= tol) add("tweezer-bottom", i - 1, i);
    if (ta === "up" && up(a) && down(b) && Math.abs(a.h - b.h) <= tol) add("tweezer-top", i - 1, i);
    if (down(a) && isLong(x, i - 1) && up(b) && isLong(x, i) && b.o > a.o) add("kicker-bull", i - 1, i);
    if (up(a) && isLong(x, i - 1) && down(b) && isLong(x, i) && b.o < a.o) add("kicker-bear", i - 1, i);
    if (isLong(x, i - 1) && isLong(x, i) && Math.abs(a.c - b.c) <= tol) {
      if (ta === "down" && down(a) && up(b)) add("counterattack-bull", i - 1, i);
      if (ta === "up" && up(a) && down(b)) add("counterattack-bear", i - 1, i);
    }
    if (isLong(x, i) && Math.abs(a.o - b.o) <= tol) {
      if (ta === "up" && down(a) && up(b)) add("separating-lines-bull", i - 1, i);
      if (ta === "down" && up(a) && down(b)) add("separating-lines-bear", i - 1, i);
    }
    if (ta === "down" && down(a) && isLong(x, i - 1) && up(b) && b.o < a.l) {
      if (Math.abs(b.c - a.l) <= tol) add("on-neck", i - 1, i);
      else if (b.c > a.c && b.c <= a.c + 0.1 * body(a)) add("in-neck", i - 1, i);
      else if (b.c > a.c + 0.1 * body(a) && b.c < mid(a)) add("thrusting", i - 1, i);
    }
    if (ta === "down" && down(a) && down(b) && top(b) < top(a) && bot(b) > bot(a)) add("homing-pigeon", i - 1, i);
    if (ta === "down" && down(a) && down(b) && Math.abs(a.c - b.c) <= tol) add("matching-low", i - 1, i);
    if (ta === "up" && up(a) && up(b) && Math.abs(a.c - b.c) <= tol) add("matching-high", i - 1, i);
    // ── three ──
    if (i < 2) continue;
    const z = B[i - 2], tz = trendInto(x, i - 2);
    if (tz === "down" && down(z) && isLong(x, i - 2) && isSmall(x, i - 1) && top(a) < z.c && up(b) && b.c > mid(z))
      add(isDoji(a) ? "morning-doji-star" : "morning-star", i - 2, i);
    if (tz === "up" && up(z) && isLong(x, i - 2) && isSmall(x, i - 1) && bot(a) > z.c && down(b) && b.c < mid(z))
      add(isDoji(a) ? "evening-doji-star" : "evening-star", i - 2, i);
    if (tz === "down" && isDoji(a) && a.h < z.l && a.h < b.l) add("abandoned-baby-bull", i - 2, i);
    if (tz === "up" && isDoji(a) && a.l > z.h && a.l > b.h) add("abandoned-baby-bear", i - 2, i);
    const three = [z, a, b], ix = [i - 2, i - 1, i];
    if (three.every(up) && ix.every((k) => isLong(x, k)) && a.o > z.o && a.o < z.c && b.o > a.o && b.o < a.c && a.c > z.c && b.c > a.c && three.every((c) => upper(c) <= 0.3 * body(c)))
      add("three-white-soldiers", i - 2, i);
    if (three.every(down) && ix.every((k) => isLong(x, k)) && a.o < z.o && a.o > z.c && b.o < a.o && b.o > a.c && a.c < z.c && b.c < a.c && three.every((c) => lower(c) <= 0.3 * body(c)))
      add("three-black-crows", i - 2, i);
    const haramiBull = tz === "down" && down(z) && isLong(x, i - 2) && body(a) <= 0.5 * body(z) && top(a) <= top(z) && bot(a) >= bot(z);
    const haramiBear = tz === "up" && up(z) && isLong(x, i - 2) && body(a) <= 0.5 * body(z) && top(a) <= top(z) && bot(a) >= bot(z);
    if (haramiBull && up(b) && b.c > z.o) add("three-inside-up", i - 2, i);
    if (haramiBear && down(b) && b.c < z.o) add("three-inside-down", i - 2, i);
    if (tz === "down" && down(z) && up(a) && a.o <= z.c && a.c >= z.o && body(a) > body(z) && up(b) && b.c > a.c) add("three-outside-up", i - 2, i);
    if (tz === "up" && up(z) && down(a) && a.o >= z.c && a.c <= z.o && body(a) > body(z) && down(b) && b.c < a.c) add("three-outside-down", i - 2, i);
    if (up(z) && up(a) && a.l > z.h && down(b) && b.o < a.c && b.o > a.o && b.c < a.l && b.c > z.h) add("tasuki-up", i - 2, i);
    if (down(z) && down(a) && a.h < z.l && up(b) && b.o > a.c && b.o < a.o && b.c > a.h && b.c < z.l) add("tasuki-down", i - 2, i);
    if (tz === "up" && up(z) && isLong(x, i - 2) && down(a) && bot(a) > z.c && down(b) && b.o > a.o && b.c < a.c && b.c > z.c) add("upside-gap-two-crows", i - 2, i);
    if (tz === "up" && three.every(up) && a.c > z.c && b.c > a.c && body(a) < body(z) && body(b) < body(a) && upper(a) > upper(z) && upper(b) > upper(a)) add("advance-block", i - 2, i);
    if (tz === "up" && up(z) && up(a) && isLong(x, i - 2) && isLong(x, i - 1) && up(b) && body(b) <= 0.5 * body(a) && Math.abs(b.o - a.c) <= Math.max(tol, 0.1 * body(a))) add("deliberation", i - 2, i);
    if (tz === "down" && down(z) && up(a) && down(b) && Math.abs(z.c - b.c) <= tol) add("stick-sandwich", i - 2, i);
    if (tz === "down" && down(z) && isLong(x, i - 2) && down(a) && a.l < z.l && lower(a) >= 2 * body(a) && a.c > z.c && a.c < z.o && up(b) && isSmall(x, i) && b.c < a.c) add("unique-three-river", i - 2, i);
    if (tz === "down" && [z, a, b].every(isDoji) && a.h < Math.min(z.l, b.l)) add("tri-star-bull", i - 2, i);
    if (tz === "up" && [z, a, b].every(isDoji) && a.l > Math.max(z.h, b.h)) add("tri-star-bear", i - 2, i);
    // ── four ──
    if (i >= 3) {
      const w = B[i - 3], c3 = [w, z, a];
      if (c3.every(up) && z.c > w.c && a.c > z.c && down(b) && b.o > a.c && b.c < w.o) add("three-line-strike-bull", i - 3, i);
      if (c3.every(down) && z.c < w.c && a.c < z.c && up(b) && b.o < a.c && b.c > w.o) add("three-line-strike-bear", i - 3, i);
    }
    // ── five ──
    if (i >= 4) {
      const f = B[i - 4], m3 = [B[i - 3], z, a], mk = [i - 3, i - 2, i - 1];
      if (up(f) && isLong(x, i - 4) && mk.every((k) => isSmall(x, k)) && m3.every((c) => c.h <= f.h && c.l >= f.l) && up(b) && isLong(x, i) && b.c > f.c) add("rising-three-methods", i - 4, i);
      if (down(f) && isLong(x, i - 4) && mk.every((k) => isSmall(x, k)) && m3.every((c) => c.h <= f.h && c.l >= f.l) && down(b) && isLong(x, i) && b.c < f.c) add("falling-three-methods", i - 4, i);
      const g = B[i - 3];
      if (up(f) && isLong(x, i - 4) && bot(g) > f.c && mk.every((k) => isSmall(x, k)) && [z, a].every((c) => c.l > mid(f)) && up(b) && b.c > Math.max(...m3.map((c) => c.h), f.h)) add("mat-hold", i - 4, i);
      const d3 = [f, B[i - 3], z];
      if (d3.every(down) && B[i - 3].c < f.c && z.c < B[i - 3].c && down(a) && upper(a) >= body(a) && up(b) && b.o > a.o) add("ladder-bottom", i - 4, i);
    }
    // ── tower: long, 2–5 small, long opposite ──
    for (let k = 2; k <= 5 && i - k - 1 >= 0; k++) {
      const s = i - k - 1, first = B[s];
      if (!isLong(x, s) || !isLong(x, i)) continue;
      let small = true;
      for (let j = s + 1; j < i; j++) if (!isSmall(x, j)) { small = false; break; }
      if (!small) continue;
      if (down(first) && up(b) && b.c > first.o) { add("tower-bottom", s, i); break; }
      if (up(first) && down(b) && b.c < first.o) { add("tower-top", s, i); break; }
    }
  }
  return out;
}
