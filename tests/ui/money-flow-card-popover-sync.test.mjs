// Item 2 & 4: Card and popover must show the same levels, R:R and price at the same moment;
// Pinned popover header must keep updating live with board ticks.
// Run: node --test tests/ui/money-flow-card-popover-sync.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const screenSrc = fs.readFileSync(new URL("../../app/iq/screens/money-flow.tsx", import.meta.url), "utf8");

describe("Money Flow Card and popover synchronization", () => {
  it("popover resolves the active stock from live stockByT instead of holding a frozen snapshot", () => {
    // Verify that money-flow.tsx derives `s` using stockByT so that when the board updates,
    // the popover header, stats, chart and R:R update on the exact same tick as the card.
    assert.match(
      screenSrc,
      /const\s+s\s*=\s*\(?\s*hoveredStock\s*\?\s*stockByT\.get\(hoveredStock\.stock\.t\)\s*:\s*null\s*\)?\s*\?\?\s*hoveredStock(?:\.stock|\?\.stock)/,
      "Popover must resolve `s` from live stockByT to stay synchronized with cards"
    );
  });

  it("cardLevels and popover chart use the same liveLevels calculation and price", async () => {
    const { cardLevels, liveLevels } = await import("../../app/iq/money-flow/engine.ts");
    const stock = {
      t: "CPAY",
      price: 455.85,
      pivots: {
        pivot: 448.97,
        r1: 452.41,
        r2: 455.85,
        r3: 459.29,
        s1: 445.53,
        s2: 442.09,
        s3: 438.65,
      },
      zone: { lo: 450.0, hi: 454.0, startT: 0 },
      rr: 1.4,
    };

    const cLevels = cardLevels(stock);
    const pLevels = liveLevels(stock.pivots, stock.price);

    const cR1 = cLevels.find((l) => l.k === "R1")?.v;
    const pR1 = pLevels.find((l) => l.name === "R1")?.v.toFixed(2);
    assert.equal(cR1, pR1, "Card R1 must equal popover R1 at the same price");

    const cRR = cLevels.find((l) => l.k === "R:R")?.v;
    assert.equal(cRR, "1:1.4", "Card R:R must reflect the stock's current R:R");
  });
});
