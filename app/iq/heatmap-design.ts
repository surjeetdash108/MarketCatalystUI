/**
 * Pure helpers for the Heatmap screen: the tile palette, the legend gradient,
 * which change a time frame reads, and the "as of" line under the title.
 * Kept out of the component so they can be tested without rendering it.
 */

/** Time frames offered above the map. YTD has no synced field yet, so it is shown but off. */
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

/**
 * The change a tile shows for a time frame. 1D is the live day move passed in;
 * 1W is the 5-session change and 1M the 21-session change from the technicals
 * job. Null when the field is not synced for that stock (and always for YTD).
 */
export function framePct(
  frame: HmFrame,
  day: number | null,
  c: { week5ChangePct?: number | null; monthChangePct?: number | null } | null | undefined,
): number | null {
  if (frame === "1D") return day;
  if (frame === "1W") return c?.week5ChangePct ?? null;
  if (frame === "1M") return c?.monthChangePct ?? null;
  return null;
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
