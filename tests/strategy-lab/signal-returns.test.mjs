// "Return over N" in the results list and pop-up: for every entry the strategy
// took on the stock in the backtest, the return from the entry price to the
// close N later (calendar days on daily / weekly candles, trading minutes
// intraday), averaged; against the stock's average N return over the test
// window. On real FMP bars captured 2026-10-30.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as BT from "../../app/iq/sl/engine.js";
import { valCfg } from "../../app/iq/sl/lab-config.js";
import { computeRow, engineCfg, forwardStats, prepBars, windowStats, windowSummary } from "../../app/iq/sl/lab-run.js";

const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/fmp-bars-2026-10-30.json", import.meta.url), "utf8"));
const rows = (a) => a.map(([date, open, high, low, close, volume]) => ({ date, open, high, low, close, volume }));
// The screenshot's strategy: close above the 52-week high, exit below the 20-day average.
const SPEC = { entry: [{ a: { ind: "close" }, op: ">", b: { ind: "hh", n: 252 } }], exit: [{ a: { ind: "close" }, op: "<", b: { ind: "sma", n: 20 } }] };
const CFG = valCfg({ stopM: "none", tpM: "none", trA: "never", be: "off", maxB: "none", cost: "5", yrs: "1" }, "d");

/** Brute force: first bar on or after date + n calendar days. */
function refForward(bars, r, n) {
  const at = (d) => { const c = new Date(String(d).slice(0, 10) + "T00:00:00Z"); c.setUTCDate(c.getUTCDate() + n); const cut = c.toISOString().slice(0, 10); return bars.findIndex((b) => String(b.date).slice(0, 10) >= cut); };
  const rets = r.trades.map((t) => { const j = at(t.inDate); return j < 0 ? null : bars[j].close / t.inPx - 1; }).filter((x) => x != null);
  const base = [];
  for (let i = r.start; i < bars.length; i++) { const j = at(bars[i].date); if (j >= 0) base.push(bars[j].close / bars[i].close - 1); }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return { ret: mean(rets), base: mean(base), n: rets.length, w: rets.filter((x) => x > 0).length };
}

describe("return after each signal (real AAPL / NVDA / MSFT daily bars)", () => {
  for (const t of ["AAPL", "NVDA", "MSFT"]) {
    it(`${t}: every chip counts the backtest's signals and averages their N-day returns`, () => {
      const bars = prepBars(rows(fx.daily[t]), "d");
      const r = BT.runRules(bars, SPEC, engineCfg(CFG, bars));
      const row = computeRow(t, t, bars, SPEC, CFG, "d");
      assert.ok(r.trades.length > 0);
      for (const n of [2, 3, 4, 5, 10, 20, 30, 90]) {
        const ref = refForward(bars, r, n), w = windowStats(row, n, false);
        assert.equal(w.n, ref.n, `${t} ${n} signals`);
        assert.equal(w.w, ref.w, `${t} ${n} wins`);
        assert.ok(Math.abs(w.bret - ref.base) < 1e-12, `${t} ${n} base`);
        if (ref.n === 0) { assert.equal(w.ret, null, `${t} ${n}: no signal old enough → no return, not 0`); assert.equal(w.ex, null); continue; }
        assert.ok(Math.abs(w.ret - ref.ret) < 1e-12, `${t} ${n} ret`);
        assert.ok(Math.abs(w.ex - (w.ret - w.bret)) < 1e-15);
      }
    });
  }
  it("short chips are not stuck at 0% / 0 trades for a stock the strategy is not holding today", () => {
    const bars = prepBars(rows(fx.daily.NVDA), "d"), row = computeRow("NVDA", "NVDA", bars, SPEC, CFG, "d");
    const w = windowStats(row, 2, false);
    assert.ok(w.n >= 3, "all NVDA signals are older than 2 days");
    assert.notEqual(w.ret, 0);
    assert.notEqual(windowStats(row, 2, false).ret, windowStats(row, 30, false).ret, "chips change the return");
  });
  it("a signal too recent to have N days after it is left out, not counted as 0", () => {
    const bars = prepBars(rows(fx.daily.AAPL), "d"), r = BT.runRules(bars, SPEC, engineCfg(CFG, bars));
    const last = r.trades[r.trades.length - 1], f = forwardStats(bars, r, 3650, "d");
    assert.equal(f.n, 0);
    assert.equal(f.ret, null);
    assert.equal(f.rets[r.trades.indexOf(last)], null);
  });
});

describe("intraday chips are trading minutes after the entry bar (real AAPL 5-minute bars)", () => {
  it("60 minutes after a 5-minute entry is the close 12 bars later", () => {
    const bars = prepBars(rows(fx.m5.AAPL), "5m");
    const spec = { entry: [{ a: { ind: "ema", n: 9 }, op: "crosses above", b: { ind: "ema", n: 20 } }], exit: [{ a: { ind: "ema", n: 9 }, op: "crosses below", b: { ind: "ema", n: 20 } }] };
    const cfg = valCfg({ stopM: "none", tpM: "none", trA: "never", be: "off", maxB: "none", cost: "0", idays_5m: "7" }, "5m");
    const r = BT.runRules(bars, spec, engineCfg(cfg, bars)), f = forwardStats(bars, r, 60, "5m");
    const ix = new Map(bars.map((b, i) => [String(b.date), i]));
    const ref = r.trades.map((t) => { const j = ix.get(String(t.inDate)) + 12; return j < bars.length ? bars[j].close / t.inPx - 1 : null; });
    assert.deepEqual(f.rets, ref);
  });
});

describe("summary tiles with a chip: signals pooled over the stocks", () => {
  it("profitable = average N return above 0, beat = above the stock's own average, trades = signals", () => {
    const mk = (t, ret, bret, n, w) => ({ t, status: "ok", ago: 0, sh: 1, _w: { ret, bret, ex: ret == null ? null : ret - bret, n, w, open: 0 } });
    const S = windowSummary([mk("A", 0.02, 0.01, 4, 3), mk("B", -0.01, 0.0, 2, 1), mk("C", null, 0.01, 0, 0)], (r) => r._w);
    assert.equal(S.n, 3);
    assert.equal(S.profitable, 1);
    assert.equal(S.beat, 1);
    assert.equal(S.trades, 6);
    assert.equal(S.win, 4 / 6);
  });
});
