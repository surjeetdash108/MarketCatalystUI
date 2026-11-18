import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { holdOrder } from "./hold-order";

// Logic #5: the strip re-ranked under the pointer, so a click meant for AI
// landed on HMY and the "n / 10" pager stepped through a reshuffled list.
describe("Top Picks hold their order while you're using them", () => {
  const k = (s: { t: string }) => s.t;
  it("not held: the live ranking", () => {
    assert.deepEqual(holdOrder(null, [{ t: "B" }, { t: "A" }], k).map(k), ["B", "A"]);
  });
  it("held: the order seen when the hold began; dropped names go, new names join at the end", () => {
    const seen = ["AMR", "AI", "HMY"];
    const now = [{ t: "AI" }, { t: "HMY" }, { t: "BCC" }, { t: "AMR" }];
    assert.deepEqual(holdOrder(seen, now, k).map(k), ["AMR", "AI", "HMY", "BCC"]);
    assert.deepEqual(holdOrder(seen, [{ t: "HMY" }, { t: "AI" }], k).map(k), ["AI", "HMY"]);
  });
  it("the screen holds the strip while the pointer is on it or a pick is open, and shows when it last updated", () => {
    const src = readFileSync(new URL("./screens/alpha-signals.tsx", import.meta.url), "utf8");
    assert.match(src, /const held = hovering \|\| pickSym != null/);
    assert.match(src, /onPointerEnter=\{\(\) => \{ setHovering\(true\)/);
    assert.match(src, /data-testid="picks-updated"/);
  });
});
