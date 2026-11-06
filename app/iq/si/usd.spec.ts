// A missing price / target (null, undefined, NaN) reads "—" instead of
// throwing (null.toLocaleString) or printing "$NaN" — e.g. a trade or thesis
// saved without a target.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { usd } from "./data";

describe("usd", () => {
  it("formats a number as dollars", () => {
    assert.equal(usd(1234.5), "$1,234.50");
    assert.equal(usd(0), "$0.00");
  });
  it("a missing value is a dash", () => {
    assert.equal(usd(null), "—");
    assert.equal(usd(undefined), "—");
    assert.equal(usd(NaN), "—");
  });
});
