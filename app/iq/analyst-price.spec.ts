import { describe, it } from "node:test";
import assert from "node:assert";
import { shownPrice } from "./analyst-actions-engine";

// FLG on the Analyst Actions screen, E2E Oct 26: no quote yet → px 0 → "$0.00".
describe("shownPrice", () => {
  it("an unknown price (0) is shown as no price, not $0.00", () => {
    assert.strictEqual(shownPrice(0), null);
  });
  it("a real price passes through", () => {
    assert.strictEqual(shownPrice(635.2), 635.2);
  });
});
