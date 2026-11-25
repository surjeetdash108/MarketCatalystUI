import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lowestForwardPe } from "./lowest-forward-pe";

describe("lowestForwardPe", () => {
  it("ranks by price over next-year EPS, losses and sub-1x outliers out", () => {
    const rows = lowestForwardPe([
      { ticker: "AAA", price: 100, nextFyEps: 10 }, // 10x
      { ticker: "BBB", price: 50, nextFyEps: 10 }, // 5x
      { ticker: "LOSS", price: 20, nextFyEps: -1 },
      { ticker: "ODD", price: 5, nextFyEps: 50 }, // 0.1x: bad data
      { ticker: "NONE", price: 30, nextFyEps: null },
      { ticker: "CCC", price: 120, nextFyEps: 4 }, // 30x
      { ticker: "PDD", price: 87.9, nextFyEps: 71.2, peRatio: 8.45 }, // yuan estimate: 1.2x vs 8.5x trailing
    ], 2);
    assert.deepEqual(rows.map(r => [r.ticker, r.forwardPe]), [["BBB", 5], ["AAA", 10]]);
  });
});
