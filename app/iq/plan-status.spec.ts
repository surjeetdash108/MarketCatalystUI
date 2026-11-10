import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasConfirmedPaidPlan } from "./plan-status";

const NOW = Date.parse("2026-11-09T12:00:00Z");

describe("hasConfirmedPaidPlan", () => {
  it("is false while the profile has not loaded, or failed to load", () => {
    assert.equal(hasConfirmedPaidPlan(null, NOW), false);
    assert.equal(hasConfirmedPaidPlan(undefined, NOW), false);
  });
  it("is false for a profile with no plan fields at all (the old isPremium said true)", () => {
    assert.equal(hasConfirmedPaidPlan({}, NOW), false);
    assert.equal(hasConfirmedPaidPlan({ name: "x" } as never, NOW), false);
  });
  it("ignores the legacy tier field: tier alone never confirms a paid plan", () => {
    assert.equal(hasConfirmedPaidPlan({ tier: "pro" }, NOW), false);
    assert.equal(hasConfirmedPaidPlan({ tier: "premium", currentPlan: "free", subscriptionStatus: "ACTIVE" }, NOW), false);
  });
  it("is true for a paid plan with an active or trialing subscription", () => {
    assert.equal(hasConfirmedPaidPlan({ currentPlan: "pro", subscriptionStatus: "ACTIVE" }, NOW), true);
    assert.equal(hasConfirmedPaidPlan({ currentPlan: "elite", subscriptionStatus: "TRIALING", subscriptionExpiryDate: "2026-12-09" }, NOW), true);
  });
  it("is false for none/free/unrecognized plan, or any non-live status", () => {
    assert.equal(hasConfirmedPaidPlan({ currentPlan: "free", subscriptionStatus: "ACTIVE" }, NOW), false);
    for (const s of ["NONE", "EXPIRED", "CANCELLED", "PAST_DUE", "", undefined]) {
      assert.equal(hasConfirmedPaidPlan({ currentPlan: "pro", subscriptionStatus: s as never }, NOW), false, String(s));
    }
  });
  it("is false once the expiry date has passed, even if the stored status still says ACTIVE", () => {
    assert.equal(hasConfirmedPaidPlan({ currentPlan: "pro", subscriptionStatus: "ACTIVE", subscriptionExpiryDate: "2026-11-08" }, NOW), false);
    assert.equal(hasConfirmedPaidPlan({ currentPlan: "pro", subscriptionStatus: "ACTIVE", subscriptionExpiryDate: "2026-11-09" }, NOW), true, "a date-only expiry lasts to the end of that day (UTC), like the backend");
    assert.equal(hasConfirmedPaidPlan({ currentPlan: "pro", subscriptionStatus: "ACTIVE", subscriptionExpiryDate: "not-a-date" }, NOW), false);
  });
});
