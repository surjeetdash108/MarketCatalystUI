import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { panelLayout, VB_H } from "./stock-earnings-eps-sales";

// HPE's EPS chart had a negative quarter: its value, printed under the bar, and
// the period labels fell below the 240px drawing box and were cut off.
describe("EPS / Sales panel layout", () => {
  for (const font of [8, 10, 12]) {
    it(`font ${font}: a negative bar's value fits above the period labels, all inside the box`, () => {
      const { TOP, BOTTOM, axisY, labelY } = panelLayout(true, font);
      // The value is drawn at y(v) + font + 3 for the lowest bar, y(v) = BOTTOM.
      assert.ok(BOTTOM + font + 3 < axisY, "negative value clears the label strip");
      assert.ok(axisY < labelY && labelY < VB_H, "period labels start inside the box");
      assert.ok(TOP < BOTTOM, "there is room to draw bars");
    });
  }

  it("with no negative bars the bars use the room the value label would have taken", () => {
    const pos = panelLayout(false, 12), neg = panelLayout(true, 12);
    assert.ok(pos.BOTTOM > neg.BOTTOM);
    assert.equal(pos.axisY, neg.axisY);
  });

  it("the period-label strip is deep enough for an angled 'Oct-24' style label", () => {
    // Anchored at labelY and rotated -40°, ~45px of text drops about 29px below it.
    const { labelY } = panelLayout(false, 12);
    assert.ok(VB_H - labelY >= 45 * Math.sin((40 * Math.PI) / 180) + 8);
  });
});
