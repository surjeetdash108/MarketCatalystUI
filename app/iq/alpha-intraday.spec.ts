import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classify, evaluateIntraday, intradayCandidates, intradayLists, metricsFromBars, vwapScore,
  type Bar, type IntradayCtx, type SessionMetrics,
} from "./alpha-intraday";
import type { CompanyDoc } from "./types";

/** 09:30 ET on a November (EST, UTC−5) date, epoch ms. */
const open = (day: string) => Date.parse(`${day}T14:30:00Z`);

/** One 5-minute bar per close, starting 09:30 ET; o = previous close. */
function session(day: string, closes: number[], vol = 1000, startMin = 0): Bar[] {
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1];
    return { t: open(day) + (startMin + i * 5) * 60_000, o, h: Math.max(o, c) + 0.05, l: Math.min(o, c) - 0.05, c, v: vol };
  });
}

/** Neutral metrics: price at VWAP, no gap, normal volume, mid-morning. */
const M = (o: Partial<SessionMetrics> = {}): SessionMetrics => ({
  session: "2026-11-12", bars: 12, open: 100, orHigh: 101, orLow: 99, dayHigh: 101.5, dayLow: 98.5,
  price: 100, vwap: 100, priorClose: 100, priorHigh: 103, priorLow: 97, gap: 0, chg: 0,
  minutes: 60, rvol: 1.2, fill: 1, lastBarAt: open("2026-11-12") + 55 * 60_000, crosses: 0, avgRange: 0.001,
  closes: [100, 100, 100], ...o,
});
const NOW = open("2026-11-12") + 61 * 60_000;
const CTX: IntradayCtx = { marketOpen: true, spx: 0, now: NOW, chopGuard: true, noiseStops: true };

describe("metricsFromBars (§4.1)", () => {
  it("keeps regular-session bars only and reads the latest session", () => {
    const pre = { t: open("2026-11-12") - 30 * 60_000, o: 90, h: 91, l: 89, c: 90, v: 5000 };
    const m = metricsFromBars([pre, ...session("2026-11-11", [50, 51, 52, 53]), ...session("2026-11-12", [100, 101, 102, 103])])!;
    assert.equal(m.session, "2026-11-12");
    assert.equal(m.bars, 4);
    assert.equal(m.open, 100);
    assert.equal(m.price, 103);
    assert.equal(m.priorClose, 53);
    assert.equal(m.minutes, 20);
    assert.ok(Math.abs((m.gap as number) - (100 / 53 - 1)) < 1e-9);
  });
  it("opening range = first 15 minutes; VWAP = Σ typical × volume ÷ Σ volume", () => {
    const m = metricsFromBars(session("2026-11-12", [100, 102, 101, 105, 104]))!;
    assert.equal(m.orHigh, 102.05);
    assert.equal(m.orLow, 99.95);
    const bars = session("2026-11-12", [100, 102, 101, 105, 104]);
    const vw = bars.reduce((a, b) => a + ((b.h + b.l + b.c) / 3) * b.v, 0) / bars.reduce((a, b) => a + b.v, 0);
    assert.ok(Math.abs(m.vwap - vw) < 1e-9);
  });
  it("RVOL vs the median of earlier sessions at the same bar count; daily RVOL when no history", () => {
    const bars = [
      ...session("2026-11-09", [10, 10, 10, 10, 10], 1000),
      ...session("2026-11-10", [10, 10, 10, 10, 10], 3000),
      ...session("2026-11-11", [10, 10, 10, 10, 10], 100_000),
      ...session("2026-11-12", [10, 10, 10], 4000),
    ];
    assert.ok(Math.abs((metricsFromBars(bars)!.rvol as number) - 12000 / 9000) < 1e-9);
    assert.equal(metricsFromBars(session("2026-11-12", [10, 10, 10]), { dailyRvol: 2.2 })!.rvol, 2.2);
  });
  it("needs 3 bars today", () => {
    assert.equal(metricsFromBars(session("2026-11-12", [10, 11])), null);
  });
});

describe("classification (§4.3): first match wins", () => {
  const c = (o: Partial<SessionMetrics>, ctx: Partial<IntradayCtx> = {}) => classify(M(o), { ...CTX, ...ctx }).name;
  it("guards: opening range forming, late session, not tradable, low volume", () => {
    assert.equal(c({ minutes: 10 }), "Opening range forming");
    assert.equal(c({ minutes: 380 }), "Late session");
    assert.equal(c({ minutes: 380 }, { marketOpen: false }), "Range-bound");
    assert.equal(c({ price: 4, vwap: 4, open: 4 }), "Not tradable");
    assert.equal(c({}, { tradedValue: 5_000_000 }), "Not tradable");
    assert.equal(c({ rvol: 0.8 }), "Low volume");
  });
  it("bearish setups", () => {
    assert.equal(c({ gap: -0.04, open: 100, price: 98, vwap: 99, orLow: 98.5 }), "Gap & drop");
    assert.equal(c({ price: 96.8, vwap: 97.5, priorLow: 97, rvol: 1.6, orLow: 96 }), "Breakdown");
    assert.equal(c({ gap: 0.03, open: 103, price: 101, vwap: 102, priorHigh: 104 }), "Gap fade");
    assert.equal(c({ dayHigh: 102, orHigh: 101, price: 100.5, vwap: 100.8, chg: 0.002 }), "Failed breakout");
    assert.equal(c({ price: 98.8, vwap: 99.5, orLow: 99, dayHigh: 101, rvol: 1.6 }), "Opening range breakdown");
    assert.equal(c({ chg: -0.01, price: 99.8, vwap: 100, dayHigh: 101 }), "VWAP rejection");
    assert.equal(c({ chg: -0.05, price: 96, vwap: 100, orLow: 95, priorLow: 90, dayHigh: 101 }), "Extended down");
    assert.equal(c({ chg: -0.01, price: 99, vwap: 100, orLow: 98, dayHigh: 101 }), "Selling pressure");
  });
  it("bullish setups; Gap & go is checked before Breakout", () => {
    assert.equal(c({ chg: 0.05, price: 104, vwap: 100, orHigh: 101, priorHigh: 103 }), "Extended");
    assert.equal(c({ gap: 0.04, open: 104, price: 105.5, vwap: 105, orHigh: 105, priorHigh: 103, rvol: 2, dayHigh: 106, dayLow: 103.5 }), "Gap & go");
    assert.equal(c({ price: 103.5, vwap: 103, priorHigh: 103, rvol: 1.6, orHigh: 102.5, dayHigh: 104 }), "Breakout");
    assert.equal(c({ gap: -0.04, open: 96, price: 97, vwap: 96.8, orHigh: 98, orLow: 95, dayHigh: 98, dayLow: 95 }), "Reversal up");
    assert.equal(c({ price: 101.5, vwap: 101, orHigh: 101.2, rvol: 1.6, dayHigh: 102 }), "Opening range breakout");
    assert.equal(c({ dayLow: 98.5, orLow: 99, price: 100.2, vwap: 100, chg: 0.01, orHigh: 101 }), "Failed breakdown");
    assert.equal(c({ chg: 0.01, price: 100.3, vwap: 100, dayLow: 99.5, orLow: 99.5, orHigh: 101 }), "VWAP pullback");
    assert.equal(c({ chg: 0, price: 100, vwap: 100 }), "Range-bound");
  });
  it("a falling stock never classifies long", () => {
    const s = classify(M({ chg: -0.02, price: 98, vwap: 99, gap: 0.03, open: 101 }), CTX);
    assert.equal(s.dir, "Short");
  });
});

describe("score (§4.4)", () => {
  it("VWAP score thresholds", () => {
    assert.equal(vwapScore(0), 50);
    assert.equal(vwapScore(0.005), 75);
    assert.equal(vwapScore(0.015), 100);
    assert.equal(vwapScore(0.025), 80);
    assert.equal(vwapScore(-0.005), 25);
  });
  it("bearish setups show 100 − the internal (downside) score", () => {
    const s = evaluateIntraday("X", M({ chg: -0.01, price: 99.8, vwap: 100, dayHigh: 101 }), null, CTX);
    assert.equal(s.setup.dir, "Short");
    assert.equal(s.score, 100 - s.internal);
  });
});

const strongLong = (o: Partial<SessionMetrics> = {}) => M({
  // Opening range breakout on volume, just past the trigger, tight range.
  price: 101.3, vwap: 101.1, open: 100.2, orHigh: 101.2, orLow: 100.8, dayHigh: 101.35, dayLow: 100.1,
  priorHigh: 101.1, chg: 0.02, gap: 0.002, rvol: 2.5, avgRange: 0.001, ...o,
});

describe("actions (§4.5) and robustness caps (§4.7)", () => {
  it("long Setup active needs score ≥ 70, inside the zone, tight stop, good data, no cap; targets only then", () => {
    const s = evaluateIntraday("X", strongLong(), null, CTX);
    assert.equal(s.setup.name, "Breakout");
    assert.ok(s.internal >= 70, `score ${s.internal}`);
    assert.equal(s.action.key, "act");
    assert.ok(s.plan && s.plan.t1 != null && s.plan.t2 != null);
    assert.ok(Math.abs((s.plan!.t2! - s.m.price) - 2 * (s.m.price - s.plan!.stop)) < 1e-9);
  });
  it("midday raises the bar to 75", () => {
    const s = evaluateIntraday("X", strongLong({ minutes: 150 }), null, CTX);
    assert.equal(s.action.key, s.internal >= 75 ? "act" : "alert");
  });
  it("past the entry zone → Watch", () => {
    const s = evaluateIntraday("X", strongLong({ price: 103, dayHigh: 103.05, vwap: 102 }), null, CTX);
    assert.notEqual(s.action.key, "act");
  });
  it("each cap only downgrades Setup active to Building", () => {
    const caps: Array<[string, Partial<SessionMetrics>, Partial<IntradayCtx>]> = [
      ["chop", { crosses: 5 }, {}],
      ["regime", {}, { spx: -0.02 }],
      ["swing conflict", {}, { swingTrend: "Weakening" }],
      ["stale", {}, { now: NOW + 60 * 60_000 }],
      ["sparse", { fill: 0.5 }, {}],
    ];
    for (const [name, m, ctx] of caps) {
      const s = evaluateIntraday("X", strongLong(m), null, { ...CTX, ...ctx });
      assert.equal(s.action.key, "alert", name);
      assert.equal(s.plan?.ifTriggered, true, `${name}: Building targets are marked "if triggered"`);
    }
  });
  it("the backend's 15-minute bar cache alone is not stale", () => {
    const s = evaluateIntraday("X", strongLong(), null, { ...CTX, now: NOW + 20 * 60_000 });
    assert.equal(s.stale, false);
  });
  it("Extended and non-directional setups are Watch; a bearish setup's long action is Avoid", () => {
    assert.equal(evaluateIntraday("X", M({ chg: 0.05, price: 104, vwap: 100 }), null, CTX).action.key, "watch");
    assert.equal(evaluateIntraday("X", M(), null, CTX).action.key, "watch");
    const b = evaluateIntraday("X", M({ chg: -0.01, price: 99.8, vwap: 100, dayHigh: 101 }), null, CTX);
    assert.equal(b.longAction.key, "avoid");
  });
  it("short plan: zone just below the trigger, cover stop above price, targets below", () => {
    const m = M({ price: 96.85, vwap: 97.6, open: 98.5, orHigh: 98.6, orLow: 97.2, dayHigh: 98.7, dayLow: 96.8, priorLow: 97, priorHigh: 100, chg: -0.03, gap: -0.015, rvol: 2.5, avgRange: 0.001 });
    const s = evaluateIntraday("X", m, null, { ...CTX, spx: 0.002 });
    assert.equal(s.setup.name, "Breakdown");
    assert.ok(s.plan!.zoneHi < 97 && s.plan!.zoneLo < s.plan!.zoneHi);
    assert.ok(s.plan!.stop > m.price);
    if (s.action.key === "act") assert.ok((s.plan!.t1 as number) < m.price && s.score <= 30);
  });
});

describe("candidates and lists (§4.8)", () => {
  const co = (t: string, o: Partial<CompanyDoc> = {}): CompanyDoc => ({
    id: t, ticker: t, name: `${t} Inc`, price: 50, pctChange: 2, marketCap: 5e9, rvol: 2, peRatio: null, rsRating: null,
    techRating: null, revenueGrowthYoY: null, epsGrowthYoY: null, grossMargin: null, dividendYield: null, beta: null,
    sector: "Technology Services", industry: null, rsi14: null, macd: null, macdSignal: null, macdHistogram: null,
    sectorRank: null, sectorRankTotal: null, peers: null, source: null, avgVolume20: 2_000_000, exchange: "NYSE", ...o,
  });
  it("filters and ranks by RVOL × (1 + |move %|)", () => {
    const list = intradayCandidates([
      co("AAA", { rvol: 1, pctChange: 1 }),
      co("BBB", { rvol: 3, pctChange: 3 }),
      co("CHEAP", { price: 3 }),
      co("THIN", { avgVolume20: 1000 }),
      co("SMALL", { marketCap: 100e6 }),
      co("FLAT", { pctChange: 0.1 }),
      co("FUND", { name: "Big Income Fund" }),
    ], 24).map(c => c.ticker);
    assert.deepEqual(list, ["BBB", "AAA"]);
  });
  it("bull: actionable longs by score; bear: Setup active first then lowest; dashboard fill adds Watch setups but not Extended", () => {
    const long = evaluateIntraday("L1", strongLong(), co("L1"), CTX);
    const ext = evaluateIntraday("L2", M({ chg: 0.05, price: 104, vwap: 100 }), co("L2"), CTX);
    const watchLong = evaluateIntraday("L3", strongLong({ price: 103, dayHigh: 103.05, vwap: 102 }), co("L3"), CTX);
    const strict = intradayLists([long, ext, watchLong], 10, false);
    assert.deepEqual(strict.bull.map(s => s.ticker), ["L1"]);
    const filled = intradayLists([long, ext, watchLong], 2, true);
    assert.deepEqual(filled.bull.map(s => s.ticker), ["L1", "L3"]);
  });
});
