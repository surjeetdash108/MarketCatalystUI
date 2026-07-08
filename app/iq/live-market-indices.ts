import type { PulseItem } from "./data";

export interface IndexDoc {
  id: string; label: string; value: number; change: number; pctChange: number;
  proxyTicker: string; isProxy: boolean; note: string | null;
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
    return { ...p, value: l.value, change: l.pctChange, open: p.open, prevClose: p.prevClose };
  });
}
