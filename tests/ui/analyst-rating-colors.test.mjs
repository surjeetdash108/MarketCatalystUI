// Analyst Actions: a rating reads in its colour — buy-type green, sell-type
// red, hold-type amber — in the RATING box and both Rating columns.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/screens/analyst.tsx", import.meta.url), "utf8");
const body = src.match(/function ratingColor\(rating: string \| null \| undefined\): string \{([\s\S]*?)\n\}/);
const ratingColor = body && new Function("G", "R", "AMBER", "TEXT_HI", "rating", body[1]).bind(null, "G", "R", "AMBER", "TEXT_HI");

describe("rating colours", () => {
  it("buy-type ratings are green", () => {
    for (const r of ["Buy", "Strong Buy", "Outperform", "Overweight", "Positive", "Accumulate", "Market Outperform", "Sector Outperform", "Top Pick"]) assert.equal(ratingColor(r), "G", r);
  });
  it("sell-type ratings are red", () => {
    for (const r of ["Sell", "Strong Sell", "Underperform", "Underweight", "Negative", "Reduce", "Market Underperform", "Sector Underperform"]) assert.equal(ratingColor(r), "R", r);
  });
  it("hold-type ratings are amber", () => {
    for (const r of ["Hold", "Neutral", "Equal-Weight", "Market Perform", "Sector Perform", "Peer Perform", "In-Line", "Sector Weight"]) assert.equal(ratingColor(r), "AMBER", r);
  });
  it("unknown / missing stays the normal text colour", () => {
    assert.equal(ratingColor(""), "TEXT_HI");
    assert.equal(ratingColor(null), "TEXT_HI");
    assert.equal(ratingColor("—"), "TEXT_HI");
  });
  it("used in the RATING box and both tables' rating columns", () => {
    assert.match(src, /color: ratingColor\(selectedStock\.to\) \}\}>\{selectedStock\.to\}/);
    assert.ok((src.match(/<b style=\{\{ color: ratingColor\(r\.to\) \}\}>\{r\.to\}<\/b>/g) || []).length >= 3);
  });
});
