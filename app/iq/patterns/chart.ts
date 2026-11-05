import { CATALOG } from "./catalog";
import { levelTol, type Swing } from "./swings";
import type { DetectOptions, PatternHit, PatternLine } from "./types";
import { range, type Ctx } from "./util";

function hit(id: string, i0: number, i1: number, at: number, price: number, extra: Partial<PatternHit> = {}): PatternHit {
  const d = CATALOG[id];
  return { id, name: d.name, group: d.group, signal: d.signal, i0, i1, at, price, ...extra };
}
const line = (i0: number, p0: number, i1: number, p1: number, role: PatternLine["role"]): PatternLine => ({ i0, p0, i1, p1, role });

/** First bar in (from, to] whose close is beyond `level(k)` in direction `dir`; -1 if none. */
function closeBeyond(x: Ctx, from: number, to: number, level: (k: number) => number, dir: 1 | -1): number {
  for (let k = from + 1; k <= Math.min(to, x.bars.length - 1); k++) if (dir > 0 ? x.bars[k].c > level(k) : x.bars[k].c < level(k)) return k;
  return -1;
}
const lastBar = (x: Ctx) => x.bars.length - 1;
const seq = (s: Swing[], j: number, pat: string) => j + pat.length <= s.length && [...pat].every((c, k) => s[j + k].hi === (c === "H"));

/**
 * Double tops and bottoms, head and shoulders, cup with and without handle.
 * Switched off (commented out below): Big M / W, ugly double bottom, triple
 * tops / bottoms, inverse head and shoulders, three rising valleys / falling
 * peaks, measured moves, inverted cup and handle, V-bottoms.
 */
export function detectSwingPatterns(x: Ctx, s: Swing[]): PatternHit[] {
  const out: PatternHit[] = [], B = x.bars, end = lastBar(x);
  for (let j = 0; j < s.length; j++) {
    // ── double top / bottom ──
    for (const top of [true, false]) {
      if (!seq(s, j, top ? "HLH" : "LHL")) continue;
      const [p1, m, p2] = [s[j], s[j + 1], s[j + 2]], t = levelTol(x, p2.i);
      const height = top ? Math.min(p1.p, p2.p) - m.p : m.p - Math.max(p1.p, p2.p);
      if (p2.i - p1.i < 5 || height < 3 * t) continue;
      const win = p2.i + 2 * (p2.i - p1.i);
      const conf = closeBeyond(x, p2.i, win, () => m.p, top ? -1 : 1);
      const forming = conf < 0 && win >= end;
      let id = "";
      if (Math.abs(p1.p - p2.p) <= t) {
        // Big M / W off: a tall double top / bottom after a long run is reported as the plain double top / bottom.
        // const prev = s[j - 1], run = prev ? Math.abs(p1.p - prev.p) : 0;
        // id = height >= 4 * (x.atr[p2.i] || Infinity) && run >= 2 * height ? (top ? "big-m" : "big-w") : top ? "double-top" : "double-bottom";
        id = top ? "double-top" : "double-bottom";
      }
      // else if (!top && p2.p - p1.p > t && p2.p - p1.p <= 0.5 * (m.p - p1.p)) id = "ugly-double-bottom";
      if (!id || (conf < 0 && !forming)) continue;
      const k = conf >= 0 ? conf : end;
      out.push(hit(id, p1.i, k, k, top ? Math.max(p1.p, p2.p) : Math.min(p1.p, p2.p), {
        confirmed: conf >= 0,
        target: top ? m.p - height : m.p + height,
        lines: [line(p1.i, m.p, k, m.p, "neckline")],
        points: [{ i: p1.i, p: p1.p, label: top ? "T1" : "B1" }, { i: p2.i, p: p2.p, label: top ? "T2" : "B2" }],
      }));
    }
    // ── head and shoulders (top only; inverse off) ──
    for (const top of [true /* , false */]) {
      if (!seq(s, j, top ? "HLHLH" : "LHLHL")) continue;
      const [a, t1, b, t2, c] = s.slice(j, j + 5), tol = levelTol(x, c.i);
      const span = c.i - a.i, win = c.i + span;
      // ── triple top / bottom (off) ──
      // const peaks = [a.p, b.p, c.p], avg = (a.p + b.p + c.p) / 3;
      // if (peaks.every((p) => Math.abs(p - avg) <= tol)) {
      //   const neck = top ? Math.min(t1.p, t2.p) : Math.max(t1.p, t2.p);
      //   const conf = closeBeyond(x, c.i, win, () => neck, top ? -1 : 1);
      //   if (conf >= 0 || win >= end) {
      //     const k = conf >= 0 ? conf : end;
      //     out.push(hit(top ? "triple-top" : "triple-bottom", a.i, k, k, top ? Math.max(...peaks) : Math.min(...peaks), {
      //       confirmed: conf >= 0, lines: [line(a.i, neck, k, neck, "neckline")],
      //       points: [a, b, c].map((q, n) => ({ i: q.i, p: q.p, label: String(n + 1) })),
      //     }));
      //   }
      // }
      const headOk = top ? b.p >= Math.max(a.p, c.p) + tol : b.p <= Math.min(a.p, c.p) - tol;
      const hgt = Math.abs(b.p - (top ? Math.min(t1.p, t2.p) : Math.max(t1.p, t2.p)));
      if (headOk && Math.abs(a.p - c.p) <= 0.5 * hgt) {
        const nl = (k: number) => t1.p + ((t2.p - t1.p) * (k - t1.i)) / (t2.i - t1.i || 1);
        const conf = closeBeyond(x, c.i, win, nl, top ? -1 : 1);
        if (conf >= 0 || win >= end) {
          const k = conf >= 0 ? conf : end, depth = Math.abs(b.p - nl(b.i));
          out.push(hit(top ? "head-shoulders-top" : "head-shoulders-bottom", a.i, k, k, b.p, {
            confirmed: conf >= 0, target: top ? nl(k) - depth : nl(k) + depth,
            lines: [line(t1.i, t1.p, k, nl(k), "neckline")],
            points: [{ i: a.i, p: a.p, label: "LS" }, { i: b.i, p: b.p, label: "H" }, { i: c.i, p: c.p, label: "RS" }],
          }));
        }
      }
      // ── three rising valleys (L H L H L) / three falling peaks (H L H L H) (off) ──
      // const steps = top ? [a.p - b.p, b.p - c.p] : [b.p - a.p, c.p - b.p];
      // if (steps.every((d) => d > tol)) {
      //   const lvl = top ? Math.min(t1.p, t2.p) : Math.max(t1.p, t2.p);
      //   const conf = closeBeyond(x, c.i, win, () => lvl, top ? -1 : 1);
      //   if (conf >= 0) out.push(hit(top ? "three-falling-peaks" : "three-rising-valleys", a.i, conf, conf, c.p, {
      //     confirmed: true, lines: [line(a.i, a.p, c.i, c.p, "trend"), line(t1.i, lvl, conf, lvl, "level")],
      //   }));
      // }
    }
    // ── measured move up / down (off) ──
    // for (const upMove of [true, false]) {
    //   if (!seq(s, j, upMove ? "LHLH" : "HLHL")) continue;
    //   const [p0, p1, p2, p3] = s.slice(j, j + 4);
    //   const leg1 = Math.abs(p1.p - p0.p), corr = Math.abs(p1.p - p2.p), leg2 = Math.abs(p3.p - p2.p);
    //   if (leg1 > 0 && corr >= 0.3 * leg1 && corr <= 0.7 * leg1 && leg2 >= 0.7 * leg1 && leg2 <= 1.3 * leg1)
    //     out.push(hit(upMove ? "measured-move-up" : "measured-move-down", p0.i, p3.i, p3.i, p3.p, {
    //       lines: [line(p0.i, p0.p, p1.i, p1.p, "leg"), line(p1.i, p1.p, p2.i, p2.p, "leg"), line(p2.i, p2.p, p3.i, p3.p, "leg")],
    //     }));
    // }
    // ── cup without handle: rim, rounded low, then one rise closing above the rim with no swing pullback on the way ──
    if (seq(s, j, "HL")) {
      const [r1, bt] = [s[j], s[j + 1]], rim = r1.p, depth = rim - bt.p, atr = x.atr[r1.i] || Infinity;
      const next = s[j + 2]; // the first swing after the low: a pullback before the breakout is a handle
      const brk = closeBeyond(x, bt.i, Math.min(end, bt.i + 2 * (bt.i - r1.i)), () => rim, 1);
      const handle = next !== undefined && (brk < 0 || next.i < brk);
      const k = brk >= 0 ? brk : end;
      // Forming: the low is the last swing and price has climbed back into the cup's top third.
      const forming = brk < 0 && next === undefined && B[end].c >= bt.p + (2 * depth) / 3;
      // Rounded, not a V: a straight-line V spends a third of its bars in its bottom third, a U about half.
      let deep = 0;
      for (let q = r1.i + 1; q < k; q++) if (B[q].c <= bt.p + depth / 3) deep++;
      if (depth >= 4 * atr && k - r1.i >= 15 && !handle && (brk >= 0 || forming) && deep >= 0.4 * (k - r1.i))
        out.push(hit("cup-no-handle", r1.i, k, k, bt.p, {
          confirmed: brk >= 0, target: rim + depth,
          lines: [line(r1.i, rim, k, rim, "neckline")],
          points: [{ i: bt.i, p: bt.p, label: "Cup" }],
        }));
    }
    // ── cup and handle (inverted off) ──
    for (const cup of [true /* , false */]) {
      if (!seq(s, j, cup ? "HLHL" : "LHLH")) continue;
      const [r1, bt, r2, hd] = s.slice(j, j + 4), t = levelTol(x, r2.i);
      const rim = cup ? Math.max(r1.p, r2.p) : Math.min(r1.p, r2.p);
      const depth = cup ? Math.min(r1.p, r2.p) - bt.p : bt.p - Math.max(r1.p, r2.p), width = r2.i - r1.i;
      if (Math.abs(r1.p - r2.p) > 2 * t || depth < 4 * (x.atr[r2.i] || Infinity) || width < 15) continue;
      let deep = 0;
      for (let k = r1.i + 1; k < r2.i; k++) if (cup ? B[k].c <= bt.p + depth / 3 : B[k].c >= bt.p - depth / 3) deep++;
      const handleDepth = Math.abs(r2.p - hd.p);
      if (deep < 0.25 * width || handleDepth > depth / 2 || hd.i - r2.i > 0.5 * width || hd.i - r2.i < 2) continue;
      const conf = closeBeyond(x, hd.i, hd.i + width, () => rim, cup ? 1 : -1);
      if (conf < 0 && hd.i + width < end) continue;
      const k = conf >= 0 ? conf : end;
      out.push(hit(cup ? "cup-handle" : "cup-handle-inverted", r1.i, k, k, cup ? bt.p : bt.p, {
        confirmed: conf >= 0, target: cup ? rim + depth : rim - depth,
        lines: [line(r1.i, rim, k, rim, "neckline")],
        points: [{ i: bt.i, p: bt.p, label: cup ? "Cup" : "Cap" }, { i: hd.i, p: hd.p, label: "Handle" }],
      }));
    }
    // ── V-bottom (off) ──
    // if (seq(s, j, "HL")) {
    //   const [h0, lo] = [s[j], s[j + 1]], drop = h0.p - lo.p, dur = lo.i - h0.i;
    //   if (drop >= 5 * (x.atr[lo.i] || Infinity) && dur <= 15) {
    //     let k = -1;
    //     for (let q = lo.i + 1; q <= Math.min(end, lo.i + Math.ceil(1.5 * dur)); q++) if (B[q].h >= lo.p + 0.7 * drop) { k = q; break; }
    //     let near = 0;
    //     for (let q = Math.max(0, lo.i - 5); q <= Math.min(end, lo.i + 5); q++) if (B[q].l <= lo.p + 0.5 * (x.atr[lo.i] || 0)) near++;
    //     if (k >= 0 && near <= 3) out.push(hit("v-bottom", h0.i, k, lo.i, lo.p, { confirmed: true, lines: [line(h0.i, h0.p, lo.i, lo.p, "leg"), line(lo.i, lo.p, k, B[k].h, "leg")] }));
    //   }
    // }
  }
  return out;
}

/** Least-squares line through (i, p) points. */
function fit(pts: Array<{ i: number; p: number }>): { m: number; b: number } {
  const n = pts.length, sx = pts.reduce((a, q) => a + q.i, 0), sy = pts.reduce((a, q) => a + q.p, 0);
  const sxx = pts.reduce((a, q) => a + q.i * q.i, 0), sxy = pts.reduce((a, q) => a + q.i * q.p, 0);
  const d = n * sxx - sx * sx;
  const m = d === 0 ? 0 : (n * sxy - sx * sy) / d;
  return { m, b: (sy - m * sx) / n };
}

/** Triangles, wedges, broadening formations, channels, rectangles, line formations and diamonds, from 5–6 consecutive swings. */
export function detectLinePatterns(x: Ctx, s: Swing[]): PatternHit[] {
  const B = x.bars, end = lastBar(x), cand: Array<PatternHit & { score: number }> = [];
  for (const size of [6, 5]) {
    for (let j = 0; j + size <= s.length; j++) {
      const w = s.slice(j, j + size), hs = w.filter((q) => q.hi), ls = w.filter((q) => !q.hi);
      if (hs.length < 2 || ls.length < 2) continue;
      const i0 = w[0].i, i1 = w[size - 1].i, span = i1 - i0;
      if (span < 10) continue;
      const t = levelTol(x, i1);
      const U = fit(hs), L = fit(ls), u = (k: number) => U.m * k + U.b, l = (k: number) => L.m * k + L.b;
      if (hs.some((q) => Math.abs(q.p - u(q.i)) > t) || ls.some((q) => Math.abs(q.p - l(q.i)) > t)) continue;
      const du = U.m * span, dl = L.m * span;
      const dir = (d: number) => (Math.abs(d) <= t ? 0 : d > 0 ? 1 : -1);
      const su = dir(du), sl = dir(dl), w0 = u(i0) - l(i0), w1 = u(i1) - l(i1);
      if (w0 <= 0 || w1 <= 0) continue;
      const shape = w0 - w1 > t ? "conv" : w1 - w0 > t ? "div" : "par";
      let id = "";
      if (shape === "conv") {
        if (su === 0 && sl > 0) id = "triangle-ascending";
        else if (su < 0 && sl === 0) id = "triangle-descending";
        else if (su < 0 && sl > 0) id = "triangle-symmetrical";
        else if (su > 0 && sl > 0) id = "wedge-rising";
        else if (su < 0 && sl < 0) id = "wedge-falling";
      } else if (shape === "div") {
        if (su > 0 && sl < 0) {
          const before = B[Math.max(0, i0 - 20)].c, first = w[0].p;
          id = first > before + t ? "broadening-top" : first < before - t ? "broadening-bottom" : "broadening";
        } else if (su > 0 && sl === 0) id = "broadening-ra-ascending";
        else if (su === 0 && sl < 0) id = "broadening-ra-descending";
        else if (su > 0 && sl > 0) id = "broadening-wedge-ascending";
        else if (su < 0 && sl < 0) id = "broadening-wedge-descending";
      } else {
        if (su > 0 && sl > 0) id = "channel-ascending";
        else if (su < 0 && sl < 0) id = "channel-descending";
        else if (su === 0 && sl === 0) id = w1 <= 3 * (x.atr[i1] || 0) && span >= 40 ? "line-formation" : span >= 60 ? "channel-horizontal" : "rectangle";
      }
      if (!id) continue;
      // Breakout: the first close outside the lines after the last swing.
      const upK = closeBeyond(x, i1, i1 + span, (k) => u(k) + 0.1 * (x.atr[k] || 0), 1);
      const dnK = closeBeyond(x, i1, i1 + span, (k) => l(k) - 0.1 * (x.atr[k] || 0), -1);
      const k = [upK, dnK].filter((q) => q >= 0).sort((a, b) => a - b)[0] ?? -1;
      if (k < 0 && i1 + span < end) continue;
      const e = k >= 0 ? k : end;
      cand.push({
        ...hit(id, i0, e, e, k === upK ? u(e) : l(e)), confirmed: k >= 0,
        lines: [line(i0, u(i0), e, u(e), "trend"), line(i0, l(i0), e, l(e), "trend")],
        score: span,
      });
    }
  }
  // Diamonds: 7 swings, the first four widening, the last four narrowing, extremes in the middle.
  for (let j = 0; j + 7 <= s.length; j++) {
    const w = s.slice(j, j + 7), first = w.slice(0, 4), last = w.slice(3);
    const hiF = first.filter((q) => q.hi), loF = first.filter((q) => !q.hi), hiL = last.filter((q) => q.hi), loL = last.filter((q) => !q.hi);
    if (hiF.length < 2 || loF.length < 2 || hiL.length < 2 || loL.length < 2) continue;
    const widen = hiF[1].p > hiF[0].p && loF[1].p < loF[0].p, narrow = hiL[1].p < hiL[0].p && loL[1].p > loL[0].p;
    const hiIdx = w.reduce((a, q, n) => (q.hi && q.p > w[a].p ? n : a), w.findIndex((q) => q.hi));
    const loIdx = w.reduce((a, q, n) => (!q.hi && q.p < w[a].p ? n : a), w.findIndex((q) => !q.hi));
    if (!widen || !narrow || hiIdx < 2 || hiIdx > 4 || loIdx < 2 || loIdx > 4) continue;
    const i0 = w[0].i, i1 = w[6].i, before = B[Math.max(0, i0 - 20)].c;
    const id = w[0].p >= before ? "diamond-top" : "diamond-bottom";
    const H = w[hiIdx], Lw = w[loIdx];
    cand.push({
      ...hit(id, i0, i1, i1, id === "diamond-top" ? H.p : Lw.p),
      lines: [line(i0, w[0].p, H.i, H.p, "trend"), line(H.i, H.p, i1, w[6].p, "trend"), line(i0, w[0].p, Lw.i, Lw.p, "trend"), line(Lw.i, Lw.p, i1, w[6].p, "trend")],
      score: i1 - i0,
    });
  }
  // Keep the longest of overlapping candidates.
  cand.sort((a, b) => b.score - a.score);
  const kept: PatternHit[] = [];
  for (const c of cand) {
    const overlap = kept.some((k) => Math.min(k.i1, c.i1) - Math.max(k.i0, c.i0) > 0.5 * (c.i1 - c.i0));
    if (!overlap) { const { score: _s, ...h } = c; void _s; kept.push(h); }
  }
  return kept;
}

/** High and tight flags on daily bars. Flags and pennants are switched off (commented out below). */
export function detectFlags(x: Ctx, opt: DetectOptions): PatternHit[] {
  const B = x.bars, n = B.length, out: PatternHit[] = [];
  let skipTo = -1;
  for (let ib = 12; ib < n - 4; ib++) {
    if (ib <= skipTo) continue;
    for (const bull of [true, false]) {
      const win = B.slice(ib - 12, ib);
      const startIdx = ib - 12 + (bull ? win.reduce((a, q, k) => (q.l < win[a].l ? k : a), 0) : win.reduce((a, q, k) => (q.h > win[a].h ? k : a), 0));
      const startP = bull ? B[startIdx].l : B[startIdx].h, poleEnd = bull ? B[ib].h : B[ib].l, pole = Math.abs(poleEnd - startP);
      const htf = opt.daily && bull && pole >= 0.9 * startP;
      if (pole < 4 * (x.atr[ib] || Infinity)) continue;
      if (bull ? B[ib].h < Math.max(...B.slice(startIdx, ib + 1).map((q) => q.h)) : B[ib].l > Math.min(...B.slice(startIdx, ib + 1).map((q) => q.l))) continue;
      // consolidation: 4–20 bars inside the far half of the pole and below (above) its end
      let e = ib + 1, brk = -1;
      const maxLen = htf ? 15 : 20, giveBack = htf ? 0.25 : 0.5;
      for (; e < n && e - ib <= maxLen + 1; e++) {
        const q = B[e];
        if (bull ? q.c > poleEnd : q.c < poleEnd) { brk = e; break; }
        if (bull ? q.l < poleEnd - giveBack * pole : q.h > poleEnd + giveBack * pole) { e = -1; break; }
      }
      if (e < 0) continue;
      const last = brk >= 0 ? brk - 1 : Math.min(n - 1, e - 1), len = last - ib;
      if (len < (htf ? 3 : 4) || len > maxLen || (brk < 0 && e < n)) continue;
      const cons = B.slice(ib + 1, last + 1).map((q, k) => ({ i: ib + 1 + k, q }));
      const U = fit(cons.map(({ i, q }) => ({ i, p: q.h }))), L = fit(cons.map(({ i, q }) => ({ i, p: q.l })));
      const t = levelTol(x, ib), du = U.m * len, dl = L.m * len;
      const converging = du < -t / 2 && dl > t / 2;
      const parallel = Math.abs(du - dl) <= t;
      const against = bull ? du <= t : du >= -t;
      let id = "";
      if (htf) id = "high-tight-flag";
      // else if (converging) id = bull ? "pennant-bull" : "pennant-bear";
      // else if (parallel && against) id = bull ? "flag-bull" : "flag-bear";
      void converging; void parallel; void against;
      if (!id) continue;
      const k = brk >= 0 ? brk : last;
      out.push(hit(id, startIdx, k, k, bull ? B[ib].h : B[ib].l, {
        confirmed: brk >= 0, target: bull ? poleEnd + pole : poleEnd - pole,
        lines: [line(startIdx, startP, ib, poleEnd, "leg"), line(ib + 1, U.m * (ib + 1) + U.b, last, U.m * last + U.b, "trend"), line(ib + 1, L.m * (ib + 1) + L.b, last, L.m * last + L.b, "trend")],
      }));
      skipTo = k;
      break;
    }
  }
  return out;
}

/** Rounding tops / bottoms and scallops: closes fitting a parabola over 30–60 bars. */
export function detectRounding(x: Ctx): PatternHit[] {
  const B = x.bars, n = B.length, cand: Array<PatternHit & { r2: number; w: number }> = [];
  for (const W of [30, 45, 60]) {
    for (let e = W - 1; e < n; e += 5) {
      const s0 = e - W + 1, ys = B.slice(s0, e + 1).map((q) => q.c), xs = ys.map((_, k) => k / (W - 1));
      // least squares y = a x² + b x + c
      let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
      for (let k = 0; k < W; k++) { const X = xs[k], Y = ys[k]; S0++; S1 += X; S2 += X * X; S3 += X ** 3; S4 += X ** 4; T0 += Y; T1 += X * Y; T2 += X * X * Y; }
      const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      const M = [[S4, S3, S2], [S3, S2, S1], [S2, S1, S0]], D = det(M);
      if (!D) continue;
      const a = det([[T2, S3, S2], [T1, S2, S1], [T0, S1, S0]]) / D, b = det([[S4, T2, S2], [S3, T1, S1], [S2, T0, S0]]) / D, c = det([[S4, S3, T2], [S3, S2, T1], [S2, S1, T0]]) / D;
      const mean = T0 / W;
      let ssr = 0, sst = 0;
      for (let k = 0; k < W; k++) { const f = a * xs[k] ** 2 + b * xs[k] + c; ssr += (ys[k] - f) ** 2; sst += (ys[k] - mean) ** 2; }
      const r2 = sst ? 1 - ssr / sst : 0, v = a ? -b / (2 * a) : -1;
      if (r2 < 0.85 || v < 0.15 || v > 0.7) continue;
      const vertex = a * v * v + b * v + c, ends = (ys[0] + ys[W - 1]) / 2, depth = Math.abs(ends - vertex), atr = x.atr[e] || Infinity;
      if (depth < 4 * atr) continue;
      const skew = ys[W - 1] - ys[0];
      let id = "";
      if (a > 0) {
        if (v >= 0.3 && Math.abs(skew) <= 0.25 * depth) id = "rounding-bottom";
        else if (skew >= 0.3 * depth) id = "scallop-ascending";
        else if (-skew >= 0.3 * depth) id = "scallop-descending";
      } else if (a < 0 && v >= 0.3 && Math.abs(skew) <= 0.25 * depth) id = "rounding-top";
      if (!id) continue;
      const pts: Array<{ i: number; p: number }> = [];
      for (let k = 0; k < W; k += Math.max(1, Math.floor(W / 12))) pts.push({ i: s0 + k, p: a * xs[k] ** 2 + b * xs[k] + c });
      pts.push({ i: e, p: a + b + c });
      const lines = pts.slice(1).map((q, k) => line(pts[k].i, pts[k].p, q.i, q.p, "trend"));
      cand.push({ ...hit(id, s0, e, s0 + Math.round(v * (W - 1)), vertex), lines, r2, w: W });
    }
  }
  // Longest qualifying window first (a short window on part of the curve is not the pattern), then the best fit.
  cand.sort((a, b) => b.w - a.w || b.r2 - a.r2);
  const kept: PatternHit[] = [];
  for (const c of cand) if (!kept.some((k) => Math.min(k.i1, c.i1) - Math.max(k.i0, c.i0) > 0)) { const { r2: _r, w: _w, ...h } = c; void _r; void _w; kept.push(h); }
  return kept;
}

/** Dead-cat bounces (daily), horns and pipes (weekly). */
export function detectEvents(x: Ctx, opt: DetectOptions): PatternHit[] {
  const B = x.bars, n = B.length, out: PatternHit[] = [];
  if (opt.daily) {
    for (let i = 1; i < n; i++) {
      const r = B[i].c / B[i - 1].c - 1;
      if (r <= -0.15) {
        let bounced = false;
        for (let k = i + 1; k < Math.min(n, i + 21); k++) {
          if (B[k].h > B[i].c) bounced = true;
          if (bounced && B[k].c < B[i].l) { out.push(hit("dead-cat-bounce", i, k, k, B[k].l, { confirmed: true })); break; }
        }
      }
      if (r >= 0.1) for (let k = i + 1; k < Math.min(n, i + 11); k++) if (B[k].c < B[i].o) { out.push(hit("dead-cat-bounce-inverted", i, k, k, B[i].h, { confirmed: true })); break; }
    }
  }
  if (opt.weekly) {
    for (let i = 10; i < n; i++) {
      const prior = B.slice(i - 10, i), t = levelTol(x, i), big = (k: number) => range(B[k]) >= 1.5 * (x.avgRange[k] || Infinity);
      const hi10 = Math.max(...prior.map((q) => q.h)), lo10 = Math.min(...prior.map((q) => q.l));
      // pipes: two adjacent tall bars at the same extreme
      if (big(i) && big(i - 1) && Math.abs(B[i].h - B[i - 1].h) <= t && B[i].h >= hi10 - t) out.push(hit("pipe-top", i - 1, i, i, B[i].h));
      if (big(i) && big(i - 1) && Math.abs(B[i].l - B[i - 1].l) <= t && B[i].l <= lo10 + t) out.push(hit("pipe-bottom", i - 1, i, i, B[i].l));
      // horns: spikes one bar apart with a lower (higher) bar between
      if (i >= 12) {
        const a = B[i - 2], m = B[i - 1], b = B[i];
        if (Math.abs(a.h - b.h) <= t && m.h < Math.min(a.h, b.h) - t && b.h >= hi10 - t) out.push(hit("horn-top", i - 2, i, i, b.h));
        if (Math.abs(a.l - b.l) <= t && m.l > Math.max(a.l, b.l) + t && b.l <= lo10 + t) out.push(hit("horn-bottom", i - 2, i, i, b.l));
      }
    }
  }
  return out;
}
