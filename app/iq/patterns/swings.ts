import type { Ctx } from "./util";

export interface Swing {
  i: number;
  p: number;
  hi: boolean;
}

/**
 * Zig-zag swing points: a high (low) is confirmed once price moves back from
 * it by at least `k` × ATR(14) measured at that bar. Alternates high / low;
 * the extreme still in progress is not included.
 */
export function zigzag(x: Ctx, k = 1.5): Swing[] {
  const B = x.bars, n = B.length, out: Swing[] = [];
  if (n < 3) return out;
  const th = (i: number) => k * (x.atr[i] || B[i].h - B[i].l);
  let dir = 0, hiI = 0, loI = 0;
  for (let i = 1; i < n; i++) {
    if (dir === 0) {
      if (B[i].h > B[hiI].h) hiI = i;
      if (B[i].l < B[loI].l) loI = i;
      if (hiI < i && B[hiI].h - B[i].l >= th(hiI)) { out.push({ i: hiI, p: B[hiI].h, hi: true }); dir = -1; loI = i; }
      else if (loI < i && B[i].h - B[loI].l >= th(loI)) { out.push({ i: loI, p: B[loI].l, hi: false }); dir = 1; hiI = i; }
    } else if (dir === 1) {
      if (B[i].h >= B[hiI].h) hiI = i;
      else if (B[hiI].h - B[i].l >= th(hiI)) { out.push({ i: hiI, p: B[hiI].h, hi: true }); dir = -1; loI = i; }
    } else {
      if (B[i].l <= B[loI].l) loI = i;
      else if (B[i].h - B[loI].l >= th(loI)) { out.push({ i: loI, p: B[loI].l, hi: false }); dir = 1; hiI = i; }
    }
  }
  return out;
}

/** "Same level" tolerance for chart patterns at bar i: max(0.5 × ATR(14), 0.1% of price). */
export const levelTol = (x: Ctx, i: number) => Math.max(0.5 * (x.atr[i] || 0), 0.001 * x.bars[i].c);
