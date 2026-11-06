// Item 8: Chart loading: prefetch the 5m chart for visible tiles so the popover chart
// appears with the header; Full Chart must not shift the popover or clip the Open-in buttons.
// Run: node --test tests/ui/money-flow-chart-loading-stability.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const screenSrc = fs.readFileSync(new URL("../../app/iq/screens/money-flow.tsx", import.meta.url), "utf8");

describe("Item 8: Chart loading prefetch and Full Chart layout stability", () => {
  it("popCandles immediately falls back to boardCandles for 5m so popover chart appears with header", () => {
    assert.match(
      screenSrc,
      /boardCandles/,
      "popCandles must use boardCandles fallback for 5m so chart appears immediately"
    );
  });

  it("prefetches visible tile bars in background", () => {
    assert.match(
      screenSrc,
      /fetch\s*\(\s*`\/live\/bars\?ticker=\${encodeURIComponent\((?:s|sym|t)\)}&interval=1m`\s*\)/,
      "Screen must prefetch visible tile bars"
    );
  });

  it("PopFullChart height matches POPOVER.chartH so switching charts does not shift the popover", () => {
    assert.match(
      screenSrc,
      /<PopFullChart[^>]+height=\{POPOVER\.chartH\}/,
      "PopFullChart must have height={POPOVER.chartH} to avoid shifting popover"
    );
    assert.doesNotMatch(
      screenSrc,
      /POPOVER\.chartH\s*-\s*44/,
      "PopFullChart must not subtract 44px which shifts popover"
    );
  });

  it("popover container allows scrolling to prevent clipping Open-in buttons", () => {
    assert.match(
      screenSrc,
      /overflowY:\s*"auto"/,
      "Popover container must have overflowY: 'auto' so Open-in buttons are not clipped"
    );
  });
});
