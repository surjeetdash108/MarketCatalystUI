import type { PulseItem } from "./data";
import type { TapeItem } from "./hooks/useMarketTape";

export interface IndexDoc {
  id: string; label: string; value: number; change: number; pctChange: number;
  proxyTicker: string; isProxy: boolean; note: string | null;
  // market-indices.job.ts has always written these; the type simply never
  // declared them, so mergePulse could not read them and silently kept the
  // mock's open/prevClose beside a live price.
  open?: number; prevClose?: number;
  /**
   * "percent" for instruments quoted in percentage points (the 10Y yield).
   * Absent for price-quoted tiles. Set by market-indices.job.
   */
  unit?: string | null;
}

export const PULSE_LABEL_TO_INDEX_ID: Record<string, string> = {
  "S&P 500": "SPX", "Nasdaq": "NDX", "Dow": "DJI", "Russell 2K": "RUT",
  "VIX": "VIX", "10Y Yield": "US10Y", "WTI Crude": "WTI", "Gold": "GOLD", "Dollar (DXY)": "DXY",
};

/** Shared by Dashboard's Market Pulse widget and the shell's top ticker strip — keeps both merges identical instead of drifting apart. */
export function mergePulse(mock: PulseItem[], live: IndexDoc[]): PulseItem[] {
  const liveById = new Map(live.map(l => [l.id, l]));
  return mock.map(p => {
    const id = PULSE_LABEL_TO_INDEX_ID[p.label];
    const l = id ? liveById.get(id) : undefined;
    if (!l) return p;
    // open/prevClose now come from the live doc. They used to be re-assigned
    // from the mock (`open: p.open`) because IndexDoc never declared these
    // fields — so a fabricated "O … · PC …" rendered directly beside a real
    // price. The mock value remains only as a last-resort fallback for a doc
    // written before those fields existed.
    // The 10Y tile is quoted in percentage POINTS, so its "change" is a
    // basis-point move (4.55 → 4.53 is -0.02), not the -0.44% relative change
    // every price-quoted tile shows. Using pctChange here would restate a 2bp
    // move as a 0.44% one — the same trap that made this tile an inverse TLT
    // proxy before the real yield was wired up.
    const isRate = l.unit === "percent";
    return {
      ...p,
      value: l.value,
      change: isRate ? (l.change ?? p.change) : l.pctChange,
      open: l.open ?? p.open,
      prevClose: l.prevClose ?? p.prevClose,
      proxyTicker: l.proxyTicker ?? p.proxyTicker,
      isProxy: l.isProxy ?? p.isProxy,
      note: l.note ?? p.note,
    };
  });
}

/**
 * Overlays the LIVE streamed tape on top of the once-a-day Firestore values.
 *
 * `market_indices` is written by a job that runs at 18:05 ET, so between the
 * opening bell and the close `mergePulse` alone yields yesterday's numbers. The
 * SSE tape carries the same nine instruments intraday. Applying it here rather
 * than only in the strip means the Dashboard's Market Pulse widget and the
 * index drawer read the same values the strip does — the drawer opening on a
 * price that disagrees with the tile that opened it is exactly the drift
 * `mergePulse` was factored out to prevent.
 *
 * Falls through to the Firestore/mock value for any tile the tape has not
 * supplied, so a backend outage degrades to today's behaviour rather than a
 * blank header.
 */
export function applyTape(rows: PulseItem[], tape: TapeItem[]): PulseItem[] {
  if (!tape.length) return rows;
  const byId = new Map(tape.map(t => [t.id, t]));
  return rows.map(p => {
    const id = PULSE_LABEL_TO_INDEX_ID[p.label];
    const t = id ? byId.get(id) : undefined;
    if (!t || t.value == null) return p;
    // Same percent-vs-basis-point split as mergePulse above: the 10Y tile is
    // quoted in percentage POINTS, so its `change` is already the bp move and
    // must not be swapped for a relative percentage.
    return {
      ...p,
      value: t.value,
      change: t.change ?? p.change,
      open: t.open ?? p.open,
      prevClose: t.prevClose ?? p.prevClose,
      // Real session high/low from the same snapshot — lets the index drawer
      // show a real day range instead of value × 0.997/1.003.
      dayHigh: t.dayHigh ?? p.dayHigh,
      dayLow: t.dayLow ?? p.dayLow,
      proxyTicker: t.proxyTicker ?? p.proxyTicker,
      isProxy: t.isProxy ?? p.isProxy,
      note: t.note ?? p.note,
    };
  });
}

/** One tile in the scrolling strip. */
export interface StripTile {
  key: string;
  label: string;
  value: number;
  /** Percent move, except on the rate tile where it is a basis-point move. */
  change: number;
  kind: "index" | "stock" | "rate";
  /** Set on stock tiles — opens the stock drawer. */
  sym?: string;
  /** Set on index/rate tiles — the row in `pulse` the index drawer expects. */
  pulseIdx?: number;
}

/**
 * Builds the strip: the nine index/macro tiles first (in `pulse` order, so the
 * `pulseIdx` handed to the index drawer stays valid), then the streamed stocks.
 *
 * Tiles with no value are dropped rather than rendered as "—": a scrolling
 * strip gives the reader no time to interpret a blank, and a missing symbol is
 * less misleading than an empty one.
 */
export function buildTapeStrip(rows: PulseItem[], tape: TapeItem[]): StripTile[] {
  const indexTiles: StripTile[] = rows.map((p, i) => ({
    key: `idx-${p.label}`,
    label: p.label,
    value: p.value,
    change: p.change,
    kind: PULSE_LABEL_TO_INDEX_ID[p.label] === "US10Y" ? "rate" : "index",
    pulseIdx: i,
  }));

  const stockTiles: StripTile[] = tape
    .filter(t => t.kind === "stock" && t.value != null && t.change != null)
    .map(t => ({
      key: `stk-${t.id}`,
      label: t.label,
      value: t.value as number,
      change: t.change as number,
      kind: "stock" as const,
      sym: t.id,
    }));

  return [...indexTiles, ...stockTiles];
}
