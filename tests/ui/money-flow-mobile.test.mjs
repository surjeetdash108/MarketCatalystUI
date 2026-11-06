// Money Flow on a phone / tablet: the top-3 cards show (their column collapsed
// to nothing), and the header's clock / market status / theme switch fit.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const mf = fs.readFileSync(new URL("../../app/iq/screens/money-flow.tsx", import.meta.url), "utf8");

describe("Money Flow on a phone / tablet", () => {
  const block = (q) => mf.slice(mf.indexOf(q), mf.indexOf("@media", mf.indexOf(q) + 10) > 0 ? mf.indexOf("@media", mf.indexOf(q) + 10) : undefined);
  for (const q of ["@media (min-width: 768px) and (max-width: 1199px)", "@media (max-width: 767px)"]) {
    it(`${q}: the top-3 cards column sizes to its cards (it collapsed to nothing)`, () => {
      const b = block(q);
      assert.match(b, /\.mf-mid-cards-col \{[^}]*flex: none !important;[^}]*overflow: visible !important;/);
      assert.match(b, /\.mf-mid-card \{[^}]*height: \d+px !important;/);
    });
  }
  it("phone header: clock, market status and the theme switch get their own row", () => {
    assert.match(block("@media (max-width: 767px)"), /\.mf-nav-status \{[^}]*width: 100% !important;/);
  });
});
