/**
 * Money Flow — view helpers over the backend board (GET /live/money-flow).
 *
 * Every number comes from the board: the backend computes flows, levels and
 * scores from Polygon bars and FMP quotes (money-flow.calc.ts, where each basis
 * is documented and returned as `board.basis`). This file only formats, maps
 * and lays out; the popover chart's 1/3/5/15-minute candles are grouped here
 * from real 1-minute bars.
 */

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
export function formatLevel(v: number | null | undefined, dp = 2): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(dp);
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
export function sectorView(sectors: BoardSector[]): {
  sectors: SectorFlowItem[];
  top2Inflow: SectorFlowItem[];
  top2Outflow: SectorFlowItem[];
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
      buyPct: s.buyPct,
      barWidthPct: `${Math.max(4, Math.min(100, (Math.abs(s.netFlow) / maxAbs) * 100))}%`,
      color: s.netFlow >= 0 ? "#3ddc84" : "#f0565a",
      stockCount: s.count,
      isPositive: s.netFlow >= 0,
    }));
  const top2Inflow = list.filter((s) => s.flowVal > 0).slice(0, 2);
  const top2Outflow = list.filter((s) => s.flowVal < 0).slice(-2).reverse();
  const pulled = new Set([...top2Inflow, ...top2Outflow].map((s) => s.name));
  return { sectors: list, top2Inflow, top2Outflow, remaining: list.filter((s) => !pulled.has(s.name)) };
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
      confC: bull ? "#3ddc84" : "#f0565a",
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
      rsC: (x.vsSector ?? 0) >= 0 ? "#3ddc84" : "#f0565a",
      m30: x.m30 == null ? "—" : `${x.m30 >= 0 ? "▲" : "▼"}${Math.abs(x.m30).toFixed(2)}%`,
      m30C: (x.m30 ?? 0) >= 0 ? "#3ddc84" : "#f0565a",
      volx: x.rvol == null ? "—" : `${x.rvol.toFixed(1)}×`,
      bg: `linear-gradient(160deg,rgba(${c},${Math.max(0.06, 0.2 - i * 0.012)}),rgba(${c},0.03))`,
      bd: `rgba(${c},0.32)`,
    };
  });
}
