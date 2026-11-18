import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { cls, sign } from "./utils";
import { SCREENS } from "./alpha-signals-model";
import type { CompanyDoc } from "./types";

// Error 33 / Logic #7: "▼ 0.00%" (QRED) and "5-day move only −0.0%" (ED).
describe("a move that rounds to zero is unchanged", () => {
  it("colour follows the rounded figure: −0.001% is flat, like the 0.00% it prints", () => {
    assert.equal(sign(-0.001), "0.00%");
    assert.equal(cls(-0.001), "flat");
    assert.equal(cls(-0.006), "down");
    assert.equal(cls(0.004), "flat");
  });
  it("the list arrow follows the rounded figure too", () => {
    const src = readFileSync(new URL("./screens/alpha-signals.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(src, /r\.pct > 0 \? "▲ " : r\.pct < 0 \? "▼ "/);
  });
  it("screen text never prints −0.0%", () => {
    const c = { ticker: "ED", name: "ED", price: 100, pctChange: 0, aboveSma50: true, aboveSma200: true, pctFromHigh52: -2, high52: 102, week5ChangePct: -0.04 } as CompanyDoc;
    const [r] = SCREENS.find(s => s.id === "tight")!.rows({ companies: [c], sigs: [], analyst: new Map(), ipos: [], now: 0 });
    assert.match(r.why, /5-day move only 0\.0%/);
  });
});
