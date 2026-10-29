/**
 * Money Flow Engine
 * Pure TypeScript implementation of the institutional Money Flow and Order Block calculations
 * ported from MarketCatalystDashboard.html
 */

import {
  SP500_CONSTITUENTS,
  SECTORS_LIST,
  SECTOR_BIAS,
  type SectorName,
} from "./data";

export interface StockBase {
  t: string;
  name: string;
  grp: string;
  sec: string;
  p0: number;
  fm: number;
  vol: number;
  trend: number;
  path: number[];
  vb: number[];
  wick: number[][];
  sh: number;
}

export interface CompanyMarketData {
  marketCap?: number | null;
  price?: number | null;
  pctChange?: number | null;
  rvol?: number | null;
  dayVolume?: number | null;
  keyLevels?: {
    daily?: {
      pivot?: number | null;
      r1?: number | null;
      r2?: number | null;
      r3?: number | null;
      s1?: number | null;
      s2?: number | null;
      s3?: number | null;
    } | null;
  } | null;
}

export interface StockSession extends StockBase {
  k: number;
  mv: number;
  px: number;
  bull: boolean;
  chop: boolean;
  marketCap?: number;
  dayVolume?: number;
  zi: number;
  zLo: number;
  zHi: number;
  R1: number;
  R2: number;
  R3: number;
  S1: number;
  S2: number;
  entry: number;
  stop: number;
  tgt: number;
  rr: number;
  dist: number;
  score: number;
}

export interface OHLCVBar {
  o: number;
  c: number;
  h: number;
  l: number;
  vw: number;
}

export interface DollarFlowResult {
  net: number;
  netTxt: string;
  buy: number;
  hours: Array<{ l: string; h: string; c: string }>;
}

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

export interface ConfidenceResult {
  sc: number;
  parts: Array<[string, number, number]>;
  pen: number;
}

export interface SectorFlowItem {
  name: string;
  flowVal: number;
  flowFormatted: string;
  avgPct: number;
  avgPctFormatted: string;
  barWidthPct: string;
  color: string;
  stockCount: number;
  isPositive: boolean;
}

export interface TileLayout {
  t: string;
  L: string;
  T: string;
  W: string;
  H: string;
  rank: string;
  chg: string;
  px: string;
  conf: number;
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
  glow: string;
  prof: Array<{ h: string; w: string; c: string }>;
  lbls: Array<{ l: string; r: string; top: string; c: string; txt: string }>;
}

export function zRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

export function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCompactDollars(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+$" : "−$";
  if (abs >= 1e9) {
    return `${sign}${(abs / 1e9).toFixed(1)}B`;
  }
  return `${sign}${(abs / 1e6).toFixed(0)}M`;
}

export function formatPct(v: number): string {
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${Math.abs(v).toFixed(2)}%`;
}

let cachedBase: StockBase[] | null = null;

export function getBaseUniverse(): StockBase[] {
  if (cachedBase) return cachedBase;

  cachedBase = SP500_CONSTITUENTS.map(([t, name, sec, p0x, realMv, realVol]) => {
    const r = zRng(t);
    const bias = SECTOR_BIAS[sec] ?? 0;
    const fm = realMv ?? +(bias + (r() - 0.5) * 4.4).toFixed(2);
    const p = realMv != null ? p0x / (1 + fm / 100) : p0x;
    const vol = +(
      realVol ?? (0.85 + Math.min(1.5, Math.abs(fm) * 0.28) + r() * 0.25)
    ).toFixed(2);
    const trend = 0.35 + r() * 0.65;

    const pr = zRng(t + "path");
    const N = 79;
    const path: number[] = [(pr() - 0.5) * 0.5];
    let v = path[0];
    const rev = trend < 0.22;

    for (let i = 1; i < N; i++) {
      const left = N - 1 - i;
      const goal = rev && i < 40 ? -fm * 0.5 : fm;
      v +=
        ((goal - v) / (Math.max(1, rev && i < 40 ? 40 - i : left) + 1)) *
          (0.5 + pr()) +
        (pr() - 0.5) * 0.26 * (1 + Math.abs(fm) / 3);
      path.push(i === N - 1 ? fm : v);
    }

    const vb = path.map((x, i) => {
      const u = 1 + 0.9 * Math.exp(-i / 8) + 0.5 * Math.exp(-(78 - i) / 6);
      return u * (0.6 + pr() * 0.8) * (1 + Math.abs(x - (path[i - 1] ?? x)) * 2);
    });
    const vs = vb.reduce((a, b) => a + b, 0);

    const cr = zRng(t + "cand");
    const wick = path.map(() => [cr(), cr()]);
    const sh = (1.5e9 + zRng(t + "m")() * 5e9) / p;

    return {
      t,
      name,
      grp: sec,
      sec,
      p0: p,
      fm,
      vol,
      trend,
      path,
      vb: vb.map((x) => x / vs),
      wick,
      sh,
    };
  });

  return cachedBase;
}

export function computeSessionK(progress01: number): number {
  return Math.max(1, Math.min(78, Math.round(progress01 * 78)));
}

export function computeStockSession(
  progress01: number,
  companyOverrides?: Map<string, CompanyMarketData>
): StockSession[] {
  const k = computeSessionK(progress01);
  const thr = 0.6 * Math.min(1, 0.35 + k / 78);

  return getBaseUniverse().map((b) => {
    const P = (v: number) => b.p0 * (1 + v / 100);
    const seg = b.path && b.path.length ? b.path.slice(0, k + 1) : [0];
    const mv = +(seg[Math.min(k, seg.length - 1)] ?? 0).toFixed(2);
    const px = P(mv);
    const bull = mv > 0;

    // FMP overrides for market cap, volume, RVOL, and key levels
    const ov = companyOverrides?.get(b.t);
    const mcap = ov?.marketCap != null && ov.marketCap > 0 ? ov.marketCap : undefined;
    const sh = mcap != null ? mcap / (px || b.p0) : b.sh;
    const realRvol = ov?.rvol != null && ov.rvol > 0 ? ov.rvol : null;
    const vol = realRvol != null
      ? +realRvol.toFixed(2)
      : +Math.max(
          0.6,
          Math.min(3, b.vol * (0.85 + 0.3 * Math.sin(k / 9 + b.p0)))
        ).toFixed(2);
    const chop = Math.abs(mv) < thr || vol < 1.05;

    let zi = 0;
    let zLo = 0;
    let zHi = 0;
    let R1 = 0;
    let R2 = 0;
    let R3 = 0;
    let S1 = 0;
    let S2 = 0;

    if (bull) {
      zi = seg.indexOf(Math.min(...seg));
      zLo = P(seg[zi]) * (1 - 0.0008);
      zHi = zLo * 1.003;
      S1 = zLo * 0.997;
      S2 = S1 * 0.996;
      R1 = Math.max(P(Math.max(...seg)), px * 1.002);
      R2 = R1 * 1.005;
      R3 = R2 * 1.006;
    } else {
      zi = seg.indexOf(Math.max(...seg));
      zHi = P(seg[zi]) * (1 + 0.0008);
      zLo = zHi * 0.997;
      R1 = zHi * 1.003;
      R2 = R1 * 1.004;
      R3 = R2 * 1.005;
      S1 = Math.min(P(Math.min(...seg)), px * 0.998);
      S2 = S1 * 0.995;
    }

    // Accurate FMP Support & Resistance Classic Pivot Levels when available
    const kl = ov?.keyLevels?.daily;
    if (kl && typeof kl.r1 === "number" && typeof kl.s1 === "number" && kl.r1 > 0 && kl.s1 > 0) {
      R1 = kl.r1;
      R2 = typeof kl.r2 === "number" && kl.r2 > 0 ? kl.r2 : R1 * 1.008;
      R3 = typeof kl.r3 === "number" && kl.r3 > 0 ? kl.r3 : R2 * 1.008;
      S1 = kl.s1;
      S2 = typeof kl.s2 === "number" && kl.s2 > 0 ? kl.s2 : S1 * 0.992;
      if (typeof kl.pivot === "number" && kl.pivot > 0) {
        zLo = Math.min(kl.pivot, S1);
        zHi = Math.max(kl.pivot, R1);
      } else {
        zLo = S1;
        zHi = R1;
      }
    }

    const entry = bull ? zHi : zLo;
    const stop = bull ? S1 : R1;
    const tgt = bull ? R2 : S2;
    const rr = Math.abs(tgt - entry) / (Math.abs(entry - stop) || 1);
    const dist = (Math.abs(px - entry) / (px || 1)) * 100;
    const score = chop
      ? 0
      : Math.min(
          99,
          Math.round(
            Math.abs(mv) * 15 +
              (vol - 1) * 18 +
              b.trend * 14 +
              Math.max(0, 8 - dist * 6)
          )
        );

    return {
      ...b,
      sh,
      marketCap: mcap ?? (sh * px),
      dayVolume: ov?.dayVolume ?? undefined,
      k,
      mv,
      px,
      bull,
      chop,
      vol,
      zi,
      zLo,
      zHi,
      R1,
      R2,
      R3,
      S1,
      S2,
      entry,
      stop,
      tgt,
      rr,
      dist,
      score,
    };
  });
}

export function computeCandles(s: StockSession): OHLCVBar[] {
  const baseP0 =
    s.px && Number.isFinite(s.px) && s.px > 0 && s.mv != null && s.mv !== -100
      ? s.px / (1 + s.mv / 100)
      : s.p0 || 100;
  const P = (v: number) => baseP0 * (1 + v / 100);
  const c: OHLCVBar[] = [];
  let cv = 0;
  let cpv = 0;

  const path = s.path && s.path.length ? s.path : [s.mv || 0];
  const wick = s.wick && s.wick.length ? s.wick : path.map(() => [0.5, 0.5]);
  const vb = s.vb && s.vb.length ? s.vb : path.map(() => 1 / Math.max(1, path.length));
  const kLimit = Math.min(s.k ?? 78, path.length - 1);

  for (let i = 0; i <= kLimit; i++) {
    const o = P(i ? path[i - 1] : path[0] - 0.05);
    const cl = P(path[i]);
    const w = wick[i] || [0.5, 0.5];
    const h = Math.max(o, cl) + (w[0] ?? 0.5) * baseP0 * 0.0012;
    const l = Math.min(o, cl) - (w[1] ?? 0.5) * baseP0 * 0.0012;
    const vbi = vb[i] ?? (1 / 78);
    cv += vbi;
    cpv += (vbi * (h + l + cl)) / 3;
    c.push({ o, c: cl, h, l, vw: cpv / (cv || 1) });
  }

  if (c.length === 0) {
    const fallbackPx = s.px || baseP0;
    c.push({ o: fallbackPx, c: fallbackPx, h: fallbackPx * 1.001, l: fallbackPx * 0.999, vw: fallbackPx });
  }

  return c;
}

export function computeTfCandles(
  s: StockSession,
  c: OHLCVBar[],
  tf: number
): OHLCVBar[] {
  if (!tf || tf === 5) return c;
  const agg = (a: OHLCVBar[], n: number) => {
    const o: OHLCVBar[] = [];
    for (let i = 0; i < a.length; i += n) {
      const g = a.slice(i, i + n);
      o.push({
        o: g[0].o,
        c: g[g.length - 1].c,
        h: Math.max(...g.map((x) => x.h)),
        l: Math.min(...g.map((x) => x.l)),
        vw: g[g.length - 1].vw,
      });
    }
    return o;
  };

  if (tf === 15) return agg(c, 3);

  // 1m candles: interpolate 5 sub-bars per 5m candle
  const r = zRng(s.t + "1m");
  const m: OHLCVBar[] = [];
  c.forEach((b, bi) => {
    const pv = c[bi - 1] ? c[bi - 1].vw : b.vw;
    const hiAt = 1 + Math.floor(r() * 3);
    const loAt = 1 + Math.floor(r() * 3);
    const pts = [b.o];
    for (let j = 1; j < 5; j++) {
      const base = b.o + ((b.c - b.o) * j) / 5 + (r() - 0.5) * (b.h - b.l) * 0.35;
      pts.push(
        j === hiAt && hiAt !== loAt
          ? b.h
          : j === loAt
          ? b.l
          : Math.min(b.h, Math.max(b.l, base))
      );
    }
    pts.push(b.c);

    for (let j = 0; j < 5; j++) {
      const o = pts[j];
      const cl = pts[j + 1];
      const w = (b.h - b.l) * 0.12 * r();
      m.push({
        o,
        c: cl,
        h: Math.min(b.h, Math.max(o, cl) + w),
        l: Math.max(b.l, Math.min(o, cl) - w),
        vw: pv + ((b.vw - pv) * (j + 1)) / 5,
      });
    }
  });

  return tf === 1 ? m : agg(m, 3);
}

export function computeDollarFlow(
  x: StockSession,
  candles?: OHLCVBar[]
): DollarFlowResult {
  const c = candles ?? computeCandles(x);
  let net = 0;
  let gross = 0;
  const grp = [
    [0, 6],
    [6, 18],
    [18, 30],
    [30, 42],
    [42, 54],
    [54, 66],
    [66, 79],
  ];
  const hv = grp.map(() => 0);

  // Daily traded share volume baseline:
  // Active S&P 500 stocks turn over ~0.4% - 1.2% of total shares per day.
  // Using actual dayVolume if available, otherwise shares * realistic daily turnover rate.
  const estDayShares = (x.dayVolume && x.dayVolume > 0)
    ? x.dayVolume
    : (x.sh * 0.006 * Math.max(0.5, x.vol || 1));

  c.forEach((b, i) => {
    const vbi = (x.vb && x.vb[i] != null) ? x.vb[i] : (1 / 78);
    const candleShareVol = estDayShares * vbi;
    const d = x.px * candleShareVol;
    const sg = Math.max(-1, Math.min(1, ((b.c - b.o) / (b.o || 1)) * 350)) * 0.35;
    net += d * sg;
    gross += d * 0.35;
    const g = grp.findIndex(([a, z]) => i >= a && i < z);
    if (g >= 0) hv[g] += d * sg;
  });

  const buy = Math.round(
    Math.max(10, Math.min(90, 50 + (50 * net) / (gross || 1)))
  );
  const mx = Math.max(...hv.map(Math.abs)) || 1;

  const hours = ["9:30", "10", "11", "12", "1", "2", "3"].map((l, j) => {
    const on = grp[j][0] <= x.k;
    return {
      l,
      h: on ? `${Math.max(8, (Math.abs(hv[j]) / mx) * 100)}%` : "6%",
      c: on ? (hv[j] >= 0 ? "#3ddc84" : "#f0565a") : "#1a2328",
    };
  });

  return {
    net,
    netTxt: `${formatCompactDollars(net)} ${net >= 0 ? "in" : "out"}`,
    buy,
    hours,
  };
}

export function computeSwings(c: OHLCVBar[], n: number = 3): SwingPoint[] {
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

export function computeOrderBlocks(s: StockSession, c: OHLCVBar[]): OrderBlock[] {
  const OB: OrderBlock[] = [];
  for (let i = 2; i < c.length - 2; i++) {
    const bar = c[i];
    const nxt1 = c[i + 1];
    const nxt2 = c[i + 2];
    const bullImb =
      bar.c < bar.o && nxt1.c > nxt1.o && (nxt2.c - bar.h) / bar.h > 0.0018;
    const bearImb =
      bar.c > bar.o && nxt1.c < nxt1.o && (bar.l - nxt2.c) / bar.l > 0.0018;

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
      OB.push({
        i,
        hi: bullImb ? bar.h : bar.h * 1.0005,
        lo: bullImb ? bar.l * 0.9995 : bar.l,
        bull: bullImb,
        mit,
        end,
      });
    }
  }
  return OB.slice(-6);
}

export function computeConfidence(
  x: StockSession,
  all: StockSession[]
): ConfidenceResult {
  const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const dir = x.mv >= 0 ? 1 : -1;
  const c = computeCandles(x);
  const vw = c[c.length - 1].vw;
  const f = computeDollarFlow(x, c);

  // Sector flows
  const sf: Record<string, number> = {};
  all.forEach((q) => {
    sf[q.sec] = (sf[q.sec] || 0) + computeDollarFlow(q).net;
  });
  const sfMax = Math.max(...Object.values(sf).map(Math.abs)) || 1;

  // Trend
  const side = all.filter((q) => (q.mv >= 0) === (dir > 0)).map((q) => Math.abs(q.mv)).sort((a, b) => a - b);
  let pctl = 1;
  if (side.length >= 2) {
    let idx = 0;
    while (idx < side.length && side[idx] < Math.abs(x.mv)) idx++;
    pctl = idx / (side.length - 1);
  }
  const trend = 30 * Math.pow(pctl, 0.8);
  const vol = 15 * cl((x.vol - 0.8) / 1.4, 0, 1);
  const vd = ((dir * (x.px - vw)) / vw) * 100;
  const vwap = vd <= 0 ? 3 * cl(1 + vd / 0.3, 0, 1) : 9 + 6 * cl(vd / 0.6, 0, 1);
  const m30 = (x.path[x.k] - x.path[Math.max(0, x.k - 6)]) * dir;
  const mom = 10 * cl(0.5 + m30 / 0.4, 0, 1);

  const sw = computeSwings(c, 3);
  const hs = sw.filter((p) => p.hi).slice(-3);
  const ls = sw.filter((p) => !p.hi).slice(-3);
  let st = 0;
  let n = 0;
  for (let i = 1; i < hs.length; i++) {
    n++;
    if ((hs[i].p - hs[i - 1].p) * dir > 0) st++;
  }
  for (let i = 1; i < ls.length; i++) {
    n++;
    if ((ls[i].p - ls[i - 1].p) * dir > 0) st++;
  }
  const strc = n ? (10 * st) / n : 6;
  const sec = 10 * cl(0.5 + (dir * (sf[x.sec] || 0)) / sfMax * 0.6, 0, 1);
  const money = 10 * cl(0.5 + (dir > 0 ? f.buy - 50 : 50 - f.buy) / 40, 0, 1);

  const obs = computeOrderBlocks(x, c).filter((b) => !b.mit && b.bull === (dir > 0)).slice(-1)[0];
  const obd = obs ? Math.max(0, ((dir > 0 ? x.px - obs.hi : obs.lo - x.px) / x.px) * 100) : null;
  const obScore = obs && obd != null ? 5 * cl(1 - obd / 1.5, 0.3, 1) : 0;

  let sc = trend + vol + vwap + mom + strc + sec + money + obScore;
  if (x.chop) sc *= 0.88;
  sc = Math.round(cl(sc, 1, 99));

  return {
    sc,
    parts: [
      ["Trend", trend, 30],
      ["Rel. volume", vol, 15],
      ["VWAP", vwap, 15],
      ["30m momentum", mom, 10],
      ["Structure", strc, 10],
      ["Sector flow", sec, 10],
      ["Big money", money, 10],
      ["Order block bonus", obScore, 5],
    ],
    pen: 0,
  };
}

export function computeSectorFlows(all: StockSession[]): {
  sectors: SectorFlowItem[];
  top2Inflow: SectorFlowItem[];
  top2Outflow: SectorFlowItem[];
  maxAbsFlow: number;
} {
  const map: Record<string, { flow: number; pcts: number[]; count: number }> = {};
  SECTORS_LIST.forEach((s) => {
    map[s] = { flow: 0, pcts: [], count: 0 };
  });

  all.forEach((stock) => {
    const f = computeDollarFlow(stock);
    if (!map[stock.sec]) {
      map[stock.sec] = { flow: 0, pcts: [], count: 0 };
    }
    map[stock.sec].flow += f.net;
    map[stock.sec].pcts.push(stock.mv);
    map[stock.sec].count++;
  });

  const list = Object.entries(map).map(([name, val]) => {
    const avg = val.pcts.length
      ? val.pcts.reduce((a, b) => a + b, 0) / val.pcts.length
      : 0;
    return {
      name,
      flowVal: val.flow,
      flowFormatted: formatCompactDollars(val.flow),
      avgPct: avg,
      avgPctFormatted: formatPct(avg),
      barWidthPct: "0%",
      color: val.flow >= 0 ? "#3ddc84" : "#f0565a",
      stockCount: val.count,
      isPositive: val.flow >= 0,
    };
  });

  list.sort((a, b) => b.flowVal - a.flowVal);

  const maxAbsFlow = Math.max(1, ...list.map((s) => Math.abs(s.flowVal)));
  list.forEach((s) => {
    s.barWidthPct = `${Math.max(4, Math.min(100, (Math.abs(s.flowVal) / maxAbsFlow) * 100))}%`;
  });

  const top2Inflow = list.slice(0, 2);
  const top2Outflow = list.slice(-2).reverse();

  return {
    sectors: list,
    top2Inflow,
    top2Outflow,
    maxAbsFlow,
  };
}

export function computeSquarifiedTiles(
  items: StockSession[],
  bull: boolean,
  secAverages: Record<string, number>,
  allStocks: StockSession[]
): TileLayout[] {
  if (!items.length) return [];

  const asc = items.map((x, i) => ({ x, i }));
  const tot = asc.reduce((a, o) => a + (Math.floor(Math.abs(o.x.mv)) + 1), 0);
  const AR = 0.8;
  const rect: Record<string, { L: number; T: number; W: number; H: number }> = {};

  const worst = (row: typeof asc, s: number) => {
    const h = s / tot;
    const ws = row.map((o) => (Math.floor(Math.abs(o.x.mv)) + 1) / s);
    return Math.max(...ws.map((w) => {
      const r = (w * AR) / h;
      return Math.max(r, 1 / r);
    }));
  };

  let rows: Array<[typeof asc, number]> = [];
  let cur: typeof asc = [];
  let cs = 0;

  asc.forEach((o) => {
    const v = Math.floor(Math.abs(o.x.mv)) + 1;
    if (!cur.length) {
      cur = [o];
      cs = v;
      return;
    }
    const nw = worst(cur.concat([o]), cs + v);
    const ow = worst(cur, cs);
    if (nw <= ow && cur.length < 3) {
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
      const w = ((Math.floor(Math.abs(o.x.mv)) + 1) / s) * 100;
      rect[o.x.t] = { L: y, T: x0, W: h, H: w };
      x0 += w;
    });
    y += h;
  });

  return asc.map(({ x, i }) => {
    const R0 = rect[x.t] || { L: 0, T: 0, W: 20, H: 20 };
    const area = (R0.W * R0.H) / 100;
    const rs = area >= 12 ? 2 : 1;
    const big = area >= 12;
    const rr = zRng(x.t + "p");
    const n = rs * 5;
    const poc = Math.floor(rr() * n);
    const c = bull ? "61,220,132" : "240,86,90";

    const wide = R0.W >= 24;
    const secAvg = secAverages[x.sec] ?? 0;
    const rsDiff = x.mv - secAvg;
    const m30Diff = x.path[x.k] - x.path[Math.max(0, x.k - 6)];
    const conf = computeConfidence(x, allStocks).sc;

    const prof = Array.from({ length: n }, (_, j) => ({
      h: big ? "3px" : "2px",
      w: `${j === poc ? 100 : 18 + rr() * 70}%`,
      c: `rgba(${c},${j === poc ? 0.95 : 0.28 + rr() * 0.3})`,
    }));

    return {
      t: x.t,
      L: `${R0.L.toFixed(2)}%`,
      T: `${R0.T.toFixed(2)}%`,
      W: `${R0.W.toFixed(2)}%`,
      H: `${R0.H.toFixed(2)}%`,
      rank: String(i + 4),
      chg: formatPct(x.mv),
      px: formatCurrency(x.px),
      conf,
      confC: bull ? "#3ddc84" : "#f0565a",
      confDeg: `${conf * 3.6}deg`,
      ringS: wide ? "22px" : "14px",
      ringI: wide ? "17px" : "11px",
      ringF: wide ? "8.5px" : "6.5px",
      padR: wide ? "24px" : "14px",
      logoD: wide ? "grid" : "none",
      rankD: R0.W >= 20 ? "inline" : "none",
      rowD: R0.H >= 22 ? "flex" : "none",
      miniB: R0.H >= 22 ? "32px" : "5px",
      fs: area >= 16 ? "18px" : area >= 9 ? "15px" : "12px",
      rsTxt: `${rsDiff >= 0 ? "+" : "−"}${Math.abs(rsDiff).toFixed(2)}%`,
      rsC: rsDiff >= 0 ? "#3ddc84" : "#f0565a",
      m30: `${m30Diff >= 0 ? "▲" : "▼"}${Math.abs(m30Diff).toFixed(2)}%`,
      m30C: m30Diff >= 0 ? "#3ddc84" : "#f0565a",
      volx: `${x.vol.toFixed(1)}×`,
      bg: `linear-gradient(160deg,rgba(${c},${Math.max(0.06, 0.2 - i * 0.012)}),rgba(${c},0.03))`,
      bd: `rgba(${c},0.32)`,
      glow: "none",
      prof,
      lbls: [],
    };
  });
}
