// Stock Intelligence → Why it moved: the 6-month chart carries numbered pins on
// the five biggest moves. A pin opens a dialog beside it on hover, and a click
// pins the full one (the cards under the chart are gone). Why it could move →
// BULLISH / BEARISH checks sit above the catalysts timeline.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/si/stock-intelligence.tsx", import.meta.url), "utf8");
const chart = src.slice(src.indexOf("function SixMonthAreaChart"), src.indexOf("const rangesDef"));
const could = src.slice(src.indexOf('{activeTab === "could"'), src.indexOf("TAB 4: FUNDAMENTALS"));

describe("Why it moved chart", () => {
  it("has no card grid under the chart", () => {
    assert.doesNotMatch(chart, /si-event-cards/);
    assert.doesNotMatch(chart, /SI_EVENT_CARD_H/);
  });
  it("pins are numbered, only the five biggest moves get one", () => {
    assert.match(chart, /events\.filter\(\(ev\) => ev\.card !== false\)\.map\(\(ev, idx\) =>/);
    assert.match(chart, /num: idx \+ 1,/);
    assert.match(chart, /\{ev\.num\}\s*<\/text>/);
  });
  it("hover opens the dialog; a click pins it; Escape and a click on the chart close it", () => {
    assert.match(chart, /onMouseEnter=\{\(\) => enterPin\(ev\.num\)\}/);
    assert.match(chart, /setPinned\(\(cur\) => \(cur === ev\.num \? null : ev\.num\)\)/);
    assert.match(chart, /e\.key === "Escape"\) setPinned\(null\)/);
    assert.match(chart, /onClick=\{\(\) => setPinned\(null\)\}/);
    assert.match(chart, /role="dialog"/);
    assert.match(chart, /pinned === activeHover\.num && <EventContextBlocks ev=\{activeHover\} compact \/>/);
  });
  it("the chart fills the height of its card", () => {
    assert.match(chart, /flex: 1, minHeight: 340/);
    assert.match(chart, /viewBox=\{`0 0 1000 \$\{H\}`\}/);
  });
});

describe("Why it could move", () => {
  it("BULLISH and BEARISH checks come first, then the catalysts timeline", () => {
    assert.match(could, /<BullBearChecks bullish=\{stockDetail\.valid\} bearish=\{stockDetail\.invalid\} broken=\{stockDetail\.broken\} \/>/);
    assert.ok(could.indexOf("<BullBearChecks") < could.indexOf("CATALYSTS · RECENT"), "checks above the timeline");
  });
  it("passed catalysts fade back and use a filled grey dot", () => {
    assert.match(could, /opacity: up\.past \? 0\.6 : 1/);
    assert.match(could, /background: up\.past \? "#2a3a4a"/);
  });
});
