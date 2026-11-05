// While a run is scanning, the "…" in its status blinks; nothing else in the
// results header (no progress bar).
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { blinkParts } from "../../app/iq/sl/lab-run.js";
const LAB_HOVER_CSS = fs.readFileSync(new URL("../../app/iq/sl/lab-view.jsx", import.meta.url), "utf8").match(/export const LAB_HOVER_CSS = (".*");/)[1];

describe("scanning dots blink", () => {
  it("splits the status so each … can blink while the run is busy", () => {
    assert.deepEqual(blinkParts("Scanning… no matches so far", true), [{ t: "Scanning", dots: false }, { t: "…", dots: true }, { t: " no matches so far", dots: false }]);
    assert.deepEqual(blinkParts("3 stocks meet the rules now · scanning…", true), [{ t: "3 stocks meet the rules now · scanning", dots: false }, { t: "…", dots: true }]);
  });
  it("a finished run's text does not blink", () => {
    assert.deepEqual(blinkParts("3 stocks meet the rules now", false), [{ t: "3 stocks meet the rules now", dots: false }]);
  });
  it("the blink animation is in the Lab's stylesheet", () => {
    assert.match(LAB_HOVER_CSS, /\.sl-blink\{animation:slBlink/);
    assert.match(LAB_HOVER_CSS, /@keyframes slBlink/);
  });
});

describe("no progress bar while scanning", () => {
  const panels = fs.readFileSync(new URL("../../app/iq/sl/lab-panels.jsx", import.meta.url), "utf8");
  it("the progress bar is gone", () => assert.doesNotMatch(panels, /progressPct/));
});
