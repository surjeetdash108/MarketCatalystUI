import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planFor, type SessionMetrics, type Setup } from "./alpha-intraday";

const m = (o: Partial<SessionMetrics>): SessionMetrics => ({
  session: "2026-11-18", bars: 24, open: 35.45, orHigh: 35.68, orLow: 34.6, dayHigh: 35.68, dayLow: 33.69,
  price: 34.29, vwap: 34.4, priorClose: 36.6, priorHigh: 37, priorLow: 36.35, gap: -0.03, chg: -0.063,
  minutes: 120, rvol: 2, fill: 1, lastBarAt: 0, crosses: 0, avgRange: 0.005, closes: [], ...o,
});

// Error 8 (B, Nov 18): short entry $34.25–$34.57, cover stop $34.55 — inside
// the zone and below the $34.60 opening-range low that was broken.
describe("the stop sits outside the entry zone and beyond the trigger", () => {
  it("short breakdown: cover stop above the trigger and the zone top", () => {
    const s = { name: "Opening range breakdown", dir: "Short", trigger: 34.6 } as unknown as Setup;
    const p = planFor(m({}), s, true)!;
    assert.ok(p.zoneHi < 34.6 && p.zoneLo < p.zoneHi);
    assert.ok(p.stop > p.zoneHi, `stop ${p.stop} must be above the zone top ${p.zoneHi}`);
    assert.ok(p.stop > 34.6, `stop ${p.stop} must be above the trigger 34.60`);
  });
  it("long breakout: stop below the trigger and the zone bottom", () => {
    const s = { name: "Opening range breakout", dir: "Long", trigger: 52.18 } as unknown as Setup;
    const p = planFor(m({ price: 52.4, vwap: 52.3, orLow: 50.9, orHigh: 52.18, avgRange: 0.004 }), s, true)!;
    assert.ok(p.stop < p.zoneLo, `stop ${p.stop} must be below the zone bottom ${p.zoneLo}`);
    assert.ok(p.stop < 52.18);
  });
});
