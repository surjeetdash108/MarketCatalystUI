// The Technical Read is a few checkable rows (price vs 50/200 DMA with the
// distance, what the averages' order means, RSI) instead of one long sentence.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { trendRows } from "./data";

describe("trendRows", () => {
  it("NVDA 14 Nov: below both averages, 50 DMA still above the 200 DMA, RSI oversold", () => {
    const r = trendRows(162.85, 214.65, 204.19, 24.28);
    assert.deepEqual(r.map((x) => x.title), ["Price below 50 DMA", "Price below 200 DMA", "50 DMA above 200 DMA", "RSI 24.3"]);
    assert.equal(r[0].value, "$214.65  −24.1%");
    assert.equal(r[1].value, "$204.19  −20.2%");
    assert.equal(r[0].tone, "bad");
    assert.equal(r[2].value, "+5.1% gap");
    assert.equal(r[2].tone, "warn"); // old order the price already left, not a bullish sign
    assert.match(r[2].note ?? "", /death cross/);
    assert.equal(r[3].value, "oversold");
  });

  it("a healthy uptrend reads green with no stale-order warning", () => {
    const r = trendRows(120, 110, 100, 55);
    assert.deepEqual(r.map((x) => x.tone), ["good", "good", "good", "neutral"]);
    assert.doesNotMatch(r[2].note ?? "", /Left over/);
  });

  it("price within 1% of an average is 'at' it, not above or below", () => {
    assert.equal(trendRows(100.4, 100, 90, null)[0].title, "Price at 50 DMA");
  });

  it("a row whose input is missing is left out", () => {
    assert.deepEqual(trendRows(100, null, null, null), []);
    assert.deepEqual(trendRows(100, 90, null, 40).map((x) => x.title), ["Price above 50 DMA", "RSI 40.0"]);
  });
});
