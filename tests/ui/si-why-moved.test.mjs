// Stock Intelligence → Why it moved: the five catalyst cards are one size, the
// full text opening in a pop-up on hover / click. Why it could move → "What
// would break this setup?" boxes use the main text colour (white in dark,
// near-black in light), not grey.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/si/stock-intelligence.tsx", import.meta.url), "utf8");
const cards = src.slice(src.indexOf("{/* 5 Major Event Cards Below"), src.indexOf("const rangesDef"));

describe("Why it moved cards", () => {
  it("every card has the same fixed height and hides overflow", () => {
    assert.match(src, /const SI_EVENT_CARD_H = \d+;/);
    assert.match(cards, /height: SI_EVENT_CARD_H,\s*overflow: "hidden",/);
    assert.match(cards, /\.\.\.clampLines\(2\)[\s\S]*\{ev\.label\}/);
    assert.match(cards, /\.\.\.clampLines\(3\)[\s\S]*\{ev\.details\}/);
    assert.doesNotMatch(cards.slice(0, cards.indexOf("si-event-pop")), /<EventContextBlocks/, "context lives in the pop-up, not the card");
  });
  it("hover opens the full text; a click / tap pins it; the pop-up has label, details and context", () => {
    assert.match(cards, /onMouseEnter=\{\(\) => \{ setHoveredEventId\(ev\.num\); setOpenCard/);
    assert.match(cards, /onClick=\{\(\) => setOpenCard\(\(o\) => \(o\?\.num === ev\.num && o\.pinned \? null : \{ num: ev\.num, pinned: true \}\)\)\}/);
    const pop = cards.slice(cards.indexOf('className="si-event-pop"'));
    for (const k of ["{ev.label}", "{ev.details}", "<EventContextBlocks ev={ev} />"]) assert.ok(pop.includes(k), k);
  });
});

describe("Why it could move boxes", () => {
  it("'What would break this setup?' detail text is the main text colour", () => {
    assert.match(src, /color: "var\(--si-text-hi, #e8eef4\)" \}\}>\{iv\[1\]\}<\/span>/);
    assert.doesNotMatch(src, /--si-text-mid, #93a1af\)" \}\}>\{iv\[1\]\}/);
  });
});
