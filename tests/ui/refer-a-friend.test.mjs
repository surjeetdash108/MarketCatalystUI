// Refer a friend: the code comes from the server (random, only for members
// with an active plan) — never derived from the uid; the copy says the member
// is credited only once the friend's first payment goes through. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../../app/refer-a-friend/page.tsx", import.meta.url), "utf8");

test("the referral code comes from GET /api/billing/referral, not from the uid", () => {
  assert.match(src, /apiGet<\{ eligible: boolean; code\?: string \}>\("\/api\/billing\/referral"\)/);
  assert.doesNotMatch(src, /uid\.slice|userUid|MC-INVITE25|\}25`/);
});

test("without an active plan there is no code or link, only 'Choose a plan'", () => {
  assert.match(src, /\{ref\.state === "ready" \? \(/);
  assert.match(src, /data-testid="referral-not-eligible"/);
  assert.match(src, /Referral links are for members with an active plan\./);
});

test("both $25 credits are promised only after the friend's first payment", () => {
  assert.match(src, /When a friend signs up with it and their first payment goes through, you each get \$25 account credit/);
  const steps = fs.readFileSync(new URL("../../app/refer-a-friend/referral-steps.tsx", import.meta.url), "utf8");
  assert.match(steps, /after any free trial/);
});
