// The results header and rules box carry no data-source / scan-count line and no cost text.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

describe("results header: no data-source or cost text", () => {
  const ctl = fs.readFileSync(new URL("../../app/iq/sl/lab-controller.jsx", import.meta.url), "utf8");
  it("no '5Y daily · FMP · scanning…' / '· as of … tested · insufficient history' line", () => {
    assert.doesNotMatch(ctl, /FMP · scanning/);
    assert.doesNotMatch(ctl, /insufficient history` : ""\)/);
  });
  it("no 'costs 5 bps' in the rules box or the report subtitle", () => assert.doesNotMatch(ctl, /" · costs "/));
});
