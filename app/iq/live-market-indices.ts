import type { PulseItem } from "./data";

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
    };
  });
}
