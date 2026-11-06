// A ticker with no logo shows its first letter (StockLogo / useTickerLogo),
// never an empty white tile. Money Flow loaded FMP's image URL directly and
// Strategy Lab showed up to four letters behind its image.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(new URL("../../app/" + f, import.meta.url), "utf8");
const mf = read("iq/screens/money-flow.tsx"), sl = read("iq/sl/lab-panels.jsx"), utils = read("iq/utils.tsx");

describe("missing logo → first letter of the ticker", () => {
  it("StockLogo draws the ticker's first letter until (unless) the logo paints", () => {
    assert.match(utils, /\{!loaded && \(s\[0\] \?\? ""\)\}/);
  });
  it("Money Flow: every logo is a StockLogo, none a raw FMP image", () => {
    assert.doesNotMatch(mf, /image-stock/);
    assert.equal((mf.match(/<StockLogo /g) || []).length, 5);
  });
  it("Strategy Lab results rows: StockLogo instead of a hidden-on-error image over the ticker text", () => {
    assert.match(sl, /<StockLogo sym=\{x\.t\}/);
    assert.doesNotMatch(sl, /x\.t\.slice\(0, 4\)/);
    assert.doesNotMatch(sl, /onError=\{hideImg\}/);
  });
});
