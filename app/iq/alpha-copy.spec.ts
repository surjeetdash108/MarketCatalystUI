import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actionOf, confluenceMetric } from "./alpha-signals-model";
import type { CompanyDoc } from "./types";

const c = { ticker: "LQDA", price: 20, pctChange: 1, avgVolume20: 5e6, high52: 21, low52: 10, pctFromHigh52: -4, rsi14: 60, week5ChangePct: 4, sma50: 18 } as CompanyDoc;

describe("swing copy matches the panel", () => {
  // Error 30: LQDA "the data is complete" beside Data 80% and FI unavailable.
  it("'data is complete' only when every input has data", () => {
    assert.match(actionOf(c, 80, "Emerging", 100, 0).why, /data is complete/);
    const partial = actionOf(c, 80, "Emerging", 80, 0);
    assert.equal(partial.key, "act");
    assert.doesNotMatch(partial.why, /data is complete/);
    assert.match(partial.why, /80% of the inputs have data/);
  });
  // Error 31: "0 of 4" on HMY vs "0 of 5" elsewhere.
  it("always out of five families, naming the missing ones", () => {
    assert.equal(confluenceMetric(0, 4), "0 of 5 signal families aligned (1 unavailable)");
    assert.equal(confluenceMetric(1, 5), "1 of 5 signal families aligned");
    assert.equal(confluenceMetric(0, 2), "Too few signal families to compare");
  });
});
