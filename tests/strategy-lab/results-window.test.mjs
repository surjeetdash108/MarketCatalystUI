// Strategy Lab results panel (PDF §4.1, §6.2): RETURN · window, VS B&H, WIN %, TRADES
// per stock and the five summary tiles, on real FMP bars captured 2026-10-30.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as BT from "../../app/iq/sl/engine.js";
import { valCfg } from "../../app/iq/sl/lab-config.js";
import { computeRow, cutoffOf, prepBars, windowOpts, windowPick, windowStats, windowSummary, windowLabel } from "../../app/iq/sl/lab-run.js";

const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/fmp-bars-2026-10-30.json", import.meta.url), "utf8"));
const rows = (a) => a.map(([date, open, high, low, close, volume]) => ({ date, open, high, low, close, volume }));
const SMA = (n) => ({ ind: "sma", n });
// Fast golden cross 20/50 — a library strategy that trades often enough on two years.
const SPEC = { entry: [{ a: SMA(20), op: "crosses above", b: SMA(50) }], exit: [{ a: SMA(20), op: "crosses below", b: SMA(50) }] };
const CFG = valCfg({ stopM: "none", tpM: "none", trA: "never", be: "off", maxB: "none", cost: "5", yrs: "1" }, "d");

describe("window chips", () => {
  it("daily, weekly and intraday chips are the PDF's, default the third", () => {
    assert.deepEqual(windowOpts("d").base, [2, 3, 4, 5, 10, 20, 30]);
    assert.deepEqual(windowOpts("d").more, [90, 180, 365]);
    assert.deepEqual(windowOpts("1w").base, [7, 14, 21, 28, 35, 42, 56]);
    assert.deepEqual(windowOpts("1m").base, [5, 15, 30, 60, 120, 240, 390]);
    assert.deepEqual(windowOpts("4h").more, [15600, 23400, 46800]);
    assert.equal(windowOpts("5m").def, 60);
    assert.equal(windowOpts("d").def, 4);
    assert.equal(windowLabel(390, true), "1D");
    assert.equal(windowLabel(120, true), "2H");
    assert.equal(windowLabel(90, false), "3M");
    assert.equal(windowLabel(14, false, "1w"), "2W");
  });
});

describe("window cutoff", () => {
  it("daily counts back calendar days from the last bar", () => {
    assert.equal(cutoffOf("2026-10-30", 30, false), "2026-09-30");
    assert.equal(cutoffOf("2026-10-30", 365, false), "2025-10-30");
  });
  it("intraday: whole sessions for multiples of 390, clock minutes otherwise", () => {
    const days = ["2026-10-28", "2026-10-29", "2026-10-30"];
    assert.equal(cutoffOf("2026-10-30 15:55:00", 390, true, days), "2026-10-30");
    assert.equal(cutoffOf("2026-10-30 15:55:00", 780, true, days), "2026-10-29");
    assert.equal(cutoffOf("2026-10-30 15:55:00", 60, true, days), "2026-10-30 14:55:00");
  });
});

describe("summary tiles over stocks triggered on the last bar", () => {
  const mk = (t, ago, sh, ret, bret, n, w) => ({ t, status: "ok", ago, sh, _w: { ret, bret, ex: ret - bret, n, w } });
  it("profitable, beat B&H, pooled win rate, upper-median Sharpe, trades — only ago = 0", () => {
    const R = [mk("A", 0, 1.2, 0.05, 0.02, 3, 2), mk("B", 0, -0.4, -0.01, 0.01, 2, 1), mk("C", 0, 0.8, 0.02, 0.03, 1, 1), mk("D", 0, 0.1, 0.0, -0.01, 0, 0), mk("E", 2, 9, 9, 0, 9, 9)];
    const S = windowSummary(R, (r) => r._w);
    assert.equal(S.n, 4);
    assert.equal(S.profitable, 2);
    assert.equal(S.beat, 2);
    assert.equal(S.trades, 6);
    assert.equal(S.win, 4 / 6);
    assert.equal(S.medSharpe, 0.8); // sorted [-0.4, 0.1, 0.8, 1.2], element ⌊4/2⌋
  });
});

describe("no window picked: the whole backtest period, as the full report shows it", () => {
  it("no chip is selected by default; a picked chip is used, picking it again clears it", () => {
    assert.equal(windowPick("d", undefined), null);
    assert.equal(windowPick("d", ""), null);
    assert.equal(windowPick("d", "4"), 4);
    assert.equal(windowPick("d", "7777"), null, "a value the candle does not offer is not a window");
  });
  for (const t of ["AAPL", "NVDA", "MSFT"]) {
    it(`${t}: RETURN, VS B&H, WIN %, TRADES over the full period match the report's metrics and trades`, () => {
      const bars = prepBars(rows(fx.daily[t]), "d");
      const row = computeRow(t, t, bars, SPEC, CFG, "d");
      const r = BT.runRules(bars, SPEC, { ...CFG, startDate: "2025-10-30" });
      const w = windowStats(row, null, false);
      assert.equal(w.ret, r.m.tot);
      assert.equal(w.bret, r.mb.tot);
      const closed = r.trades.filter((x) => x.why !== "Still open");
      assert.equal(w.n, closed.length);
      assert.equal(w.w, closed.filter((x) => x.ret > 0).length);
      assert.equal(w.open, r.trades.length - closed.length);
    });
  }
});
