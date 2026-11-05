// The "Price chart · trades" panel: one builder for the full report and the
// results row pop-up, on real FMP bars captured 2026-10-30.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as BT from "../../app/iq/sl/engine.js";
import { valCfg } from "../../app/iq/sl/lab-config.js";
import { engineCfg, prepBars, priceChart } from "../../app/iq/sl/lab-run.js";

const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/fmp-bars-2026-10-30.json", import.meta.url), "utf8"));
const rows = (a) => a.map(([date, open, high, low, close, volume]) => ({ date, open, high, low, close, volume }));
const SMA = (n) => ({ ind: "sma", n });
const SPEC = { entry: [{ a: SMA(20), op: "crosses above", b: SMA(50) }], exit: [{ a: SMA(20), op: "crosses below", b: SMA(50) }] };

describe("price chart over the test window with trade bands and stop / target lines", () => {
  const bars = prepBars(rows(fx.daily.AAPL), "d");
  const cfg = valCfg({ stopM: "pct", stop: "8", tpM: "pct", tp: "20", trA: "never", be: "off", maxB: "none", cost: "5", yrs: "1" }, "d");
  const ec = engineCfg(cfg, bars), r = BT.runRules(bars, SPEC, ec);
  const fmt = (d) => String(d).slice(0, 10);
  const ch = priceChart(bars, r, ec, { fmt, tfLabel: "Daily" });
  it("covers the test window only, first bar to last", () => {
    assert.equal(ch.d0, fmt(bars[r.start].date));
    assert.equal(ch.d1, fmt(bars[bars.length - 1].date));
    assert.match(ch.sub, /^Daily candles · .* · test window only$/);
    assert.ok(ch.line.startsWith("M0.0,") && ch.area.endsWith("L1000,300L0,300Z"));
  });
  it("one band per trade (green win, red loss) and a stop and target line for each", () => {
    assert.ok(r.trades.length > 0);
    assert.equal(ch.trades.length, r.trades.length);
    r.trades.forEach((t, i) => assert.ok(ch.trades[i].fill.startsWith(t.ret > 0 ? "rgba(61,220,132" : "rgba(240,86,90")));
    assert.equal(ch.levels.length, 2 * r.trades.length);
  });
  it("price axis spans the window's lows and highs", () => {
    const tb = bars.slice(r.start);
    assert.equal(ch.hi, Math.max(...tb.map((q) => q.high)).toFixed(2));
    assert.equal(ch.lo, Math.min(...tb.map((q) => q.low)).toFixed(2));
  });
});
