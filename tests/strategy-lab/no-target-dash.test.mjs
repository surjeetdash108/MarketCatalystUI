// The row pop-up's STOP / TARGET levels read "—" when none is set (was "Not set").
// Run: node --test tests/strategy-lab/
import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const ctl = fs.readFileSync(new URL("../../app/iq/sl/lab-controller.jsx", import.meta.url), "utf8");
it("no stop / target → a dash", () => {
  assert.doesNotMatch(ctl, /Not set/);
  assert.match(ctl, /v: vv \?\? "—"/);
});
