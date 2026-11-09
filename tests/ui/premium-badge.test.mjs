// The Premium badge must come from a confirmed paid plan, not `tier !== "free"`
// (true when the profile is null or has no tier). Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
describe("Premium badge source", () => {
  for (const f of ["app/iq/screens/manage-plan-soon.tsx", "app/iq/screens/settings.tsx"]) {
    it(`${f} derives isPremium from hasConfirmedPaidPlan`, () => {
      const s = read(f);
      assert.doesNotMatch(s, /tier\s*!==\s*"free"/);
      assert.match(s, /isPremium\s*=\s*hasConfirmedPaidPlan\(/);
    });
  }
});
