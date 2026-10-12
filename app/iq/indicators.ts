/**
 * Indicator maths shared by the price chart (CandleChart studies) and the
 * technical rating. Pure functions over oldest-first OHLCV bars; each returns
 * one value per bar, `null` until the indicator has enough history.
 */

export type OHLCBar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type Num = number | null;

/**
 * The exchange-session date a bar belongs to, as YYYY-MM-DD in New York.
 * Daily bars are stamped at ET midnight (04:00 UTC), so a naive UTC date is a
 * day out for anything stamped in the evening. `en-CA` formats as YYYY-MM-DD,
 * which compares correctly as a string.
 */
export function etSessionDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function sma(src: OHLCBar[], p: number): Num[] {
  const out: Num[] = new Array(src.length).fill(null);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i].c;
    if (i >= p) sum -= src[i - p].c;
    if (i >= p - 1) out[i] = sum / p;
  }
  return out;
}

/** EMA seeded with the SMA of its first `p` values — the convention charting packages report. */
export function emaOf(vals: Num[], p: number): Num[] {
  const k = 2 / (p + 1);
  const out: Num[] = new Array(vals.length).fill(null);
  let e: number | null = null, seen = 0, seed = 0;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v == null) continue;
    if (e == null) {
      seed += v;
      if (++seen === p) { e = seed / p; out[i] = e; }
      continue;
    }
    e = v * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}
export const ema = (src: OHLCBar[], p: number) => emaOf(src.map(b => b.c), p);

export function boll(src: OHLCBar[], p: number, m = 2) {
  const u: Num[] = [], mid: Num[] = [], lo: Num[] = [];
  let sum = 0, sq = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i].c;
    sum += c; sq += c * c;
    if (i >= p) { const o = src[i - p].c; sum -= o; sq -= o * o; }
    if (i < p - 1) { u.push(null); mid.push(null); lo.push(null); continue; }
    const a = sum / p, sd = Math.sqrt(Math.max(0, sq / p - a * a));
    mid.push(a); u.push(a + m * sd); lo.push(a - m * sd);
  }
  return { u, mid, lo };
}

/** Wilder RSI. */
export function rsi(src: OHLCBar[], p: number): Num[] {
  const out: Num[] = new Array(src.length).fill(null);
  let g = 0, l = 0;
  for (let i = 1; i < src.length; i++) {
    const d = src[i].c - src[i - 1].c, up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= p) { g += up / p; l += dn / p; if (i === p) out[i] = 100 - 100 / (1 + g / (l || 1e-9)); }
    else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; out[i] = 100 - 100 / (1 + g / (l || 1e-9)); }
  }
  return out;
}

export function macd(src: OHLCBar[]) {
  const fast = ema(src, 12), slow = ema(src, 26);
  const m = src.map((_, i) => (fast[i] == null || slow[i] == null ? null : fast[i]! - slow[i]!));
  const s = emaOf(m, 9);
  return { m, s, h: m.map((v, i) => (v == null || s[i] == null ? null : v - s[i]!)) };
}

export function stoch(src: OHLCBar[], p: number, d = 3) {
  const k: Num[] = src.map((_, i) => {
    if (i < p - 1) return null;
    let hi = -Infinity, lo = Infinity;
    for (let j = i - p + 1; j <= i; j++) { if (src[j].h > hi) hi = src[j].h; if (src[j].l < lo) lo = src[j].l; }
    return hi === lo ? 50 : ((src[i].c - lo) / (hi - lo)) * 100;
  });
  const dd: Num[] = k.map((_, i) => {
    const w = k.slice(Math.max(0, i - d + 1), i + 1).filter((v): v is number => v != null);
    return w.length < d ? null : w.reduce((s, v) => s + v, 0) / w.length;
  });
  return { k, d: dd };
}

export function atr(src: OHLCBar[], p: number): Num[] {
  const out: Num[] = new Array(src.length).fill(null);
  let a: number | null = null;
  for (let i = 1; i < src.length; i++) {
    const tr = Math.max(src[i].h - src[i].l, Math.abs(src[i].h - src[i - 1].c), Math.abs(src[i].l - src[i - 1].c));
    a = a == null ? tr : (a * (p - 1) + tr) / p;
    if (i >= p) out[i] = a;
  }
  return out;
}

/** VWAP anchored per ET session on intraday bars, per calendar year on daily-and-up. */
export function vwap(src: OHLCBar[], intraday: boolean): Num[] {
  const out: Num[] = [];
  let pv = 0, vv = 0, bucket: string | null = null;
  for (const b of src) {
    const key = intraday ? etSessionDate(b.t) : etSessionDate(b.t).slice(0, 4);
    if (key !== bucket) { bucket = key; pv = 0; vv = 0; }
    pv += ((b.h + b.l + b.c) / 3) * b.v; vv += b.v;
    out.push(vv > 0 ? pv / vv : null);
  }
  return out;
}

/** Wilder ADX with its directional lines. */
export function adx(src: OHLCBar[], p = 14): Array<{ adx: number; pDI: number; nDI: number } | null> {
  const out: Array<{ adx: number; pDI: number; nDI: number } | null> = new Array(src.length).fill(null);
  let sTR = 0, sP = 0, sN = 0, a: number | null = null, seen = 0, dxSum = 0;
  for (let i = 1; i < src.length; i++) {
    const up = src[i].h - src[i - 1].h, dn = src[i - 1].l - src[i].l;
    const pDM = up > dn && up > 0 ? up : 0, nDM = dn > up && dn > 0 ? dn : 0;
    const tr = Math.max(src[i].h - src[i].l, Math.abs(src[i].h - src[i - 1].c), Math.abs(src[i].l - src[i - 1].c));
    if (i <= p) { sTR += tr; sP += pDM; sN += nDM; }
    else { sTR += tr - sTR / p; sP += pDM - sP / p; sN += nDM - sN / p; }
    if (i >= p && sTR > 0) {
      const pDI = (100 * sP) / sTR, nDI = (100 * sN) / sTR;
      const dx = (100 * Math.abs(pDI - nDI)) / Math.max(pDI + nDI, 1e-9);
      seen++;
      if (seen <= p) { dxSum += dx; if (seen === p) a = dxSum / p; }
      else a = ((a as number) * (p - 1) + dx) / p;
      if (a != null) out[i] = { adx: a, pDI, nDI };
    }
  }
  return out;
}

function smaOf(vals: number[], p: number): Num[] {
  const out: Num[] = new Array(vals.length).fill(null);
  let sum = 0;
  for (let i = 0; i < vals.length; i++) {
    sum += vals[i];
    if (i >= p) sum -= vals[i - p];
    if (i >= p - 1) out[i] = sum / p;
  }
  return out;
}

/** Awesome Oscillator: SMA 5 − SMA 34 of the bar midpoint. */
export function awesome(src: OHLCBar[]): Num[] {
  const md = src.map(b => (b.h + b.l) / 2), f = smaOf(md, 5), s = smaOf(md, 34);
  return src.map((_, i) => (f[i] == null || s[i] == null ? null : f[i]! - s[i]!));
}

/** Commodity Channel Index. */
export function cci(src: OHLCBar[], p = 20): Num[] {
  const tp = src.map(b => (b.h + b.l + b.c) / 3), m = smaOf(tp, p);
  return src.map((_, i) => {
    const mi = m[i];
    if (mi == null) return null;
    let md = 0;
    for (let j = i - p + 1; j <= i; j++) md += Math.abs(tp[j] - mi);
    md /= p;
    return md ? (tp[i] - mi) / (0.015 * md) : 0;
  });
}

/** Williams %R (−100…0). */
export function willr(src: OHLCBar[], p = 14): Num[] {
  return src.map((_, i) => {
    if (i < p - 1) return null;
    let hh = -Infinity, ll = Infinity;
    for (let j = i - p + 1; j <= i; j++) { if (src[j].h > hh) hh = src[j].h; if (src[j].l < ll) ll = src[j].l; }
    return hh === ll ? -50 : (-100 * (hh - src[i].c)) / (hh - ll);
  });
}
