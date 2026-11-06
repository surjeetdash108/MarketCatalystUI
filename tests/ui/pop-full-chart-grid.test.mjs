// Money Flow pop-up "Full Chart": no solid horizontal gridlines, only the price
// numbers on the right axis. The stock screen's chart keeps its gridlines.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cc = fs.readFileSync(new URL("../../app/iq/candle-chart.tsx", import.meta.url), "utf8");
const axis = cc.slice(cc.indexOf("// ── grid + right axis ──"), cc.indexOf("ctx.save();", cc.indexOf("// ── grid + right axis ──")));

describe("pop-up Full Chart has no gridlines", () => {
  it("a gridline is stroked only outside Money Flow mode (m.smc null)", () => {
    assert.match(axis, /if \(m\.smc == null\) \{ ctx\.strokeStyle = pal\.grid; ctx\.beginPath\(\); ctx\.moveTo\(g\.l, y\); ctx\.lineTo\(g\.r, y\); ctx\.stroke\(\); \}/);
  });
  it("the price numbers are still written for every tick", () => {
    assert.match(axis, /for \(const p of ticks\) \{[\s\S]*ctx\.fillText\(money\(p\), g\.r \+ 9, y\);/);
  });
});
