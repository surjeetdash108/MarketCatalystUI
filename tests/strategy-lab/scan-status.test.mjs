// While a run is scanning, the "…" in its status counts up one dot at a time
// (".", "..", "...", repeat); nothing else in the results header (no progress bar).
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { blinkParts, SCAN_DOTS_CSS } from "../../app/iq/sl/lab-run.js";
const LAB_HOVER_CSS = fs.readFileSync(new URL("../../app/iq/sl/lab-view.jsx", import.meta.url), "utf8").match(/export const LAB_HOVER_CSS = (".*");/)[1];

describe("scanning dots blink", () => {
  it("splits the status so each … can blink while the run is busy", () => {
    assert.deepEqual(blinkParts("Scanning… no matches so far", true), [{ t: "Scanning", dots: false }, { t: "…", dots: true }, { t: " no matches so far", dots: false }]);
    assert.deepEqual(blinkParts("3 stocks meet the rules now · scanning…", true), [{ t: "3 stocks meet the rules now · scanning", dots: false }, { t: "…", dots: true }]);
  });
  it("a finished run's text does not blink", () => {
    assert.deepEqual(blinkParts("3 stocks meet the rules now", false), [{ t: "3 stocks meet the rules now", dots: false }]);
  });
});

describe("scanning dots count up: one dot, two dots, three dots", () => {
  const panels = fs.readFileSync(new URL("../../app/iq/sl/lab-panels.jsx", import.meta.url), "utf8");
  const ctl = fs.readFileSync(new URL("../../app/iq/sl/lab-controller.jsx", import.meta.url), "utf8");
  it("the busy … is drawn as three separate dots, not one blinking glyph", () => {
    assert.match(panels, /className="sl-dots"[^>]*><i>\.<\/i><i>\.<\/i><i>\.<\/i>/);
    assert.doesNotMatch(panels, /sl-blink/);
    assert.doesNotMatch(LAB_HOVER_CSS, /slBlink/);
  });
  it("dot 1 always shows, dot 2 joins a third of the way through the cycle, dot 3 two thirds", () => {
    assert.doesNotMatch(SCAN_DOTS_CSS, /i:nth-child\(1\)\{animation/);
    assert.match(SCAN_DOTS_CSS, /\.sl-dots i:nth-child\(2\)\{animation:slDot2 [\d.]+s steps\(1,end\) infinite\}/);
    assert.match(SCAN_DOTS_CSS, /\.sl-dots i:nth-child\(3\)\{animation:slDot3 [\d.]+s steps\(1,end\) infinite\}/);
    assert.match(SCAN_DOTS_CSS, /@keyframes slDot2\{0%\{opacity:0\}33\.33%\{opacity:1\}\}/);
    assert.match(SCAN_DOTS_CSS, /@keyframes slDot3\{0%\{opacity:0\}66\.67%\{opacity:1\}\}/);
  });
  it("the dots stylesheet is on the Lab page", () => assert.match(ctl, /SCAN_DOTS_CSS/));
});

describe("no progress bar while scanning", () => {
  const panels = fs.readFileSync(new URL("../../app/iq/sl/lab-panels.jsx", import.meta.url), "utf8");
  it("the progress bar is gone", () => assert.doesNotMatch(panels, /progressPct/));
});
