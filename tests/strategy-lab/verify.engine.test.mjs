// Strategy Lab verification (audit) — engine E1–E13, parser R1–R9, config D4 (pure layer).
// Deterministic synthetic bars (seeded RNG). Run: node --test tests/strategy-lab/verify.engine.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as BT from "../../app/iq/sl/engine.js";
import { exitPlanEngine, riskToCfg, savedCfgOf, valCfg, windowStart } from "../../app/iq/sl/lab-config.js";

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const iso = (d) => d.toISOString().slice(0, 10);
function sessions(from, to) {
  const out = [], d = new Date(from + "T00:00:00Z");
  while (iso(d) <= to) {
    const k = iso(d), wd = d.getUTCDay();
    if (wd && wd !== 6 && !BT.nyseHolidays(d.getUTCFullYear()).has(k)) out.push(k);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
function daily(from, to, seed, drift = 0.0004, vol = 0.015) {
  const r = rng(seed), out = [];
  let px = 100;
  for (const date of sessions(from, to)) {
    const open = px * (1 + (r() - 0.5) * vol * 0.5), close = open * (1 + drift + (r() - 0.5) * 2 * vol);
    out.push({ date, open, high: Math.max(open, close) * (1 + r() * vol * 0.5), low: Math.min(open, close) * (1 - r() * vol * 0.5), close, volume: 1e6 * (0.5 + r()) });
    px = close;
  }
  return out;
}
function intraday(from, to, minutes, seed) {
  const r = rng(seed), out = [];
  let px = 50;
  for (const day of sessions(from, to))
    for (let m = 570; m < 960; m += minutes) {
      const open = px, close = open * (1 + (r() - 0.497) * 0.004);
      out.push({ date: `${day} ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`, open, high: Math.max(open, close) * (1 + r() * 0.001), low: Math.min(open, close) * (1 - r() * 0.001), close, volume: 1e4 * (0.5 + r()) });
      px = close;
    }
  return out;
}
const C = (a, op, b) => ({ a, op, b }), CL = { ind: "close" }, sma = (n) => ({ ind: "sma", n }), num = (v) => ({ ind: "num", v });
const SMAX = { entry: [C(sma(20), "crosses above", sma(50))], exit: [C(sma(20), "crosses below", sma(50))] };
const calDays = (a, b) => (Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 864e5;
const withStart = (bars, c) => ({ ...c, startDate: windowStart(bars[bars.length - 1].date, c) });
const D = daily("2018-06-01", "2025-06-30", 7);

describe("B. engine", () => {
  it("E1 daily 5Y SMA 20/50: CAGR = (1+total)^(365.25/calendarDays) − 1", () => {
    const r = BT.runRules(D, SMAX, withStart(D, valCfg({ yrs: "5" }, "d")));
    const days = calDays(r.eq[0].date, r.eq[r.eq.length - 1].date);
    const want = Math.pow(1 + r.m.tot, 365.25 / days) - 1;
    console.log(`E1 cagr=${(r.m.cagr * 100).toFixed(4)}% expected=${(want * 100).toFixed(4)}% days=${days}`);
    assert.ok(Math.abs(r.m.cagr - want) < 1e-4);
  });

  it("E2 weekly 5Y: CAGR within 0.5 pp, Sharpe √52, coverage complete", () => {
    const W = BT.toWeekly(D), c = withStart(W, valCfg({ yrs: "5" }, "1w")), r = BT.runRules(W, SMAX, c);
    const s = W[r.start], e = W[W.length - 1], trueC = Math.pow(e.close / s.close, 365.25 / calDays(s.date, e.date)) - 1;
    const rets = r.eq.slice(1).map((x, i) => x.v / r.eq[i].v - 1), m = rets.reduce((a, b) => a + b, 0) / rets.length, sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / rets.length);
    const ev = BT.buildEvidence(r, { symbol: "T", strategy: "x", cfg: c, bars: W, tf: "1w", period: { years: 5 } });
    console.log(`E2 bh cagr=${(r.mb.cagr * 100).toFixed(3)}% calendar=${(trueC * 100).toFixed(3)}% sharpe=${r.m.sharpe.toFixed(4)} √52-recalc=${((m / sd) * Math.sqrt(52)).toFixed(4)} coverage=${ev.coverage.status}`);
    assert.ok(Math.abs(r.mb.cagr - trueC) < 0.005);
    assert.ok(Math.abs(r.m.sharpe - (m / sd) * Math.sqrt(52)) < 1e-9);
    assert.equal(ev.coverage.status, "complete");
  });

  it("E3 5-min, 21 trading days, EMA 9/20: cagr null, total = compounded trades, exposure > 0", () => {
    const B = intraday("2025-03-03", "2025-05-30", 5, 11);
    const days = [...new Set(B.map((b) => b.date.slice(0, 10)))];
    const first = days[days.length - 21], c = { ...valCfg({ idays_5m: "21" }, "5m"), startDate: first };
    const spec = { entry: [C({ ind: "ema", n: 9 }, "crosses above", { ind: "ema", n: 20 })], exit: [C({ ind: "ema", n: 9 }, "crosses below", { ind: "ema", n: 20 })] };
    const r = BT.runRules(B, spec, c), comp = r.trades.reduce((a, t) => a * (1 + t.ret), 1) - 1;
    console.log(`E3 cagr=${r.m.cagr} tot=${r.m.tot.toFixed(6)} compounded=${comp.toFixed(6)} exposure=${r.m.exposure.toFixed(3)} trades=${r.trades.length}`);
    assert.equal(r.m.cagr, null);
    assert.ok(Math.abs(r.m.tot - comp) < 1e-9);
    assert.ok(r.m.exposure > 0);
  });

  it("E4 weekly 1Y, weekly 3Y, 1h 30D, 4h 90D return results", () => {
    const W = BT.toWeekly(D), out = [];
    for (const y of ["1", "3"]) out.push(["1w " + y + "Y", BT.runRules(W, SMAX, withStart(W, valCfg({ yrs: y }, "1w")))]);
    for (const [tf, mins, d, from] of [["1h", 60, "30", "2025-01-02"], ["4h", 240, "90", "2024-06-03"]]) {
      const B = intraday(from, "2025-06-30", mins, 3);
      out.push([tf + " " + d + "D", BT.runRules(B, SMAX, withStart(B, valCfg({ ["idays_" + tf]: d }, tf)))]);
    }
    console.log("E4 " + out.map(([k, r]) => `${k}: ${r ? r.eq.length + " pts" : "null"}`).join(" · "));
    for (const [k, r] of out) assert.ok(r, k);
  });

  it("E5 close crosses above orh(6) on daily → needs intraday candles", () => {
    const need = BT.checkRules({ entry: [C(CL, "crosses above", { ind: "orh", n: 6 })], exit: [] }, "d");
    console.log("E5 checkRules(d) =", JSON.stringify(need));
    assert.ok(need.some((x) => /intraday candles/.test(x)));
  });

  it("E6 bars ≥ 5 exit and maxBars 5 both hold exactly 5 bars", () => {
    const B = daily("2023-01-02", "2024-12-31", 21), al = { entry: [C(CL, ">", num(0))] };
    const a = BT.runRules(B, { ...al, exit: [C({ ind: "bars" }, "≥", num(5))] }, { stop: 0 }), b = BT.runRules(B, { ...al, exit: [] }, { stop: 0, maxBars: 5 });
    const held = (r) => [...new Set(r.trades.filter((t) => t.why !== "Still open").map((t) => B.findIndex((x) => x.date === t.outDate) - B.findIndex((x) => x.date === t.inDate)))];
    console.log(`E6 bars≥5 holds=${held(a)} maxBars5 holds=${held(b)}`);
    assert.deepEqual(held(a), [5]);
    assert.deepEqual(held(b), [5]);
  });

  // Flat fixture: open = close = 100, high 101, low 99 → true range 2, Wilder ATR(14) = 2.
  const flat = () => sessions("2024-01-02", "2024-06-28").map((date) => ({ date, open: 100, high: 101, low: 99, close: 100, volume: 1e6 }));
  const E = 40, ALWAYS = { entry: [C(CL, ">", num(0))], exit: [] };
  const run = (bars, cfg) => BT.runRules(bars, ALWAYS, { startDate: bars[E - 1].date, costBps: 0, ...cfg });
  const firstTrade = (r, bars) => r.trades.find((t) => t.inDate === bars[E].date);

  it("E7 stop + target in one bar → stop; gap below stop → fill at open", () => {
    const b1 = flat(); b1[E + 1] = { ...b1[E + 1], high: 120, low: 90 };
    const t1 = firstTrade(run(b1, { stop: 0.05, tp: 0.1 }), b1);
    const b2 = flat(); b2[E + 1] = { ...b2[E + 1], open: 90, high: 91, low: 89, close: 90 };
    const t2 = firstTrade(run(b2, { stop: 0.05, tp: 0.1 }), b2);
    console.log(`E7 same-bar: ${t1.why} @ ${t1.outPx} · gap: ${t2.why} @ ${t2.outPx} (min(open 90, stop 95))`);
    assert.equal(t1.why, "Stop loss"); assert.equal(t1.outPx, 95);
    assert.equal(t2.why, "Stop loss"); assert.equal(t2.outPx, Math.min(90, 95));
  });

  it("E8 Stop None / Target None from UI cfg → stop 0, tp null, no stop/target exits", () => {
    const c = valCfg({ stopM: "none", tpM: "none", yrs: "3" }, "d");
    const r = BT.runRules(D, { entry: [C(CL, "crosses above", { ind: "hh", n: 20 })], exit: [C(CL, "<", { ind: "ll", n: 10 })] }, withStart(D, c));
    const why = [...new Set(r.trades.map((t) => t.why))];
    console.log(`E8 stop=${c.stop} tp=${c.tp} exits=${JSON.stringify(why)} defaultStop=${valCfg({}, "d").stop}`);
    assert.equal(c.stop, 0); assert.equal(c.tp, null);
    assert.ok(!why.includes("Stop loss") && !why.includes("Take profit"));
  });

  it("E9 2×ATR stop, 2R target, trail from +1R, breakeven, maxBars 20 (hand-checked)", () => {
    const res = {};
    // 2×ATR stop: entry 100, ATR 2 → stop 96. Bar E+2 low 95.5.
    let b = flat(); b[E + 2] = { ...b[E + 2], low: 95.5 };
    res.atrStop = firstTrade(run(b, exitPlanEngine({ stopM: "atr", stopA: "2" })), b);
    // 2R target: risk 4 → target 108. Bar E+2 high 109.
    b = flat(); b[E + 2] = { ...b[E + 2], high: 109 };
    res.target2R = firstTrade(run(b, exitPlanEngine({ stopM: "atr", stopA: "2", tpM: "r", tpR: "2" })), b);
    // Trail 5% from +1R: close 105 at E+1 (≥ 104) arms it; bar E+2 low 99 < 105 × 0.95 = 99.75.
    const armed = () => { const x = flat(); x[E + 1] = { ...x[E + 1], high: 105.5, low: 100, close: 105 }; x[E + 2] = { ...x[E + 2], open: 104, high: 104.5, low: 99, close: 100 }; return x; };
    b = armed();
    res.trail = firstTrade(run(b, exitPlanEngine({ stopM: "atr", stopA: "2", trA: "1r", trD: "5" })), b);
    res.noTrail = firstTrade(run(b, exitPlanEngine({ stopM: "atr", stopA: "2" })), b);
    // Breakeven: same path, low 99 at E+2 hits the moved stop at 100 (entry), not the 96 stop.
    res.be = firstTrade(run(b, exitPlanEngine({ stopM: "atr", stopA: "2", be: "on" })), b);
    // maxBars 20 on flat bars.
    b = flat();
    res.max20 = firstTrade(run(b, exitPlanEngine({ maxB: "20" })), b);
    console.log("E9 " + Object.entries(res).map(([k, t]) => `${k}: ${t.why} @ ${t.outPx} (${t.days} bars)`).join(" · "));
    assert.equal(res.atrStop.why, "Stop loss"); assert.equal(res.atrStop.outPx, 96);
    assert.equal(res.target2R.why, "Take profit"); assert.equal(res.target2R.outPx, 108);
    assert.equal(res.trail.why, "Trailing stop"); assert.ok(Math.abs(res.trail.outPx - 99.75) < 1e-9);
    assert.notEqual(res.noTrail.outDate, b[E + 2].date);
    assert.equal(res.be.why, "Breakeven stop"); assert.equal(res.be.outPx, 100);
    assert.equal(res.max20.why, "Time exit"); assert.equal(res.max20.days, 20);
  });

  it("E10 1Y daily evidence: coverage complete; claims gated only by trade counts", () => {
    const c = withStart(D, valCfg({ yrs: "1" }, "d")), r = BT.runRules(D, SMAX, c);
    const ev = BT.buildEvidence(r, { symbol: "T", strategy: "x", cfg: c, bars: D, tf: "d", period: { years: 1 } });
    const reasons = [...new Set(ev.claims.map((x) => x.reason))];
    console.log(`E10 coverage=${ev.coverage.status} span=${ev.coverage.span_days}/${ev.coverage.requested_days}d reasons=${JSON.stringify(reasons)}`);
    assert.equal(ev.coverage.status, "complete");
    assert.ok(reasons.every((x) => x == null || /Too few closed trades/.test(x)));
  });

  it("E11 ATR is Wilder-smoothed (reference to 1e-9)", () => {
    const ref = (b, n) => { const o = Array(b.length).fill(null); let v = null; for (let i = 1; i < b.length; i++) { const tr = Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)); if (i < n) { v = (v ?? 0) + tr; } else if (i === n) { v = (v + tr) / n; o[i] = v; } else { v = (v * (n - 1) + tr) / n; o[i] = v; } } return o; };
    const a = BT.series(D, { ind: "atr", n: 14 }), want = ref(D, 14);
    let maxErr = 0;
    for (let i = 0; i < D.length; i++) { if (want[i] == null) { assert.equal(a[i], null); continue; } maxErr = Math.max(maxErr, Math.abs(a[i] - want[i])); }
    console.log(`E11 max |engine − reference| = ${maxErr.toExponential(2)} over ${D.length} bars`);
    assert.ok(maxErr < 1e-9);
  });

  it("E12 still-open trade: exit cost in the mark-to-market", () => {
    const B = daily("2023-01-02", "2024-12-31", 2), r = BT.runRules(B, { entry: [C(CL, ">", num(0))], exit: [] }, { costBps: 10 });
    const t = r.trades[r.trades.length - 1], L = B[B.length - 1];
    const gross = L.close / t.inPx - 1, net = (L.close * 0.999) / (t.inPx * 1.001) - 1;
    console.log(`E12 why=${t.why} ret=${t.ret.toFixed(6)} net=${net.toFixed(6)} gross=${gross.toFixed(6)}`);
    assert.equal(t.why, "Still open");
    assert.ok(Math.abs(t.ret - net) < 1e-12);
  });

  it("E13 20,000 1-min bars, MACD + hh(252) + RSI: median of 5 runs < 200 ms", () => {
    const B = intraday("2025-01-02", "2025-04-30", 1, 9).slice(0, 20000);
    const spec = { entry: [C({ ind: "macd" }, "crosses above", { ind: "macds" }), C(CL, ">", { ind: "hh", n: 252, mult: 0.99 }), C({ ind: "rsi", n: 14 }, "<", num(70))], exit: [C({ ind: "rsi", n: 14 }, ">", num(80))] };
    const c = valCfg({ idays_1m: "7" }, "1m");
    const ms = [];
    for (let k = 0; k < 6; k++) { const t0 = performance.now(); const r = BT.runRules(B, spec, c); const d = performance.now() - t0; assert.ok(r); if (k) ms.push(d); }
    ms.sort((a, b) => a - b);
    console.log(`E13 bars=${B.length} runs(ms)=${ms.map((x) => x.toFixed(1)).join(",")} median=${ms[2].toFixed(1)}`);
    assert.ok(ms[2] < 200);
  });
});

const S = (r) => JSON.parse(JSON.stringify({ entry: r.entry, exit: r.exit }));
describe("C. parser", () => {
  const cases = [
    ["R1", "Buy when RSI(2) is below 10 and close is above the 200-day SMA, exit when close crosses above the 5-day SMA", { entry: [C({ ind: "rsi", n: 2 }, "<", num(10)), C(CL, ">", sma(200))], exit: [C(CL, "crosses above", sma(5))] }],
    ["R2", "buy when rsi below 30 or price below lower bollinger band, sell when rsi above 70", { entry: [{ any: [C({ ind: "rsi", n: 14 }, "<", num(30)), C(CL, "<", { ind: "bbl", n: 20 })] }], exit: [C({ ind: "rsi", n: 14 }, ">", num(70))] }],
    ["R3", "buy when the 50 day ma crossover the 200 day ma", { entry: [C(sma(50), "crosses above", sma(200))], exit: [] }],
    ["R4", "buy after a sell-off when rsi(2) below 5", { entry: [C({ ind: "rsi", n: 2 }, "<", num(5))], exit: [] }],
    ["R5", "buy when price is above the 50-day moving average with a 10% trailing stop", { entry: [C(CL, ">", sma(50))], exit: [] }],
    ["R6", "buy when close above 200 dma, exit after 2 weeks", { entry: [C(CL, ">", sma(200))], exit: [C({ ind: "bars" }, "≥", num(10))] }],
    ["R7", "buy when price breaks the 6m high", { entry: [C(CL, "crosses above", { ind: "hh", n: 126 })], exit: [] }],
  ];
  for (const [id, q, want] of cases)
    it(`${id} ${q}`, () => {
      const r = BT.parseRules(q);
      console.log(`${id} → entry ${r.entry.map(BT.label).join(" AND ") || "∅"} | exit ${r.exit.map(BT.label).join(" OR ") || "∅"} | unparsed ${JSON.stringify(r.unparsed)}${r.trail != null ? " | trail " + r.trail : ""}${r.stop != null ? " | stop " + r.stop : ""}`);
      assert.deepEqual(S(r), want);
      if (id === "R5") { assert.equal(r.trail, 0.1); assert.equal(r.stop, undefined); }
      if (id === "R7") assert.equal(BT.parseTimeframe(q), "d");
    });
  it("R8 between → unparsed, no rule guessed", () => {
    const r = BT.parseRules("buy when close is between the 20 sma and 50 sma");
    console.log(`R8 → entry ${r.entry.length} rules, unparsed ${JSON.stringify(r.unparsed)}`);
    assert.equal(r.entry.length, 0); assert.ok(r.unparsed.length > 0);
  });
  it("R9 parseTimeframe", () => {
    const got = ["12-1m momentum", "6m high", "15 min chart", "4h"].map(BT.parseTimeframe);
    console.log("R9 →", JSON.stringify(got));
    assert.deepEqual(got, ["d", "d", "15m", "4h"]);
  });
});

describe("D. config (pure layer)", () => {
  it("D3 AI risk mapped exactly (no snapping, no forced 8%)", () => {
    const k = riskToCfg({ stop: 0.065, tp: 0.15, trail: null }), e = exitPlanEngine(k);
    console.log(`D3 riskToCfg → ${JSON.stringify(k)} → stop ${e.stop} tp ${e.tp}; unstated stop → ${exitPlanEngine(riskToCfg({})).stop}`);
    assert.equal(e.stop, 0.065); assert.equal(e.tp, 0.15); assert.equal(exitPlanEngine(riskToCfg({})).stop, 0);
  });
  it("D4 saved config round-trip (2×ATR stop, 2R target, 15-min 60D, 10 bps) — pure functions only", () => {
    const labCfg = { stopM: "atr", stopA: "2", tpM: "r", tpR: "2", cost: "10", idays_15m: "60" };
    const saved = savedCfgOf(labCfg, "15m"), restored = valCfg(saved, "15m"), orig = valCfg(labCfg, "15m");
    console.log(`D4 saved=${JSON.stringify(saved)} equal=${JSON.stringify(restored) === JSON.stringify(orig)}`);
    assert.deepEqual(restored, orig);
  });
});
