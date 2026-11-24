import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeInsiders, compactUsd } from "./insider-summary";

const tx = (ownerName: string, transactionDate: string, transactionCode: string, shares: number, pricePerShare: number | null) =>
  ({ ownerName, transactionDate, transactionCode, shares, pricePerShare });

describe("summarizeInsiders", () => {
  const today = "2026-11-24";
  const txns = [
    tx("A", "2026-11-20", "P", 1000, 50),   // buy $50K
    tx("B", "2026-11-10", "P", 2000, 50),   // buy $100K
    tx("A", "2026-11-01", "S", 500, 60),    // sell $30K
    tx("C", "2026-11-05", "M", 9000, 10),   // option exercise: not a trade
    tx("D", "2026-07-01", "S", 99999, 60),  // outside 90 days
  ];

  it("counts only open-market buys and sells inside the window", () => {
    const s = summarizeInsiders(txns, today, 30);
    assert.equal(s.buys, 2);
    assert.equal(s.sells, 1);
    assert.equal(s.buyValue, 150_000);
    assert.equal(s.sellValue, 30_000);
    assert.equal(s.netValue, 120_000);
    assert.equal(s.buyers, 2);
    assert.equal(s.sellers, 1);
    assert.deepEqual(s.largest, { owner: "B", side: "buy", value: 100_000, date: "2026-11-10" });
    assert.equal(s.verdict, "Net buying: $150K bought vs $30K sold.");
  });

  it("says so when there are no trades", () => {
    assert.equal(summarizeInsiders([], today, 90).verdict, "No open-market insider trades in the last 90 days.");
  });

  it("names one-sided activity", () => {
    assert.equal(summarizeInsiders([tx("A", "2026-11-20", "S", 100, 10)], today, 30).verdict, "Selling only: 1 insider sold $1K.");
  });

  it("a trade with no price counts but adds no dollars", () => {
    const s = summarizeInsiders([tx("A", "2026-11-20", "P", 100, null)], today, 30);
    assert.equal(s.buys, 1);
    assert.equal(s.buyValue, 0);
    assert.equal(s.largest, null);
  });

  it("formats compact dollars", () => {
    assert.equal(compactUsd(4_200_000), "$4.2M");
    assert.equal(compactUsd(-1_500_000_000), "-$1.5B");
  });
});
