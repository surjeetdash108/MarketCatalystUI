import { describe, it } from "node:test";
import assert from "node:assert";
import { pointerScale } from "./chart-pointer";

describe("chart pointer maths inside a scaled box (the Money Flow pop-up)", () => {
  it("is 1 when the chart is drawn at its layout size", () => {
    assert.equal(pointerScale(600, 600), 1);
  });
  it("reports the box's scale, so screen px divide back to chart px", () => {
    // 600px-wide canvas in a pop-up scaled to 0.8: 480px on screen.
    const k = pointerScale(480, 600);
    assert.equal(k, 0.8);
    const screenX = 240; // pointer half way across on screen
    assert.equal(screenX / k, 300); // half way across the chart
  });
  it("never divides by zero before layout", () => {
    assert.equal(pointerScale(0, 0), 1);
    assert.equal(pointerScale(480, 0), 1);
  });
});
