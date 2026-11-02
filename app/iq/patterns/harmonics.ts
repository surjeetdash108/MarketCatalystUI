import { CATALOG } from "./catalog";
import { levelTol, type Swing } from "./swings";
import type { PatternHit } from "./types";
import type { Ctx } from "./util";

/** v within [lo, hi] widened by 5% (a single target is lo = hi). */
const within = (v: number, lo: number, hi = lo) => v >= lo * 0.95 && v <= hi * 1.05;

function harmonic(id: string, pts: Swing[], labels: string[]): PatternHit {
  const d = CATALOG[id], last = pts[pts.length - 1];
  return {
    id, name: d.name, group: "harmonic", signal: d.signal, i0: pts[0].i, i1: last.i, at: last.i, price: last.p,
    points: pts.map((p, k) => ({ i: p.i, p: p.p, label: labels[k] })),
    lines: pts.slice(1).map((p, k) => ({ i0: pts[k].i, p0: pts[k].p, i1: p.i, p1: p.p, role: "leg" as const })),
  };
}

/** XABCD harmonics, AB=CD, three drives, Wolfe waves and Quasimodo, from consecutive swings (ratios in catalog.ts). */
export function detectHarmonics(x: Ctx, s: Swing[]): PatternHit[] {
  const out: PatternHit[] = [];
  for (let j = 0; j < s.length; j++) {
    // AB=CD
    if (j + 4 <= s.length) {
      const [A, B, C, D] = s.slice(j, j + 4), AB = Math.abs(A.p - B.p), BC = Math.abs(B.p - C.p), CD = Math.abs(C.p - D.p);
      if (AB > 0 && within(BC / AB, 0.382, 0.886) && CD / AB >= 0.9 && CD / AB <= 1.1) out.push(harmonic(D.hi ? "abcd-bear" : "abcd-bull", [A, B, C, D], ["A", "B", "C", "D"]));
    }
    // XABCD
    if (j + 5 <= s.length) {
      const [X, A, B, C, D] = s.slice(j, j + 5), bull = !D.hi;
      const XA = Math.abs(A.p - X.p), AB = Math.abs(A.p - B.p), BC = Math.abs(B.p - C.p);
      if (XA > 0 && AB > 0) {
        const rB = AB / XA, rC = BC / AB, rD = Math.abs(A.p - D.p) / XA, XC = Math.abs(C.p - X.p), rXC = XC ? Math.abs(C.p - D.p) / XC : 0;
        const sfx = bull ? "-bull" : "-bear", L = ["X", "A", "B", "C", "D"];
        if (within(rB, 0.618) && within(rC, 0.382, 0.886) && within(rD, 0.786)) out.push(harmonic("gartley" + sfx, [X, A, B, C, D], L));
        else if (within(rB, 0.382, 0.5) && within(rC, 0.382, 0.886) && within(rD, 0.886)) out.push(harmonic("bat" + sfx, [X, A, B, C, D], L));
        else if (within(rB, 0.786) && within(rC, 0.382, 0.886) && within(rD, 1.27, 1.618)) out.push(harmonic("butterfly" + sfx, [X, A, B, C, D], L));
        else if (within(rB, 0.382, 0.618) && within(rC, 0.382, 0.886) && within(rD, 1.618)) out.push(harmonic("crab" + sfx, [X, A, B, C, D], L));
        const beyondA = bull ? C.p > A.p : C.p < A.p;
        if (beyondA && within(rC, 1.13, 1.618) && within(rXC, 0.886, 1.13)) out.push(harmonic("shark" + sfx, [X, A, B, C, D], L));
        if (beyondA && within(rB, 0.382, 0.618) && within(Math.abs(C.p - X.p) / XA, 1.272, 1.414) && within(rXC, 0.786)) out.push(harmonic("cypher" + sfx, [X, A, B, C, D], L));
      }
    }
    // Three drives: six swings ending in the third drive
    if (j + 6 <= s.length) {
      const w = s.slice(j, j + 6), bear = w[5].hi;
      const drives = [0, 2, 4].map((k) => Math.abs(w[k + 1].p - w[k].p));
      const peaks = [w[1], w[3], w[5]];
      const rising = bear ? peaks[1].p > peaks[0].p && peaks[2].p > peaks[1].p : peaks[1].p < peaks[0].p && peaks[2].p < peaks[1].p;
      const mean = (drives[0] + drives[1] + drives[2]) / 3;
      const pull = [Math.abs(w[1].p - w[2].p) / drives[0], Math.abs(w[3].p - w[4].p) / drives[1]];
      if (rising && mean > 0 && drives.every((d) => Math.abs(d - mean) <= 0.25 * mean) && pull.every((r) => r >= 0.5 && r <= 0.786))
        out.push(harmonic(bear ? "three-drives-bear" : "three-drives-bull", w, ["0", "D1", "", "D2", "", "D3"]));
    }
    // Wolfe wave: points 1–5
    if (j + 5 <= s.length) {
      const [p1, p2, p3, p4, p5] = s.slice(j, j + 5), bull = !p1.hi;
      const l13 = (k: number) => p1.p + ((p3.p - p1.p) * (k - p1.i)) / (p3.i - p1.i || 1);
      const ok = bull
        ? p3.p < p1.p && p4.p > p1.p && p4.p < p2.p && p5.p < p3.p && p5.p < l13(p5.i)
        : p3.p > p1.p && p4.p < p1.p && p4.p > p2.p && p5.p > p3.p && p5.p > l13(p5.i);
      if (ok) {
        const h = harmonic(bull ? "wolfe-bull" : "wolfe-bear", [p1, p2, p3, p4, p5], ["1", "2", "3", "4", "5"]);
        const t14 = (k: number) => p1.p + ((p4.p - p1.p) * (k - p1.i)) / (p4.i - p1.i || 1);
        const ext = p5.i + (p5.i - p1.i) / 2;
        h.lines = [...(h.lines ?? []), { i0: p1.i, p0: p1.p, i1: ext, p1: t14(ext), role: "target" }];
        out.push(h);
      }
    }
    // Quasimodo
    if (j + 4 <= s.length) {
      const [a, b, c, d] = s.slice(j, j + 4), t = levelTol(x, d.i);
      if (!a.hi && c.p < a.p - t && d.p > b.p + t) out.push(harmonic("quasimodo-bull", [a, b, c, d], ["L", "H", "LL", "HH"]));
      if (a.hi && c.p > a.p + t && d.p < b.p - t) out.push(harmonic("quasimodo-bear", [a, b, c, d], ["H", "L", "HH", "LL"]));
    }
  }
  return out;
}
