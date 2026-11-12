// Lifetime Elite was removed (2026-11-13): those accounts are staff now. No
// email list grants a plan in the app. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("the Lifetime Elite list and every use of it are gone", () => {
  assert.equal(fs.existsSync(new URL("../../app/iq/billing/lifetime-elite.ts", import.meta.url)), false);
  for (const f of ["app/iq/plan-status.ts", "app/iq/screens/settings.tsx", "app/iq/screens/manage-plan.tsx"]) {
    const s = read(f);
    assert.doesNotMatch(s, /isLifetimeElite|Lifetime Elite|"lifetime"/, f);
  }
});
