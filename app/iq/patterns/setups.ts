import { CATALOG } from "./catalog";
import { levelTol, type Swing } from "./swings";
import type { DetectOptions, PatternHit } from "./types";
import { down, range, trendInto, up, type Ctx } from "./util";

function hit(id: string, i0: number, i1: number, at: number, price: number, extra: Partial<PatternHit> = {}): PatternHit {
  const d = CATALOG[id];
  return { id, name: d.name, group: d.group, signal: d.signal, i0, i1, at, price, ...extra };
}

/** Growth setups (Darvas box, flat base, VCP, ascending base) and price-action events (spring, upthrust, failure swing, S/R flip, climax). */
export function detectSetups(x: Ctx, s: Swing[], opt: DetectOptions): PatternHit[] {
  const B = x.bars, n = B.length, out: PatternHit[] = [];
  const hiOf = (a: number, b: number) => Math.max(...B.slice(Math.max(0, a), b + 1).map((q) => q.h));
  const loOf = (a: number, b: number) => Math.min(...B.slice(Math.max(0, a), b + 1).map((q) => q.l));

  if (opt.daily && n >= 60) {
    // Darvas box
    for (let i = 20; i < n - 4; i++) {
      if (B[i].h < hiOf(i - Math.min(252, i), i - 1)) continue;
      const topP = B[i].h;
      if (hiOf(i + 1, i + 3) >= topP) continue;
      let m = -1;
      for (let k = i + 1; k < n - 3; k++) {
        if (B[k].h >= topP) break;
        if (loOf(k + 1, k + 3) > B[k].l && hiOf(k + 1, k + 3) < topP && B[k].l === loOf(i + 1, k)) { m = k; break; }
      }
      if (m < 0) continue;
      const bottomP = B[m].l;
      let brk = -1;
      for (let k = m + 4; k < n; k++) { if (B[k].c > topP) { brk = k; break; } if (B[k].c < bottomP) break; }
      if (brk < 0) continue;
      out.push(hit("darvas-box", i, brk, brk, topP, {
        confirmed: true, lines: [{ i0: i, p0: topP, i1: brk, p1: topP, role: "level" }, { i0: i, p0: bottomP, i1: brk, p1: bottomP, role: "level" }],
      }));
      i = brk;
    }
    // Flat base
    for (let e = 85; e < n; e++) {
      const s0 = e - 24, top = hiOf(s0, e), low = loOf(s0, e);
      if ((top - low) / top > 0.15) continue;
      const prior = B.slice(e - 85, e - 24).map((q) => q.c);
      if (B[s0 - 1].c / Math.min(...prior) - 1 < 0.2) continue;
      let k = e;
      while (k + 1 < n && (Math.max(top, B[k + 1].h) - Math.min(low, B[k + 1].l)) / Math.max(top, B[k + 1].h) <= 0.15 && B[k + 1].c <= top) k++;
      const brk = k + 1 < n && B[k + 1].c > top ? k + 1 : -1;
      out.push(hit("flat-base", s0, brk >= 0 ? brk : k, brk >= 0 ? brk : k, top, {
        confirmed: brk >= 0, lines: [{ i0: s0, p0: top, i1: k, p1: top, role: "level" }, { i0: s0, p0: low, i1: k, p1: low, role: "level" }],
      }));
      e = k + 25;
    }
    // Ascending base: three 10–20% pullbacks with higher highs and higher lows
    for (let j = 0; j + 6 <= s.length; j++) {
      const w = s.slice(j, j + 6);
      if (!w.every((q, k) => q.hi === (k % 2 === 0))) continue;
      const hs = [w[0], w[2], w[4]], ls = [w[1], w[3], w[5]];
      const depths = hs.map((h, k) => (h.p - ls[k].p) / h.p);
      if (depths.every((d) => d >= 0.1 && d <= 0.2) && hs[1].p > hs[0].p && hs[2].p > hs[1].p && ls[1].p > ls[0].p && ls[2].p > ls[1].p)
        out.push(hit("ascending-base", w[0].i, w[5].i, w[5].i, w[5].p, { lines: w.slice(1).map((q, k) => ({ i0: w[k].i, p0: w[k].p, i1: q.i, p1: q.p, role: "leg" as const })) }));
    }
  }

  // VCP: 3+ pullbacks, each ≤ 80% as deep as the one before, highs within 5% of the first
  for (let j = 0; j + 6 <= s.length; j++) {
    if (!s[j].hi) continue;
    const pulls: Array<{ h: Swing; l: Swing; d: number }> = [];
    for (let k = j; k + 1 < s.length && s[k].hi && !s[k + 1].hi; k += 2) {
      const d = s[k].p - s[k + 1].p;
      if (pulls.length && (d > 0.8 * pulls[pulls.length - 1].d || Math.abs(s[k].p - s[j].p) > 0.05 * s[j].p)) break;
      pulls.push({ h: s[k], l: s[k + 1], d });
    }
    if (pulls.length < 3) continue;
    const vol = (a: number, b: number) => { const v = B.slice(a, b + 1).map((q) => q.v ?? NaN); return v.every((q) => Number.isFinite(q)) ? v.reduce((p, q) => p + q, 0) / v.length : NaN; };
    const vols = pulls.map((p) => vol(p.h.i, p.l.i));
    if (vols.every((v) => Number.isFinite(v)) && !vols.every((v, k) => k === 0 || v < vols[k - 1])) continue;
    const lastH = pulls[pulls.length - 1].h, lastL = pulls[pulls.length - 1].l;
    let brk = -1;
    for (let k = lastL.i + 1; k < n; k++) { if (B[k].c > lastH.p) { brk = k; break; } if (B[k].c < lastL.p) break; }
    out.push(hit("vcp", pulls[0].h.i, brk >= 0 ? brk : lastL.i, brk >= 0 ? brk : lastL.i, lastH.p, {
      confirmed: brk >= 0, lines: pulls.map((p) => ({ i0: p.h.i, p0: p.h.p, i1: p.l.i, p1: p.l.p, role: "leg" as const })),
    }));
    j += pulls.length * 2 - 1;
  }

  // Spring / upthrust: a break of a tight 20-bar range that closes back inside within two bars
  for (let i = 21; i < n; i++) {
    const hi = hiOf(i - 20, i - 1), lo = loOf(i - 20, i - 1);
    if (hi - lo > 4 * (x.atr[i] || 0)) continue;
    const back = (f: (k: number) => boolean) => [i, i + 1, i + 2].find((k) => k < n && f(k)) ?? -1;
    if (B[i].l < lo) { const k = back((q) => B[q].c > lo); if (k >= 0) { out.push(hit("spring", i - 20, k, k, B[i].l, { lines: [{ i0: i - 20, p0: lo, i1: k, p1: lo, role: "level" }] })); i = k + 5; continue; } }
    if (B[i].h > hi) { const k = back((q) => B[q].c < hi); if (k >= 0) { out.push(hit("upthrust", i - 20, k, k, B[i].h, { lines: [{ i0: i - 20, p0: hi, i1: k, p1: hi, role: "level" }] })); i = k + 5; } }
  }

  // Failure swings and S/R flips around confirmed swing points
  let si = 0;
  const lastSwing = (hi: boolean, before: number) => { for (let k = s.length - 1; k >= 0; k--) if (s[k].hi === hi && s[k].i < before - 1) return s[k]; return null; };
  for (let i = 2; i < n; i++) {
    while (si < s.length && s[si].i < i - 1) si++;
    const hS = lastSwing(true, i), lS = lastSwing(false, i), b = B[i];
    if (hS && b.h > hS.p && b.c < hS.p && down(b)) out.push(hit("swing-failure-bear", hS.i, i, i, b.h, { lines: [{ i0: hS.i, p0: hS.p, i1: i, p1: hS.p, role: "level" }] }));
    if (lS && b.l < lS.p && b.c > lS.p && up(b)) out.push(hit("swing-failure-bull", lS.i, i, i, b.l, { lines: [{ i0: lS.i, p0: lS.p, i1: i, p1: lS.p, role: "level" }] }));
  }
  for (const sw of s) {
    const t = levelTol(x, sw.i);
    let k1 = -1;
    for (let k = sw.i + 1; k < n; k++) if (sw.hi ? B[k].c > sw.p : B[k].c < sw.p) { k1 = k; break; }
    if (k1 < 0) continue;
    for (let k = k1 + 3; k <= Math.min(n - 1, k1 + 20); k++) {
      const q = B[k];
      if (sw.hi && q.l <= sw.p + t && q.l >= sw.p - t && q.c > sw.p) { out.push(hit("sr-flip-support", sw.i, k, k, q.l, { lines: [{ i0: sw.i, p0: sw.p, i1: k, p1: sw.p, role: "level" }] })); break; }
      if (!sw.hi && q.h >= sw.p - t && q.h <= sw.p + t && q.c < sw.p) { out.push(hit("sr-flip-resistance", sw.i, k, k, q.h, { lines: [{ i0: sw.i, p0: sw.p, i1: k, p1: sw.p, role: "level" }] })); break; }
      if (sw.hi ? q.c < sw.p - t : q.c > sw.p + t) break; // failed: closed back through the level
    }
  }
  // Climaxes
  for (let i = 20; i < n; i++) {
    const b = B[i], v = b.v;
    if (v == null || !Number.isFinite(x.avgVol[i]) || v < 2.5 * x.avgVol[i] || range(b) < 2.5 * (x.avgRange[i] || Infinity)) continue;
    if (up(b) && b.h >= hiOf(i - 19, i) && trendInto(x, i) === "up") out.push(hit("climax-top", i, i, i, b.h));
    if (down(b) && b.l <= loOf(i - 19, i) && trendInto(x, i) === "down") out.push(hit("climax-bottom", i, i, i, b.l));
  }
  return out;
}
