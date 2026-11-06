// Item 3: Stop R:R flip-flopping when price sits on a level:
// renumber levels only once price is beyond the level by a small buffer (0.05% or 1 tick)
// and hasn't crossed back within the last minute. Document the rule in the glossary.
// Run: node --test tests/ui/money-flow-level-buffer.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const screenSrc = fs.readFileSync(new URL("../../app/iq/screens/money-flow.tsx", import.meta.url), "utf8");

describe("Item 3: Anti-flip-flop Level Renumbering Buffer", () => {
  it("glossary documents the buffer and 1-minute anti-flip-flop rule for R/S levels", () => {
    assert.match(
      screenSrc,
      /To prevent levels and R:R flip-flopping when price sits on a level.*buffer.*hasn't crossed back within the last minute/s,
      "Glossary must explain level buffer and 1-minute stabilization rule"
    );
  });

  it("does not renumber levels when price is within the 0.05% buffer of a level", async () => {
    const { liveLevels } = await import("../../app/iq/money-flow/engine.ts");
    const pv = { pivot: 100, r1: 102, s1: 98, r2: 104, s2: 96, r3: 106, s3: 94 };

    // At 102.02, price is above 102 but within the 0.05% buffer (102 * 0.0005 = 0.051 => threshold 102.051).
    // R1 must still be 102, NOT jump to 104.
    const lWithin = liveLevels(pv, 102.02);
    const r1 = lWithin.find((l) => l.name === "R1");
    assert.equal(r1?.v, 102, "R1 must remain 102 while price sits within buffer");
    assert.equal(r1?.from, "R1");
  });

  it("does not renumber levels if price crossed back within the last minute", async () => {
    const { liveLevels } = await import("../../app/iq/money-flow/engine.ts");
    const pv = { pivot: 100, r1: 102, s1: 98, r2: 104, s2: 96, r3: 106, s3: 94 };

    const now = 1730000000000;
    // Price at 102.10 is past buffer, but within the last minute the low dropped to 101.90 (crossed back)
    const barsCrossingBack = [
      { t: now - 30_000, o: 102.15, h: 102.20, l: 101.90, c: 102.10 },
      { t: now, o: 102.10, h: 102.15, l: 102.05, c: 102.10 },
    ];
    const lCrossedBack = liveLevels(pv, 102.10, barsCrossingBack);
    const r1 = lCrossedBack.find((l) => l.name === "R1");
    assert.equal(r1?.v, 102, "R1 must remain 102 because price crossed back within last minute");
  });

  it("renumbers levels once price is beyond buffer AND has not crossed back within last minute", async () => {
    const { liveLevels } = await import("../../app/iq/money-flow/engine.ts");
    const pv = { pivot: 100, r1: 102, s1: 98, r2: 104, s2: 96, r3: 106, s3: 94 };

    const now = 1730000000000;
    // Price at 102.20 is past buffer, and all bars in the last minute stayed above 102
    const barsClean = [
      { t: now - 30_000, o: 102.10, h: 102.20, l: 102.08, c: 102.15 },
      { t: now, o: 102.15, h: 102.25, l: 102.10, c: 102.20 },
    ];
    const lCleared = liveLevels(pv, 102.20, barsClean);
    const r1 = lCleared.find((l) => l.name === "R1");
    assert.equal(r1?.v, 104, "R1 must advance to 104 once level 102 is cleanly cleared");
    assert.equal(r1?.from, "R2");
  });
});
