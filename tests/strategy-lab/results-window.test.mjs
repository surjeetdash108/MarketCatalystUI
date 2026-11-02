// Strategy Lab results panel (PDF §4.1, §6.2): RETURN · window, VS B&H, WIN %, TRADES
// per stock and the five summary tiles, on real FMP bars captured 2026-10-30.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as BT from "../../app/iq/sl/engine.js";
import { valCfg } from "../../app/iq/sl/lab-config.js";
import { computeRow, cutoffOf, prepBars, windowOpts, windowStats, windowSummary, windowLabel } from "../../app/iq/sl/lab-run.js";

const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/fmp-bars-2026-10-30.json", import.meta.url), "utf8"));
const rows = (a) => a.map(([date, open, high, low, close, volume]) => ({ date, open, high, low, close, volume }));
const SMA = (n) => ({ ind: "sma", n });
// Fast golden cross 20/50 — a library strategy that trades often enough on two years.
const SPEC = { entry: [{ a: SMA(20), op: "crosses above", b: SMA(50) }], exit: [{ a: SMA(20), op: "crosses below", b: SMA(50) }] };
const CFG = valCfg({ stopM: "none", tpM: "none", trA: "never", be: "off", maxB: "none", cost: "5", yrs: "1" }, "d");

/** Independent reference: window return straight from the engine's equity curve. */
function refWindow(eq, cutoff) {
  const s0 = eq.find((x) => String(x.date) >= cutoff) || eq[0];
  return eq[eq.length - 1].v / s0.v - 1;
}

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

describe("per-stock window stats (real AAPL / NVDA / MSFT daily bars)", () => {
  for (const t of ["AAPL", "NVDA", "MSFT"]) {
    it(`${t}: RETURN, VS B&H, WIN %, TRADES match the engine's own curve and trades`, () => {
      const bars = prepBars(rows(fx.daily[t]), "d");
      const row = computeRow(t, t, bars, SPEC, CFG, "d");
      assert.equal(row.status, "ok");
      const r = BT.runRules(bars, SPEC, { ...CFG, startDate: "2025-10-30" });
      for (const n of [30, 90, 365]) {
        const cut = cutoffOf(String(bars[bars.length - 1].date), n, false);
        const w = windowStats(row, n, false);
        assert.ok(Math.abs(w.ret - refWindow(r.eq, cut)) < 1e-12, `ret ${n}`);
        assert.ok(Math.abs(w.bret - refWindow(r.bh, cut)) < 1e-12, `bret ${n}`);
        assert.ok(Math.abs(w.ex - (w.ret - w.bret)) < 1e-15);
        const closed = r.trades.filter((x) => x.why !== "Still open" && String(x.outDate) >= cut);
        assert.equal(w.n, closed.length, `trades ${n}`);
        assert.equal(w.w, closed.filter((x) => x.ret > 0).length, `wins ${n}`);
      }
    });
  }
});

describe("intraday window stats use per-bar equity (real AAPL 5-minute bars)", () => {
  it("a 60-minute window measures the last hour, not the whole day", () => {
    const bars = prepBars(rows(fx.m5.AAPL), "5m");
    const spec = { entry: [{ a: { ind: "ema", n: 9 }, op: "crosses above", b: { ind: "ema", n: 20 } }], exit: [{ a: { ind: "ema", n: 9 }, op: "crosses below", b: { ind: "ema", n: 20 } }] };
    const cfg = valCfg({ stopM: "none", tpM: "none", trA: "never", be: "off", maxB: "none", cost: "0", idays_5m: "7" }, "5m");
    const row = computeRow("AAPL", "Apple", bars, spec, cfg, "5m");
    assert.equal(row.status, "ok");
    const r = BT.runRules(bars, spec, { ...cfg, startDate: row.start });
    const L = String(bars[bars.length - 1].date);
    const cut = cutoffOf(L, 60, true);
    assert.equal(cut, "2026-10-30 14:55:00");
    const w = windowStats(row, 60, true);
    assert.ok(Math.abs(w.bret - refWindow(r.bhBar, cut)) < 1e-12);
    assert.ok(Math.abs(w.ret - refWindow(r.eqBar, cut)) < 1e-12);
    // buy & hold over the last hour = last close / close of the first bar at or after 14:55
    const b0 = bars.find((b) => String(b.date) >= cut);
    assert.ok(Math.abs(w.bret - (bars[bars.length - 1].close / b0.close - 1)) < 1e-12);
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
