import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recapMovers } from "./recap-movers";

const lev = (n: string) => /2x|3x|ultra/i.test(n);

describe("recapMovers", () => {
  it("ranks $1B+ companies by today's move, leveraged products and duplicates out", () => {
    const { gainers, losers } = recapMovers([
      { ticker: "NVDA", name: "NVIDIA", price: 87, pctChange: 5.2, marketCap: 2e12 },
      { ticker: "TINY", name: "Tiny Co", price: 2, pctChange: 40, marketCap: 5e7 },
      { ticker: "NVDL", name: "GraniteShares 2x Long NVDA", price: 50, pctChange: 10, marketCap: 3e9 },
      { ticker: "AMD", name: "AMD", price: 140, pctChange: 3.1, marketCap: 2e11 },
      { ticker: "nvda", name: "NVIDIA dup", price: 87, pctChange: 5.2, marketCap: 2e12 },
      { ticker: "INTC", name: "Intel", price: 20, pctChange: -4.4, marketCap: 9e10 },
      { ticker: "F", name: "Ford", price: 11, pctChange: -1.2, marketCap: 4e10 },
      { ticker: "FLAT", name: "Flat", price: 10, pctChange: 0, marketCap: 4e10 },
    ], lev, 5);
    assert.deepEqual(gainers.map(g => g.ticker), ["NVDA", "AMD"]);
    assert.deepEqual(losers.map(g => g.ticker), ["INTC", "F"]);
  });
});
