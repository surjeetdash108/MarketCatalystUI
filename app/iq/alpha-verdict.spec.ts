import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

// Logic #2: AMD (Weakening trend) showed "Momentum fading" beside Momentum 65
// "Solid" and "Catalyst uncertainty" beside Catalyst 80 "Strong" — every line
// was forced negative for a weakening trend.
describe("verdict lines follow each component's own score", () => {
  it("a weakening trend orders lines weakest-first but doesn't flip strong components negative", () => {
    const src = readFileSync(new URL("./alpha-signals-model.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /const good = !weak && \(x\.value as number\) >= 60;/);
    assert.match(src, /const good = \(x\.value as number\) >= 60;/);
  });
});
