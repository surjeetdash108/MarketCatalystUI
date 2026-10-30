// Strategy Lab engine + parser tests (node:test). Deterministic synthetic bars.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as BT from "../../app/iq/sl/engine.js";
import { exitPlanEngine, valCfg, windowStart } from "../../app/iq/sl/lab-config.js";

// ── Synthetic data ──────────────────────────────────────────────────────────

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
function sessionsBetween(from, to) {
  const out = [], d = new Date(from + "T00:00:00Z");
  while (iso(d) <= to) {
    const k = iso(d), wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6 && !BT.nyseHolidays(d.getUTCFullYear()).has(k)) out.push(k);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
/** Daily bars: geometric random walk with drift, realistic OHLC. */
function dailyBars(from, to, seed = 7, drift = 0.0004, vol = 0.015) {
  const r = rng(seed), out = [];
  let px = 100;
  for (const date of sessionsBetween(from, to)) {
    const open = px * (1 + (r() - 0.5) * vol * 0.5);
    const close = open * (1 + drift + (r() - 0.5) * 2 * vol);
    const high = Math.max(open, close) * (1 + r() * vol * 0.5), low = Math.min(open, close) * (1 - r() * vol * 0.5);
    out.push({ date, open, high, low, close, volume: 1e6 * (0.5 + r()) });
    px = close;
  }
  return out;
}
/** Intraday bars of `minutes` size for each session, 09:30–15:59 ET. */
function intradayBars(from, to, minutes, seed = 11) {
  const r = rng(seed), out = [];
  let px = 50;
  for (const day of sessionsBetween(from, to)) {
    for (let m = 570; m < 960; m += minutes) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0"), mm = String(m % 60).padStart(2, "0");
      const open = px, close = open * (1 + (r() - 0.497) * 0.004);
      const high = Math.max(open, close) * (1 + r() * 0.001), low = Math.min(open, close) * (1 - r() * 0.001);
      out.push({ date: `${day} ${hh}:${mm}:00`, open, high, low, close, volume: 1e4 * (0.5 + r()) });
      px = close;
    }
  }
  return out;
}
const C = (a, op, b) => ({ a, op, b });
const CLOSE = { ind: "close" }, sma = (n) => ({ ind: "sma", n }), num = (v) => ({ ind: "num", v });
const SMA_X = { entry: [C(sma(20), "crosses above", sma(50))], exit: [C(sma(20), "crosses below", sma(50))] };
const yearsBetween = (a, b) => (Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / (365.25 * 864e5);

// ── Engine ──────────────────────────────────────────────────────────────────

describe("annualisation", () => {
  const bars = dailyBars("2018-06-01", "2025-06-30");
  const cfg = { ...valCfg({ yrs: "5", cost: "5" }, "d") };
  cfg.startDate = windowStart(bars[bars.length - 1].date, cfg);
  const r = BT.runRules(bars, SMA_X, cfg);

  it("daily 5Y SMA 20/50 cross: CAGR uses calendar years", () => {
    assert.ok(r, "ran");
    const yrs = yearsBetween(r.eq[0].date, r.eq[r.eq.length - 1].date);
    assert.ok(Math.abs(r.m.years - yrs) < 1e-9);
    assert.ok(Math.abs(yrs - 5) < 0.02);
    assert.ok(Math.abs(r.m.cagr - (Math.pow(1 + r.m.tot, 1 / yrs) - 1)) < 1e-12);
    assert.ok(Math.abs(r.mb.cagr - (Math.pow(1 + r.mb.tot, 1 / yrs) - 1)) < 1e-12);
  });

  it("same bars weekly, 5Y: CAGR within 0.5 pp of the calendar CAGR, Sharpe × √52, coverage complete", () => {
    const wk = BT.toWeekly(bars);
    const wc = { ...valCfg({ yrs: "5" }, "1w") };
    wc.startDate = windowStart(wk[wk.length - 1].date, wc);
    const w = BT.runRules(wk, SMA_X, wc);
    assert.ok(w, "weekly ran");
    // True calendar CAGR of buy & hold over the same dates from the daily bars.
    const d0 = bars.find((b) => b.date >= w.eq[0].date.slice(0, 10)), d1 = bars[bars.length - 1];
    const wb = wk[w.start];
    const trueCagr = Math.pow(d1.close / wb.close, 1 / yearsBetween(wb.date, d1.date)) - 1;
    assert.ok(d0);
    assert.ok(Math.abs(w.mb.cagr - trueCagr) < 0.005, `weekly ${w.mb.cagr} vs ${trueCagr}`);
    const rets = w.eq.slice(1).map((x, i) => x.v / w.eq[i].v - 1), mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
    assert.ok(Math.abs(w.m.sharpe - (mean / sd) * Math.sqrt(52)) < 1e-9);
    const ev = BT.buildEvidence(w, { symbol: "TEST", strategy: "x", cfg: wc, bars: wk, tf: "1w", period: { years: 5 } });
    assert.equal(ev.coverage.status, "complete");
    assert.match(ev.limitations[1], /^Weekly bars/);
  });

  it("1Y daily evidence: coverage complete", () => {
    const c = { ...valCfg({ yrs: "1" }, "d") };
    c.startDate = windowStart(bars[bars.length - 1].date, c);
    const r1 = BT.runRules(bars, SMA_X, c);
    assert.ok(r1);
    const ev = BT.buildEvidence(r1, { symbol: "TEST", strategy: "x", cfg: c, bars, tf: "d", period: { years: 1 } });
    assert.equal(ev.coverage.status, "complete");
    assert.match(ev.limitations[1], /^Daily bars/);
  });
});

describe("intraday", () => {
  it("5-min, 21 days: cagr null, total return = compounded trades, exposure > 0", () => {
    const bars = intradayBars("2025-04-01", "2025-05-30", 5);
    const cfg = { ...valCfg({ idays_5m: "21" }, "5m") };
    cfg.startDate = windowStart(bars[bars.length - 1].date, cfg);
    const spec = { entry: [C({ ind: "ema", n: 9 }, "crosses above", { ind: "ema", n: 20 })], exit: [C({ ind: "ema", n: 9 }, "crosses below", { ind: "ema", n: 20 })] };
    const r = BT.runRules(bars, spec, cfg);
    assert.ok(r);
    assert.equal(r.m.cagr, null);
    assert.equal(r.mb.cagr, null);
    const comp = r.trades.reduce((a, t) => a * (1 + t.ret), 1) - 1;
    assert.ok(Math.abs(r.m.tot - comp) < 1e-9, `${r.m.tot} vs ${comp}`);
    assert.ok(r.m.exposure > 0);
    assert.ok(r.trades.length > 0);
    assert.ok(r.trades.every((t) => t.why !== "Still open" || t === r.trades[r.trades.length - 1]));
  });

  for (const [tf, mins, days, from] of [["1h", 60, 30, "2025-01-02"], ["4h", 240, 90, "2024-06-03"]]) {
    it(`${tf} ${days}D runs`, () => {
      const bars = intradayBars(from, "2025-06-30", mins, 3);
      const cfg = { ...valCfg({ ["idays_" + tf]: String(days) }, tf) };
      cfg.startDate = windowStart(bars[bars.length - 1].date, cfg);
      const r = BT.runRules(bars, SMA_X, cfg);
      assert.ok(r, `${tf} ran`);
      assert.ok(r.eq.length > 5);
    });
  }

  for (const y of ["1", "3"]) {
    it(`weekly ${y}Y runs`, () => {
      const wk = BT.toWeekly(dailyBars("2019-01-02", "2025-06-30", 5));
      const cfg = { ...valCfg({ yrs: y }, "1w") };
      cfg.startDate = windowStart(wk[wk.length - 1].date, cfg);
      assert.ok(BT.runRules(wk, SMA_X, cfg));
    });
  }

  it("20,000 1-minute bars backtest in under 200 ms", () => {
    const bars = intradayBars("2025-01-02", "2025-04-30", 1, 9).slice(0, 20000);
    assert.equal(bars.length, 20000);
    const spec = { entry: [C({ ind: "ema", n: 9 }, "crosses above", { ind: "ema", n: 20 }), C(CLOSE, ">", { ind: "vwap" }), C({ ind: "macd" }, ">", { ind: "macds" })], exit: [C(CLOSE, "<", { ind: "ll", n: 30 }), C({ ind: "rsi", n: 14 }, ">", num(75))] };
    const cfg = { ...valCfg({ idays_1m: "7" }, "1m") };
    BT.runRules(bars, spec, cfg); // warm the JIT
    const t0 = performance.now();
    const r = BT.runRules(bars, spec, cfg);
    const ms = performance.now() - t0;
    assert.ok(r);
    assert.ok(ms < 200, `${ms.toFixed(1)} ms`);
  });
});

describe("rules and exits", () => {
  it("ORB rule on daily: needs intraday candles", () => {
    const orb = { entry: [C(CLOSE, "crosses above", { ind: "orh", n: 6 })], exit: [C(CLOSE, "<", { ind: "vwap" })] };
    assert.ok(BT.checkRules(orb, "d").some((x) => /intraday candles/.test(x)));
    assert.ok(BT.checkRules(orb, "1w").some((x) => /intraday candles/.test(x)));
    assert.deepEqual(BT.checkRules(orb, "5m"), []);
  });

  it("bars ≥ 5 and maxBars 5 both hold 5 bars", () => {
    const bars = dailyBars("2023-01-02", "2024-12-31", 21);
    const always = { entry: [C(CLOSE, ">", num(0))] };
    const a = BT.runRules(bars, { ...always, exit: [C({ ind: "bars" }, "≥", num(5))] }, { stop: 0, tp: null });
    const b = BT.runRules(bars, { ...always, exit: [] }, { stop: 0, tp: null, maxBars: 5 });
    for (const r of [a, b]) {
      const closed = r.trades.filter((t) => t.why !== "Still open");
      assert.ok(closed.length > 10);
      for (const t of closed) {
        const i0 = bars.findIndex((x) => x.date === t.inDate), i1 = bars.findIndex((x) => x.date === t.outDate);
        assert.equal(i1 - i0, 5, `${t.inDate} → ${t.outDate}`);
        assert.equal(t.days, 5);
      }
    }
  });

  it("stop and target touched in one bar: stop wins; a gap through the stop fills at the open", () => {
    const base = dailyBars("2024-01-02", "2024-06-28", 4).map((b) => ({ ...b, open: 100, high: 100.5, low: 99.5, close: 100 }));
    const spec = { entry: [C(CLOSE, ">", num(0))], exit: [] };
    const k = 40;
    // bar k: entry at open 100. bar k+1: low 90 and high 120 → both 5% stop and 10% target touched.
    const same = base.map((b, i) => (i === k + 1 ? { ...b, open: 100, high: 120, low: 90, close: 100 } : b));
    const r1 = BT.runRules(same, spec, { startDate: base[k - 1].date, stop: 0.05, tp: 0.1, costBps: 0 });
    const t1 = r1.trades.find((t) => t.outDate === base[k + 1].date);
    assert.equal(t1.why, "Stop loss");
    assert.equal(t1.outPx, 95);
    // bar k+1 opens at 90, below the 95 stop → filled at 90.
    const gap = base.map((b, i) => (i === k + 1 ? { ...b, open: 90, high: 91, low: 89, close: 90 } : b));
    const r2 = BT.runRules(gap, spec, { startDate: base[k - 1].date, stop: 0.05, tp: 0.1, costBps: 0 });
    const t2 = r2.trades.find((t) => t.outDate === base[k + 1].date);
    assert.equal(t2.why, "Stop loss");
    assert.equal(t2.outPx, 90);
  });

  it("Stop None / Target None reach the engine as stop 0 / tp null", () => {
    const e = exitPlanEngine({ stopM: "none", tpM: "none" });
    assert.equal(e.stop, 0);
    assert.equal(e.tp, null);
    const cfg = valCfg({ stopM: "none", tpM: "none", yrs: "3" }, "d");
    assert.equal(cfg.stop, 0);
    assert.equal(cfg.tp, null);
    const bars = dailyBars("2019-01-02", "2025-06-30", 8, 0, 0.03);
    const r = BT.runRules(bars, { entry: [C(CLOSE, "crosses above", { ind: "hh", n: 20 })], exit: [C(CLOSE, "<", { ind: "ll", n: 10 })] }, cfg);
    assert.ok(r.trades.length > 5);
    assert.ok(!r.trades.some((t) => t.why === "Stop loss" || t.why === "Take profit"));
    // And with no labCfg at all the default is no stop (no forced 8%).
    assert.equal(valCfg({}, "d").stop, 0);
  });

  it("still-open trade is marked net of the exit cost and labelled", () => {
    const bars = dailyBars("2023-01-02", "2024-12-31", 2);
    const r = BT.runRules(bars, { entry: [C(CLOSE, ">", num(0))], exit: [] }, { costBps: 10 });
    const last = r.trades[r.trades.length - 1], L = bars[bars.length - 1];
    assert.equal(last.why, "Still open");
    assert.ok(Math.abs(last.ret - ((L.close * 0.999) / (last.inPx * 1.001) - 1)) < 1e-12);
    assert.ok(Math.abs(r.eq[r.eq.length - 1].v / r.eq[0].v - 1 - r.m.tot) < 1e-12);
  });

  it("warm-up: too little history before the window is reported, not silently run", () => {
    const bars = dailyBars("2024-01-02", "2024-12-31", 2);
    const spec = { entry: [C(CLOSE, ">", sma(200))], exit: [] };
    assert.equal(BT.warmup(spec), 200);
    const hc = BT.historyCheck(bars, spec, { startDate: "2024-03-01" });
    assert.equal(hc.ok, false);
    assert.equal(BT.runRules(bars, spec, { startDate: "2024-03-01" }), null);
  });

  it("ATR is Wilder-smoothed", () => {
    const bars = dailyBars("2024-01-02", "2024-06-28", 6);
    const a = BT.series(bars, { ind: "atr", n: 14 });
    const tr = bars.map((b, i) => (i ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)) : 0));
    let v = tr.slice(1, 15).reduce((x, y) => x + y, 0) / 14;
    assert.ok(Math.abs(a[14] - v) < 1e-12);
    for (let i = 15; i < bars.length; i++) v = (v * 13 + tr[i]) / 14;
    assert.ok(Math.abs(a[bars.length - 1] - v) < 1e-9);
    assert.equal(a[13], null);
  });
});

// ── Parser ──────────────────────────────────────────────────────────────────

const strip = (r) => JSON.parse(JSON.stringify({ entry: r.entry, exit: r.exit }));

describe("parseRules", () => {
  it("RSI(2) pullback with SMA exit", () => {
    const r = BT.parseRules("Buy when RSI(2) is below 10 and close is above the 200-day SMA, exit when close crosses above the 5-day SMA");
    assert.deepEqual(strip(r), {
      entry: [C({ ind: "rsi", n: 2 }, "<", num(10)), C(CLOSE, ">", sma(200))],
      exit: [C(CLOSE, "crosses above", sma(5))],
    });
    assert.deepEqual(r.unparsed, []);
  });

  it("entry OR → any group; sell side", () => {
    const r = BT.parseRules("buy when rsi below 30 or price below lower bollinger band, sell when rsi above 70");
    assert.deepEqual(strip(r), {
      entry: [{ any: [C({ ind: "rsi", n: 14 }, "<", num(30)), C(CLOSE, "<", { ind: "bbl", n: 20 })] }],
      exit: [C({ ind: "rsi", n: 14 }, ">", num(70))],
    });
    assert.deepEqual(r.unparsed, []);
  });

  it("crossover means crosses above", () => {
    const r = BT.parseRules("buy when the 50 day ma crossover the 200 day ma");
    assert.deepEqual(strip(r), { entry: [C(sma(50), "crosses above", sma(200))], exit: [] });
  });

  it("sell-off is not an exit", () => {
    const r = BT.parseRules("buy after a sell-off when rsi(2) below 5");
    assert.deepEqual(strip(r), { entry: [C({ ind: "rsi", n: 2 }, "<", num(5))], exit: [] });
  });

  it("N% trailing stop → trail", () => {
    const r = BT.parseRules("buy when price is above the 50-day moving average with a 10% trailing stop");
    assert.deepEqual(strip(r), { entry: [C(CLOSE, ">", sma(50))], exit: [] });
    assert.equal(r.trail, 0.1);
    assert.equal(r.stop, undefined);
    assert.deepEqual(r.unparsed, []);
  });

  it("dma and a time exit in weeks", () => {
    const r = BT.parseRules("buy when close above 200 dma, exit after 2 weeks");
    assert.deepEqual(strip(r), { entry: [C(CLOSE, ">", sma(200))], exit: [C({ ind: "bars" }, "≥", num(10))] });
    assert.deepEqual(r.unparsed, []);
  });

  it("6m high is a 126-day look-back on daily", () => {
    const q = "buy when price breaks the 6m high";
    assert.deepEqual(strip(BT.parseRules(q)), { entry: [C(CLOSE, "crosses above", { ind: "hh", n: 126 })], exit: [] });
    assert.equal(BT.parseTimeframe(q), "d");
  });

  it("between → unparsed", () => {
    const r = BT.parseRules("buy when close is between the 20 sma and 50 sma");
    assert.deepEqual(r.entry, []);
    assert.ok(r.unparsed.length >= 1);
  });

  it("a candle-size phrase sets the timeframe, not a rule", () => {
    const q = "buy when the 9 bar ema crosses above the 21 bar ema on the 15 min chart, exit when the 9 bar ema crosses below the 21 bar ema";
    const r = BT.parseRules(q);
    assert.deepEqual(strip(r), { entry: [C({ ind: "ema", n: 9 }, "crosses above", { ind: "ema", n: 21 })], exit: [C({ ind: "ema", n: 9 }, "crosses below", { ind: "ema", n: 21 })] });
    assert.deepEqual(r.unparsed, []);
    assert.equal(BT.parseTimeframe(q), "15m");
  });

  it("leftover words never become a guess", () => {
    const r = BT.parseRules("buy when the analyst rating is above 4");
    assert.deepEqual(r.entry, []);
    assert.ok(r.unparsed.length);
  });
});

describe("parseTimeframe", () => {
  it("minutes only with min/minute or chart words", () => {
    assert.equal(BT.parseTimeframe("12-1m momentum rotation"), "d");
    assert.equal(BT.parseTimeframe("buy the 6m high"), "d");
    assert.equal(BT.parseTimeframe("on the 5m chart buy vwap reclaims"), "5m");
    assert.equal(BT.parseTimeframe("15-minute candles"), "15m");
    assert.equal(BT.parseTimeframe("weekly chart"), "1w");
  });
});
