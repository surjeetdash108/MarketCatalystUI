// Admin → "Didn't finish signing up": two lists from /api/admin/billing/abandoned
// (payment-page drop-offs with plan, attempts and times; sign-ups that never chose
// a plan), and the subscriber detail shows the same plan-history timeline the
// customer sees. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../../app/admin/billing/admin-billing.tsx", import.meta.url), "utf8");

test("admin lists payment-page drop-offs and sign-ups without a plan, with timestamps", () => {
  assert.match(src, /data-testid="tab-abandoned">Didn&apos;t finish signing up</);
  assert.match(src, /setDropOffs\(r\.checkoutAbandoned \?\? \[\]\)/);
  assert.match(src, /setNoPlan\(r\.signedUpNoPlan \?\? \[\]\)/);
  for (const h of ["First attempt", "Last attempt", "Attempts", "Signed up", "Intro ends"]) assert.ok(src.includes(`>${h}</th>`), h);
  assert.doesNotMatch(src, /Fallback demo leads|Anonymous Lead/);
});

test("admin subscriber detail shows the plan-history timeline", () => {
  assert.match(src, /data-testid="admin-timeline"/);
  assert.match(src, /detail\.timeline \?\? \[\]/);
});
