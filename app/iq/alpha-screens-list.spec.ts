import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { SCREENS } from "./alpha-signals-model";

// Logic #7: High Short Interest was one of 13 screens but only an empty
// "Awaiting live data" state — no universe-wide short-interest feed exists.
describe("Stock Screens lists only screens with data", () => {
  it("a pending screen is not listed", () => {
    assert.ok(SCREENS.some(s => s.id === "si" && s.pending));
    const src = readFileSync(new URL("./screens/alpha-signals.tsx", import.meta.url), "utf8");
    assert.match(src, /const LIVE_SCREENS = SCREENS\.filter\(s => !s\.pending\);/);
    assert.match(src, /\{LIVE_SCREENS\.map\(s => \{/);
    assert.doesNotMatch(src, /\{SCREENS\.map\(s => \{/);
  });
});
