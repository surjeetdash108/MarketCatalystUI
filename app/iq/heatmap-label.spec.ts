import { describe, it } from "node:test";
import assert from "node:assert";
import { tilePctLabel } from "./heatmap-label";

// Day moves the deployed /live/quotes served at 16:05 ET on 2026-10-26.
describe("tilePctLabel", () => {
  it("a small tile (22 × 14 px) still gets an abbreviated label", () => {
    assert.strictEqual(tilePctLabel(0.6134, 22, 14), "+0.6");
    assert.strictEqual(tilePctLabel(-0.7543, 22, 14), "−0.8");
  });
  it("a roomy tile gets the full label", () => {
    assert.strictEqual(tilePctLabel(1.1379, 60, 40), "+1.14%");
  });
  it("no move known: no label", () => {
    assert.strictEqual(tilePctLabel(null, 60, 40), null);
  });
});
