import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { priceAxis, priceChartState } from "./alpha-chart";

// Error 28: AAPL 1M/6M axes topped at the Nov 13 close ($356.27) and missed the
// $360.83 high; Logic #4/#6: charts sat on "Loading price history…".
describe("Alpha Signals price chart", () => {
  it("the axis spans the bars' highs and lows, not just their closes", () => {
    const ax = priceAxis([{ h: 351, l: 340, c: 350 }, { h: 360.83, l: 349.67, c: 356.27 }, { h: 357, l: 345, c: 353.8 }]);
    assert.deepEqual(ax, { hi: 360.83, lo: 340 });
  });
  it("missing highs/lows fall back to the close", () => {
    assert.deepEqual(priceAxis([{ c: 10 }, { c: 12 }, { c: 11 }]), { hi: 12, lo: 10 });
  });
  it("loading → slow after the wait → failed on an error; data wins", () => {
    assert.equal(priceChartState({ loading: true, error: null, waitedMs: 2000, points: 0 }), "loading");
    assert.equal(priceChartState({ loading: true, error: null, waitedMs: 9000, points: 0 }), "slow");
    assert.equal(priceChartState({ loading: false, error: "503", waitedMs: 30000, points: 0 }), "failed");
    assert.equal(priceChartState({ loading: false, error: null, waitedMs: 0, points: 1 }), "empty");
    assert.equal(priceChartState({ loading: true, error: null, waitedMs: 9000, points: 40 }), "ready");
  });
  it("the detail chart uses both", () => {
    const src = readFileSync(new URL("./screens/alpha-signals.tsx", import.meta.url), "utf8");
    assert.match(src, /const \{ hi, lo \} = priceAxis\(pts\);/);
    assert.match(src, /if \(state === "failed"\)/);
  });
});
