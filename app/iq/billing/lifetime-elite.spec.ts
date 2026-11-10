import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLifetimeElite, LIFETIME_ELITE_EMAILS } from "./lifetime-elite";
import { hasConfirmedPaidPlan } from "../plan-status";

describe("lifetime-elite allowlist", () => {
  it("recognises all 13 configured emails case-insensitively and trimmed", () => {
    assert.equal(LIFETIME_ELITE_EMAILS.length, 13);
    for (const email of LIFETIME_ELITE_EMAILS) {
      assert.equal(isLifetimeElite(email), true);
      assert.equal(isLifetimeElite(email.toUpperCase()), true);
      assert.equal(isLifetimeElite(`  ${email}  `), true);
    }
  });

  it("hasConfirmedPaidPlan returns true for lifetime elite emails", () => {
    for (const email of LIFETIME_ELITE_EMAILS) {
      assert.equal(hasConfirmedPaidPlan(null, Date.now(), email), true);
      assert.equal(hasConfirmedPaidPlan({ currentPlan: "free", subscriptionStatus: "NONE" }, Date.now(), email), true);
    }
  });

  it("rejects unlisted emails", () => {
    assert.equal(isLifetimeElite("random@example.com"), false);
    assert.equal(isLifetimeElite(""), false);
    assert.equal(isLifetimeElite(null), false);
    assert.equal(isLifetimeElite(undefined), false);
  });
});
