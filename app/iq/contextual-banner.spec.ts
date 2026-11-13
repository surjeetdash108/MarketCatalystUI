import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bannerKind } from "./contextual-banner";
import type { Entitlements } from "./hooks/useEntitlements";

const ent = (over: Partial<Entitlements>): Entitlements => ({
  subscriptionsEnabled: true, paidPlansAvailable: true, provider: "stripe",
  planId: "elite", planName: "Elite", status: "ACTIVE", interval: "annual", cancelAtPeriodEnd: false,
  currentPeriodEnd: "2027-11-11T00:00:00Z", inGrace: false, graceEndsAt: null,
  entitlements: {}, requiredPlan: {}, hidden: [], limits: { watchlistTickers: null },
  ...over,
} as Entitlements);

describe("top banner is for trials only", () => {
  it("a paying member who cancelled sees no 'plan ends on' banner", () => {
    assert.equal(bannerKind(ent({ status: "ACTIVE", cancelAtPeriodEnd: true })), null);
  });
  it("an active paid plan shows no banner", () => {
    assert.equal(bannerKind(ent({})), null);
  });
  it("a trial shows the trial banner; a cancelled trial shows when it ends", () => {
    assert.equal(bannerKind(ent({ status: "TRIALING" })), "trial");
    assert.equal(bannerKind(ent({ status: "TRIALING", cancelAtPeriodEnd: true })), "trial-canceling");
  });
  it("intro and ended-intro banners are unchanged; staff see none", () => {
    assert.equal(bannerKind(ent({ status: "INTRO", introEndsAt: "2026-11-20T00:00:00Z" } as Partial<Entitlements>)), "intro");
    assert.equal(bannerKind(ent({ status: "EXPIRED" })), "expired-intro");
    assert.equal(bannerKind(ent({ status: "TRIALING", staff: true } as Partial<Entitlements>)), null);
  });
});
