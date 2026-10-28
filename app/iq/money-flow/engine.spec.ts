import { describe, it } from "node:test";
import assert from "node:assert";
import {
  computeDollarFlow,
  computeConfidence,
  computeSectorFlows,
  computeStockSession,
  computeCandles,
  computeOrderBlocks,
  formatCompactDollars,
  formatPct,
} from "./engine";

describe("Money Flow Engine", () => {
  it("formats compact dollar amounts correctly", () => {
    assert.strictEqual(formatCompactDollars(840_000_000), "+$840M");
    assert.strictEqual(formatCompactDollars(-458_000_000), "−$458M");
    assert.strictEqual(formatCompactDollars(1_250_000_000), "+$1.3B");
    assert.strictEqual(formatCompactDollars(-2_400_000_000), "−$2.4B");
  });

  it("formats percentages with signed decimals", () => {
    assert.strictEqual(formatPct(1.24), "+1.24%");
    assert.strictEqual(formatPct(-0.96), "−0.96%");
    assert.strictEqual(formatPct(0), "0.00%");
  });

  it("computes stock sessions across S&P 500 universe", () => {
    const stocks = computeStockSession(0.75);
    assert.ok(stocks.length >= 80, "Expected at least 80 stocks in universe");

    const sample = stocks[0];
    assert.ok(sample.t.length > 0);
    assert.ok(sample.px > 0);
    assert.ok(typeof sample.mv === "number");
    assert.ok(sample.sec.length > 0);
  });

  it("computes signed dollar flow and candles for a session stock", () => {
    const stocks = computeStockSession(0.75);
    const sample = stocks[0];
    const candles = computeCandles(sample);
    assert.ok(candles.length > 0, "Candles should be generated");

    const flow = computeDollarFlow(sample, candles);
    assert.ok(typeof flow.net === "number");
    assert.ok(flow.buy >= 10 && flow.buy <= 90);
    assert.ok(flow.hours.length === 7);
  });

  it("computes confidence score bounded within 1 to 99", () => {
    const stocks = computeStockSession(0.75);
    const sample = stocks[0];
    const conf = computeConfidence(sample, stocks);
    assert.ok(conf.sc >= 1 && conf.sc <= 99, `Expected score between 1 and 99, got ${conf.sc}`);
    assert.ok(conf.parts.length === 8, "Expected 8 factor breakdown parts");
  });

  it("aggregates sector flows across sectors with bar width", () => {
    const stocks = computeStockSession(0.75);
    const { sectors, top2Inflow, top2Outflow } = computeSectorFlows(stocks);
    assert.ok(sectors.length >= 15, "Expected sectors aggregated");
    assert.ok(top2Inflow.length <= 2);
    assert.ok(top2Outflow.length <= 2);

    for (const sf of sectors) {
      assert.ok(typeof sf.flowVal === "number");
      assert.ok(sf.stockCount >= 0);
      assert.ok(parseFloat(sf.barWidthPct) >= 0 && parseFloat(sf.barWidthPct) <= 100);
    }
  });

  it("produces valid order blocks and key levels", () => {
    const stocks = computeStockSession(0.5);
    const sample = stocks[0];
    const candles = computeCandles(sample);
    const obs = computeOrderBlocks(sample, candles);
    assert.ok(Array.isArray(obs));
    assert.ok(sample.R1 > 0 && sample.S1 > 0);
    assert.ok(sample.zHi > sample.zLo);
  });
});
