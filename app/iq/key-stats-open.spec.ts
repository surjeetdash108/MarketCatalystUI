import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

// Error 29 (AAPL): Key statistics Open $351.94 (quote overlay) vs the chart's
// OHLC readout O 351.87 at the same moment.
describe("Key statistics Open matches the chart's OHLC", () => {
  it("uses the session's daily bar open when it is in", () => {
    const src = readFileSync(new URL("./screens/stock.tsx", import.meta.url), "utf8");
    assert.match(src, /\{ o: lastBar\?\.o \?\? \(sessOpen as number\), h: sessHigh as number, l: sessLow as number \}/);
  });
});
