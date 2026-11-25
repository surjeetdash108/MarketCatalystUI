import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { forwardPe, pegRatio } from "./forward-valuation";

describe("forward valuation", () => {
  it("forward P/E is price over next year's EPS estimate", () => {
    assert.equal(forwardPe(100, 4), 25);
    assert.equal(forwardPe(100, -1), null);
    assert.equal(forwardPe(null, 4), null);
  });
  it("PEG is trailing P/E over expected EPS growth %", () => {
    // EPS 2 → 2.5 is 25% growth; P/E 50 → PEG 2.
    assert.equal(pegRatio(50, 2, 2.5), 2);
    assert.equal(pegRatio(50, 2, 1.8), null, "shrinking earnings: no PEG");
    assert.equal(pegRatio(-10, 2, 3), null);
    assert.equal(pegRatio(50, -1, 3), null);
  });
});
