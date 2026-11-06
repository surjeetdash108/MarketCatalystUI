// PICK rule (approved): a setup is PICK only if R:R >= 1; if it otherwise qualifies but R:R < 1, it's WATCH.
// Run: node --test tests/ui/money-flow-pick-rule.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const engineSrc = fs.readFileSync(new URL("../../app/iq/money-flow/engine.ts", import.meta.url), "utf8");
const screenSrc = fs.readFileSync(new URL("../../app/iq/screens/money-flow.tsx", import.meta.url), "utf8");

describe("Money Flow PICK rule: R:R >= 1 requirement", () => {
  it("engine rule logic marks R:R < 1 as WATCH", async () => {
    // Dynamic import to test engine's popoverStats
    const { popoverStats } = await import("../../app/iq/money-flow/engine.ts");
    const mockBoard = {
      gainers: [
        {
          t: "APP",
          name: "AppLovin",
          price: 353.19,
          prevClose: 340.0,
          pctChange: 3.88,
          entry: 353.19,
          stop: 348.37,
          target: 354.72,
          rr: 0.3, // 1:0.3
          chop: false,
          pivots: null,
          zone: { lo: 348.37, hi: 353.19, startT: 0 },
        },
        {
          t: "CPAY",
          name: "Corpay",
          price: 450.69,
          prevClose: 440.0,
          pctChange: 2.43,
          entry: 450.69,
          stop: 454.39,
          target: 452.41,
          rr: 0.5, // 1:0.5
          chop: false,
          pivots: null,
          zone: { lo: 450.69, hi: 454.39, startT: 0 },
        },
        {
          t: "GOOD",
          name: "Good Stock",
          price: 100.0,
          prevClose: 95.0,
          pctChange: 5.26,
          entry: 100.5, // 0.5% away
          stop: 98.0,
          target: 105.0,
          rr: 1.8, // 1:1.8 >= 1
          chop: false,
          pivots: null,
          zone: { lo: 98.0, hi: 100.5, startT: 0 },
        },
      ],
      losers: [
        {
          t: "BR",
          name: "Broadridge",
          price: 198.0,
          prevClose: 205.0,
          pctChange: -3.41,
          entry: 198.0,
          stop: 200.0,
          target: 193.7,
          rr: 0.6, // 1:0.6
          chop: false,
          pivots: null,
          zone: { lo: 198.0, hi: 200.0, startT: 0 },
        },
      ],
    };

    const getRule = (stats) => stats.find((s) => s.k === "Rule")?.v;

    // APP (1:0.3) -> WATCH
    assert.match(getRule(popoverStats(mockBoard.gainers[0], mockBoard)), /^WATCH · BULLISH/);

    // CPAY (1:0.5) -> WATCH
    assert.match(getRule(popoverStats(mockBoard.gainers[1], mockBoard)), /^WATCH · BULLISH/);

    // BR (1:0.6) -> WATCH
    assert.match(getRule(popoverStats(mockBoard.losers[0], mockBoard)), /^WATCH · BEARISH/);

    // GOOD (1:1.8) -> PICK
    assert.match(getRule(popoverStats(mockBoard.gainers[2], mockBoard)), /^PICK · BULLISH/);
  });

  it("glossary defines PICK rule requiring R:R >= 1 and WATCH for R:R < 1", () => {
    const ruleSection = screenSrc.slice(screenSrc.indexOf('term: "Rule"'), screenSrc.indexOf("};", screenSrc.indexOf('term: "Rule"')));
    assert.match(ruleSection, /R:R\s*(≥|>=)\s*1/);
    assert.match(ruleSection, /WATCH/);
  });
});
