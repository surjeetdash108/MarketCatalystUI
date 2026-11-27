/**
 * Pure helpers for the Heatmap screen: the tile palette, the legend gradient,
 * which change a time frame reads, and the "as of" line under the title.
 * Kept out of the component so they can be tested without rendering it.
 */

/** Time frames offered above the map. YTD reads the prior-year-end base the technicals job stores (see ytdPct). */
export type HmFrame = "1D" | "1W" | "1M" | "YTD";

/** [move %, r, g, b] — colour at that move; between stops it blends linearly. */
type Stop = [number, number, number, number];

/** Red ↔ slate ↔ green; the map saturates at ±3%. */
const STOPS: Stop[] = [
  [-3, 214, 69, 75], [-2, 150, 62, 68], [-1, 96, 56, 62],
  [0, 47, 58, 64],
  [1, 44, 100, 80], [2, 33, 130, 80], [3, 24, 166, 84],
];

/** Orange ↔ slate ↔ blue, for readers who cannot tell red from green. */
const STOPS_CB: Stop[] = [
  [-3, 222, 128, 35], [-2, 170, 104, 48], [-1, 108, 78, 58],
  [0, 47, 58, 64],
  [1, 47, 88, 128], [2, 44, 116, 178], [3, 50, 146, 220],
];

function blend(stops: Stop[], pct: number): [number, number, number] {
  const p = Math.max(-3, Math.min(3, pct));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (p <= b[0]) {
      const t = (p - a[0]) / (b[0] - a[0]);
      return [1, 2, 3].map(k => Math.round(a[k] + (b[k] - a[k]) * t)) as [number, number, number];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

/** A tile with no change to show: darker than a 0% tile, so "unknown" never reads as "flat". */
export const NO_DATA_TILE = { bg: "rgb(33,38,42)", fg: "rgba(255,255,255,.55)" } as const;

/** Fill and ink for a tile that moved `pct` percent (null/NaN → no-data tile). */
export function heatTile(pct: number | null | undefined, colorBlind = false): { bg: string; fg: string } {
  if (pct == null || !Number.isFinite(pct)) return NO_DATA_TILE;
  const [r, g, b] = blend(colorBlind ? STOPS_CB : STOPS, pct);
  return { bg: `rgb(${r},${g},${b})`, fg: "#ffffff" };
}

/** The legend bar: the same stops as the tiles, −3% at the left to +3% at the right. */
export function heatGradient(colorBlind = false): string {
  const stops = (colorBlind ? STOPS_CB : STOPS)
    .map(([p, r, g, b]) => `rgb(${r},${g},${b}) ${(((p + 3) / 6) * 100).toFixed(1)}%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** The price a window ends at, and the ET date of the session it belongs to. */
export interface FrameLive {
  price: number | null;
  dateIso: string | null;
}

/**
 * The change a tile shows for a time frame. 1D is the live day move passed in.
 * 1W is the 5-session change and 1M the 21-session change: from the technicals
 * job's stored move, which ends at the LAST STORED BAR (a session behind from the
 * open to the next night's run: on 24 Nov NVDA's 1W read +5.71% while the five
 * sessions up to the live price were -1.33%). When `live` and the job's dated
 * closes are there, the window is re-measured to the live price instead
 * (windowPctToLive); otherwise the stored move stands. Null when neither exists.
 * YTD is the live price against the stored prior-year-end close (ytdPct); with no
 * live price it uses the doc's own price, and it has no stored move to fall back on.
 */
export function framePct(
  frame: HmFrame,
  day: number | null,
  c:
    | {
        week5ChangePct?: number | null;
        monthChangePct?: number | null;
        week5Closes?: DatedClose[] | null;
        month21Closes?: DatedClose[] | null;
        price?: number | null;
        ytdBaseClose?: number | null;
        ytdYear?: number | null;
      }
    | null
    | undefined,
  live?: FrameLive | null,
): number | null {
  if (frame === "1D") return day;
  // An unadjusted split in the stored closes (SNDK 755 → 79) makes any window
  // across it meaningless: no figure rather than "-90%".
  if (c?.week5Closes && splitTainted({ week5Closes: c.week5Closes })) return null;
  if (frame === "1W") return (live ? windowPctToLive(c?.week5Closes, live.price, live.dateIso) : null) ?? c?.week5ChangePct ?? null;
  if (frame === "1M") return (live ? windowPctToLive(c?.month21Closes, live.price, live.dateIso) : null) ?? c?.monthChangePct ?? null;
  return ytdPct(c, live?.price ?? c?.price ?? null, live?.dateIso ?? null);
}

/**
 * Year to date: `price` against the last close of the prior year the technicals job
 * stored (the stock's first close for one listed this year). Null with no base or no
 * price, and null when the base belongs to a different year than the session being
 * shown: around New Year the job has not rolled yet, and last year's base would
 * make every tile read this year's move as the whole of last year's.
 */
export function ytdPct(
  c: { ytdBaseClose?: number | null; ytdYear?: number | null } | null | undefined,
  price: number | null | undefined,
  sessionIso: string | null | undefined,
): number | null {
  const base = c?.ytdBaseClose;
  if (base == null || !(base > 0) || price == null || !(price > 0)) return null;
  if (!sessionIso || c?.ytdYear !== Number(sessionIso.slice(0, 4))) return null;
  return (price / base - 1) * 100;
}

/** A day-on-day jump of 2.5x+ either way that holds: an unadjusted split. Same rule as alpha-signals-model.splitTainted. */
export function splitTainted(c: { week5Closes?: DatedClose[] | null }): boolean {
  const cl = (c.week5Closes ?? []).map(x => Number(x.close)).filter(v => v > 0);
  for (let i = 1; i < cl.length; i++) {
    const r = cl[i] / cl[i - 1];
    const settledBefore = i < 2 || Math.abs(cl[i - 1] / cl[i - 2] - 1) < 0.5;
    if ((r >= 2.5 || r <= 0.4) && settledBefore && cl.slice(i + 1).every(v => Math.abs(v / cl[i] - 1) < 0.5)) return true;
  }
  return false;
}

/**
 * Raises each weight to a minimum SHARE of the total, so the smallest sectors still
 * get a block big enough to carry a readable name. The map is by market cap, and
 * the real sectors run from about 40% of the map down to well under 1%: at a
 * 1289x475 map the smallest blocks came out 8, 54 and 58px wide, where no header
 * can show a name. Returns new weights (same order); the stocks inside a sector are
 * still sized against each other by their own weights.
 *
 * Solves w_min = minShare × Σ max(w, w_min), so the floored sectors really end up
 * with `minShare` of the map after the weights are normalised. If every sector
 * would need more than an equal share, they all get equal weight.
 */
export function floorWeights(weights: number[], minShare: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (!(minShare > 0)) return [...weights];
  if (minShare * n >= 1) return weights.map(() => 1);
  let floor = minShare * weights.reduce((a, w) => a + w, 0);
  for (let i = 0; i < 40; i++) {
    const next = minShare * weights.reduce((a, w) => a + Math.max(w, floor), 0);
    if (Math.abs(next - floor) <= 1e-12 * next) { floor = next; break; }
    floor = next;
  }
  return weights.map(w => Math.max(w, floor));
}

/** How a sector's header strip is laid out: name and move on one row, or stacked. */
export interface HeaderPlan {
  /** Name and move side by side (one row); false = the move sits under the name. */
  inline: boolean;
  /** False only when the block is too short to stack: the name then takes the whole row. */
  showPct: boolean;
  /** Rows the name may use (a long name wraps to two when stacked). */
  nameLines: 1 | 2;
  /** Height of the strip in px; the stocks are laid out below it. */
  h: number;
}

// Header type is .7rem bold caps (about 8.5px a letter, measured on the live map)
// and a .7rem mono move (about 7px a character).
const NAME_CH = 8.8;
const PCT_CH = 7.2;
/** Left 4 + right 8 padding, the sector's own 2px, and a little slack for font differences. */
const HEADER_SIDE = 16;
const HEADER_ROW_H = 13;
const HEADER_PAD_V = 8;
const HEADER_INLINE_H = 26;
/** Keep at least this much height for stocks below a taller header. */
const MIN_BODY_H = 22;

/** Lines a name needs at `perLine` characters: wraps at spaces, and a single word longer than a line breaks across lines. */
function wrappedLines(name: string, perLine: number): number {
  let lines = 1;
  let cur = 0;
  for (const word of name.split(/\s+/).filter(Boolean)) {
    if (word.length > perLine) {
      // Starts on a fresh line if the current one has text, then spills over.
      if (cur > 0) lines++;
      lines += Math.ceil(word.length / perLine) - 1;
      cur = word.length % perLine || perLine;
    } else if (cur === 0) cur = word.length;
    else if (cur + 1 + word.length <= perLine) cur += 1 + word.length;
    else { lines++; cur = word.length; }
  }
  return lines;
}

/**
 * Sizes a sector's header strip for its block. The old strip was always one row,
 * name beside move, so in a block about 100px wide the move (about 40px) left the
 * name roughly 40px: "CONS…", "UTIL…", "C…". Now the name wins the space:
 *  - everything fits on one row: as before;
 *  - otherwise the move goes under the name, and a long name wraps to two rows;
 *  - a block too short for that keeps one row and drops the move, so the name still shows.
 */
export function sectorHeaderPlan(w: number, h: number, name: string, pctText: string): HeaderPlan {
  const avail = Math.max(0, w - HEADER_SIDE);
  if (name.length * NAME_CH + 8 + pctText.length * PCT_CH <= avail) {
    return { inline: true, showPct: true, nameLines: 1, h: HEADER_INLINE_H };
  }
  const nameLines = wrappedLines(name, Math.max(1, Math.floor(avail / NAME_CH))) > 1 ? 2 : 1;
  const stackedH = HEADER_PAD_V + HEADER_ROW_H * (nameLines + 1);
  if (h - stackedH >= MIN_BODY_H) return { inline: false, showPct: true, nameLines, h: stackedH };
  return { inline: true, showPct: false, nameLines: 1, h: HEADER_INLINE_H };
}

/** A dated daily close, as the companies docs carry them (`week5Closes`, oldest first). */
export interface DatedClose { date: string; close: number }

/**
 * The move of the latest regular session, rebuilt from the stored dated closes:
 * the close dated `sessionIso` against the one before it. Null unless the NEWEST
 * stored close is that session. The technicals job can run a session behind, and
 * its last two closes would then be the session before's move, so a stale doc
 * shows "—" instead of a plausible wrong number.
 */
export function lastSessionPct(closes: DatedClose[] | null | undefined, sessionIso: string): number | null {
  if (!closes || closes.length < 2) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  if (last.date !== sessionIso || !(last.close > 0) || !(prev.close > 0)) return null;
  return ((last.close - prev.close) / prev.close) * 100;
}

/**
 * An N-session move measured to the live price. `closes` are the job's N+1 dated
 * closes (oldest first: 6 for 1W, 22 for 1M). While the newest stored close IS
 * the live price's session the window's base is the first close; once the live
 * price is from a LATER session, that session counts as one of the N and the
 * base moves forward to the second close. Null when the live price is older than
 * the newest stored close, or anything is missing — the caller then keeps the
 * stored move rather than guessing.
 */
export function windowPctToLive(
  closes: DatedClose[] | null | undefined,
  livePrice: number | null | undefined,
  liveDateIso: string | null | undefined,
): number | null {
  if (!closes || closes.length < 3 || !(livePrice != null && livePrice > 0) || !liveDateIso) return null;
  const newest = closes[closes.length - 1];
  const base = liveDateIso > newest.date ? closes[1] : liveDateIso === newest.date ? closes[0] : null;
  if (!base || !(base.close > 0)) return null;
  return ((livePrice - base.close) / base.close) * 100;
}

/** The slice of a live quote `dayMovePct` reads (a subset of LiveQuote). */
export interface HmQuote {
  pctChange: number | null;
  marketStatus?: string | null;
  previousClose?: number | null;
  regularClose?: number | null;
  /** The vendor's own move for the latest completed session (backend `lastSessionChangePct`). */
  lastSessionPct?: number | null;
}

/**
 * The 1D move a tile shows. The page says "As of Monday close" outside the
 * session, so it has to be the REGULAR session's move then, not the quote's
 * `pctChange`, which off-hours is measured to the latest extended-hours print:
 *
 *  - open            the live day move.
 *  - pre-market      no regular session has run today, so the quote's change is
 *                    the pre-market print against the close (0.00% for nearly
 *                    every stock) and the stored change has been re-based to the
 *                    new day (also 0). The last session's move is the vendor's
 *                    own (`lastSessionPct`), else rebuilt from the dated closes;
 *                    with neither, no number rather than a 0.
 *  - after / closed  the regular close against the close before it. An
 *                    after-hours print is not in it.
 *
 * `phase` is the market clock ("open" | "pre" | "after" | "closed"), used when a
 * ticker has no live quote. Mirrors the stock header's rule (quote-headline.tsx).
 */
export function dayMovePct(
  q: HmQuote | null | undefined,
  storedPct: number | null | undefined,
  closes: DatedClose[] | null | undefined,
  sessionIso: string,
  phase: string,
): number | null {
  const status = q?.marketStatus ?? (phase === "open" ? "open" : phase === "pre" ? "early_trading" : null);
  if (status === "open" || (status == null && q?.pctChange != null)) return q?.pctChange ?? storedPct ?? null;
  // The vendor's own figure for the completed session comes first; the dated
  // closes cover a server that does not send it yet.
  if (status === "early_trading") return q?.lastSessionPct ?? lastSessionPct(closes, sessionIso);
  if (q?.lastSessionPct != null) return q.lastSessionPct;
  const rc = q?.regularClose;
  const pc = q?.previousClose;
  if (rc != null && pc != null && rc > 0 && pc > 0) return ((rc - pc) / pc) * 100;
  return lastSessionPct(closes, sessionIso) ?? storedPct ?? null;
}

/**
 * "As of Friday close, Nov 20, 2026" outside the session, "Live · ~15 min
 * delayed" during it. `sessionIso` is the ET date of the latest regular session.
 */
export function asOfLabel(phase: string, sessionIso: string, delayLabel: string): string {
  if (phase === "open") return `Live · ${delayLabel}`;
  const d = new Date(`${sessionIso}T12:00:00Z`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `As of ${weekday} close, ${date}`;
}

/** One item to place on the map; `weight` sizes its area. */
export interface LItem { key: string; weight: number; }
/** Where it went, in the same units as the box it was laid out in. */
export interface LRect { key: string; x: number; y: number; w: number; h: number; }

/**
 * Squarified treemap (Bruls, Huizing, van Wijk): rows of tiles are laid along
 * the shorter side of what is left, and a row keeps growing only while that makes
 * its worst tile closer to a square. Tiles stay roughly square, which keeps labels
 * readable — unlike halving the box over and over, which leaves long thin slices.
 *
 * `items` must be sorted by weight, largest first. Areas are exactly
 * proportional to weight; items with no weight are skipped.
 */
export function squarify(items: LItem[], x: number, y: number, w: number, h: number): LRect[] {
  const live = items.filter(i => i.weight > 0);
  const total = live.reduce((n, i) => n + i.weight, 0);
  if (live.length === 0 || !(w > 0) || !(h > 0) || !(total > 0)) return [];
  const scale = (w * h) / total;
  const rest = live.map(i => ({ key: i.key, area: i.weight * scale }));
  const out: LRect[] = [];
  let cx = x, cy = y, cw = w, ch = h;
  let at = 0;

  while (at < rest.length) {
    const side = Math.min(cw, ch);
    // Worst aspect ratio of a row with this total/min/max area, laid along `side`.
    const worst = (sum: number, min: number, max: number) =>
      Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));

    let end = at + 1;
    let sum = rest[at].area, min = sum, max = sum;
    while (end < rest.length) {
      const a = rest[end].area;
      if (worst(sum + a, Math.min(min, a), Math.max(max, a)) > worst(sum, min, max)) break;
      sum += a; min = Math.min(min, a); max = Math.max(max, a); end++;
    }

    if (cw >= ch) {
      // Wide space: the row is a column down the left edge.
      const rw = sum / ch;
      let yy = cy;
      for (let i = at; i < end; i++) {
        const rh = rest[i].area / rw;
        out.push({ key: rest[i].key, x: cx, y: yy, w: rw, h: rh });
        yy += rh;
      }
      cx += rw; cw -= rw;
    } else {
      // Tall space: the row runs along the top edge.
      const rh = sum / cw;
      let xx = cx;
      for (let i = at; i < end; i++) {
        const rw = rest[i].area / rh;
        out.push({ key: rest[i].key, x: xx, y: cy, w: rw, h: rh });
        xx += rw;
      }
      cy += rh; ch -= rh;
    }
    at = end;
  }
  return out;
}

/** Key of the bundled "+N more" tile in a packed layout. */
export const MORE_KEY = "__more__";

export interface Packed<T> {
  /** Stocks that keep a tile of their own, largest first. */
  visible: T[];
  /** The rest, bundled into one tile under `MORE_KEY`. */
  more: T[];
  rects: Map<string, LRect>;
}

/**
 * Lays `stocks` (sorted by weight, largest first) into a w × h box, and bundles
 * the smallest into one "+N more" tile once they would be too small to read.
 * It keeps as many stocks as it can while every kept tile is at least
 * `minTile(sym)` = [width, height] and the bundle at least `minMore`. A box too
 * small for even one tile yields nothing.
 */
export function packStocks<T extends { sym: string; weight: number }>(
  stocks: T[],
  w: number,
  h: number,
  minTile: (sym: string) => [number, number],
  minMore: [number, number],
): Packed<T> {
  if (stocks.length === 0 || !(w > 0) || !(h > 0)) return { visible: [], more: [], rects: new Map() };

  const lay = (cutoff: number): Packed<T> => {
    const visible = stocks.slice(0, cutoff);
    const more = stocks.slice(cutoff);
    const items: LItem[] = visible.map(s => ({ key: s.sym, weight: s.weight }));
    if (more.length > 0) items.push({ key: MORE_KEY, weight: more.reduce((n, s) => n + s.weight, 0) });
    // The bundle goes last even when it outweighs the smallest kept stocks (a long
    // tail adds up): sorted by weight it would take the top-left corner and read as
    // the sector's biggest company.
    return { visible, more, rects: new Map(squarify(items, 0, 0, w, h).map(r => [r.key, r])) };
  };

  const fits = (cutoff: number): boolean => {
    const { visible, more, rects } = lay(cutoff);
    for (const s of visible) {
      const r = rects.get(s.sym);
      const [mw, mh] = minTile(s.sym);
      if (!r || r.w < mw || r.h < mh) return false;
    }
    if (more.length > 0) {
      const r = rects.get(MORE_KEY);
      if (!r || r.w < minMore[0] || r.h < minMore[1]) return false;
    }
    return true;
  };

  let cutoff = stocks.length;
  if (stocks.length > 1 && !fits(stocks.length)) {
    let low = 1, high = stocks.length - 1;
    cutoff = 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (fits(mid)) { cutoff = mid; low = mid + 1; } else high = mid - 1;
    }
  }
  return lay(cutoff);
}

/**
 * Ticker size for a tile, in rem, from its pixel size: about 0.55 on the
 * smallest labelled tiles, 1 around 110px across, 1.3 around 240px, and no more
 * than 1.5 — big names read at a glance, small ones still fit.
 */
export function tileFontRem(w: number, h: number): number {
  const s = Math.sqrt(Math.max(0, w) * Math.max(0, h));
  const rem = 0.55 + 0.95 * (1 - Math.exp(-(s - 50) / 110));
  return Math.max(0.45, Math.min(1.5, rem));
}

/**
 * A stock's market cap in $B for sizing and weighting. The stored cap is only as
 * fresh as its job (AMD's read $744B while the live quote said $680B after a -9%
 * day), so the live quote's own cap wins when it is there and plausible: within
 * half to double of the stored one, which keeps a class-only or otherwise odd
 * vendor figure from rescaling a tile.
 */
export function liveCapBillions(liveCap: number | null | undefined, storedBillions: number): number {
  if (liveCap == null || !(liveCap > 0)) return storedBillions;
  const live = liveCap / 1e9;
  return live >= storedBillions * 0.5 && live <= storedBillions * 2 ? live : storedBillions;
}
