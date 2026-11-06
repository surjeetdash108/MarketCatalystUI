// The global module toggle shows "Strategy Lab" with no "NEW" badge beside it.
// Run: node --test tests/ui/
import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/module-switcher.tsx", import.meta.url), "utf8");
it("no NEW badge in the module switcher", () => {
  assert.doesNotMatch(src, />\s*NEW\s*</);
  assert.doesNotMatch(src, /isNew/);
});
