// Analyst Actions: a call with no price target (pt1 0 / null) shows "—", never
// "$0.00", and the "Where this target sits" slider has no $0 pin.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/screens/analyst.tsx", import.meta.url), "utf8");

describe("missing analyst target → —", () => {
  it("fmtTarget treats a non-positive target as missing", () => {
    const body = src.match(/function fmtTarget\(v: number \| null \| undefined\): string \{([\s\S]*?)\n\}/);
    assert.ok(body, "fmtTarget");
    const fmtTarget = new Function("v", body[1].replace(/: number/g, ""));
    assert.equal(fmtTarget(0), "—");
    assert.equal(fmtTarget(null), "—");
    assert.equal(fmtTarget(NaN), "—");
    assert.equal(fmtTarget(156.5), "$156.50");
  });
  it("no price target is formatted with the plain money formatter", () => {
    assert.doesNotMatch(src, /fmtMoney\([^)]*pt1\)/);
    assert.doesNotMatch(src, /fmtMoneyCompact\([^)]*pt1\)/);
    assert.doesNotMatch(src, /\$\{r\.pt1\.toFixed\(2\)\}/);
  });
  it("the slider leaves a missing target out of its range and draws no target pin", () => {
    assert.match(src, /const vals = \[\.\.\.selectedStock\.street, \.\.\.\(hasTarget\(selectedStock\.pt1\) \? \[selectedStock\.pt1\] : \[\]\), selectedStock\.px\];/);
    assert.match(src, /\{hasTarget\(selectedStock\.pt1\) && \(\s*<>\s*\{\/\* New Target Pin \*\/\}/);
  });
});

describe("a zero consensus target is no target elsewhere too", () => {
  const stock = fs.readFileSync(new URL("../../app/iq/screens/stock.tsx", import.meta.url), "utf8");
  const earnings = fs.readFileSync(new URL("../../app/iq/screens/earnings.tsx", import.meta.url), "utf8");
  it("stock page: Target and Range show only for a positive target", () => {
    assert.equal((stock.match(/consensusDoc\.priceTargetConsensus != null && consensusDoc\.priceTargetConsensus > 0 &&/g) || []).length, 2);
    assert.equal((stock.match(/consensusDoc\.priceTargetLow != null && consensusDoc\.priceTargetLow > 0 &&/g) || []).length, 2);
  });
  it("Earnings Hub: a 0 consensus is treated as no price target", () => {
    assert.equal((earnings.match(/const pt = c\?\.priceTargetConsensus != null && c\.priceTargetConsensus > 0 \? c\.priceTargetConsensus : null;/g) || []).length, 2);
  });
});
