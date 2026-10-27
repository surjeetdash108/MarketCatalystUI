import { describe, it } from "node:test";
import assert from "node:assert";
import { tilePctLabel, tileTypography } from "./heatmap-label";

// Day moves the deployed /live/quotes served at 16:05 ET on 2026-10-26.
describe("tilePctLabel", () => {
  it("a small tile (22 × 14 px) still gets an abbreviated label", () => {
    assert.strictEqual(tilePctLabel(0.6134, 22, 14), "+0.6");
    assert.strictEqual(tilePctLabel(-0.7543, 22, 14), "−0.8");
  });
  it("a mid-small tile (e.g. ADBE 42 × 26 px) gets 1-decimal with % to prevent clipping", () => {
    assert.strictEqual(tilePctLabel(-3.20, 42, 26), "−3.2%");
  });
  it("a roomy tile gets the full label", () => {
    assert.strictEqual(tilePctLabel(1.1379, 60, 40), "+1.14%");
    assert.strictEqual(tilePctLabel(-3.20, 60, 40), "−3.20%");
  });
  it("no move known: no label", () => {
    assert.strictEqual(tilePctLabel(null, 60, 40), null);
  });
});

describe("tileTypography", () => {
  it("scales font size and gap so ADBE (-3.20%) does not clip on a 42 × 26 px tile", () => {
    const typo = tileTypography("ADBE", -3.20, 42, 26);
    assert.strictEqual(typo.showText, true);
    assert.strictEqual(typo.pctLabel, "−3.2%");
    assert.ok(typo.fs <= 0.75, `fs was ${typo.fs}, expected <= 0.75`);
    assert.ok(typo.pctFs < typo.fs, "pctFs should be smaller than ticker fs");
    assert.strictEqual(typo.gapPx, 1);
  });

  it("scales font size so ABT (-0.74%) fits on a 34 × 22 px tile", () => {
    const typo = tileTypography("ABT", -0.74, 34, 22);
    assert.strictEqual(typo.showText, true);
    assert.strictEqual(typo.pctLabel, "−0.7");
    assert.ok(typo.fs <= 0.65, `fs was ${typo.fs}, expected <= 0.65`);
  });

  it("hides text when tile is too small to render legibly (<13px dim)", () => {
    const typo = tileTypography("BAC", 0.5, 12, 10);
    assert.strictEqual(typo.showText, false);
  });

  it("omits pct on short tiles (<20px height) to avoid vertical clipping", () => {
    const typo = tileTypography("BAC", 0.5, 24, 16);
    assert.strictEqual(typo.showText, true);
    assert.strictEqual(typo.pctLabel, null);
  });
});

