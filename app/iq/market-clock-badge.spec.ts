import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

// Logic #7: Alpha Signals had no date/time or market-open badge (Money Flow does).
describe("Alpha Signals header shows the ET clock and session badge", () => {
  it("the module header renders MarketClockBadge", () => {
    const src = readFileSync(new URL("./screens/alpha-signals-module.tsx", import.meta.url), "utf8");
    assert.match(src, /<MarketClockBadge \/>/);
  });
});
