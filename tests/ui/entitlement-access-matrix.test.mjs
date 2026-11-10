import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SCREEN_FEATURES,
  WIDGET_FEATURES,
  LOWEST_PLAN,
  PLAN_GROUPS,
  FEATURE_GROUP_OF,
} from "../../app/iq/feature-map.generated.js";
import { gateDecisionFor } from "../../app/iq/hooks/useEntitlements.js";
import { ENTITLEMENTS } from "../../app/admin/entitlement-catalog.js";

function makeEntitlements({ planId, staff = false, subscriptionsEnabled = true }) {
  const isNone = planId === "none";
  const allowedGroups = isNone ? [] : PLAN_GROUPS[planId] ?? [];
  const entitlements = {};
  const requiredPlan = {};

  for (const e of ENTITLEMENTS) {
    const group = FEATURE_GROUP_OF[e.key];
    const allowed = staff || (group && allowedGroups.includes(group));
    entitlements[e.key] = !!allowed;
    requiredPlan[e.key] = LOWEST_PLAN[e.key] ?? null;
  }

  return {
    subscriptionsEnabled,
    staff,
    paidPlansAvailable: true,
    provider: "fake",
    planId,
    planName: planId,
    status: isNone ? "NONE" : "ACTIVE",
    interval: isNone ? null : "annual",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    inGrace: false,
    graceEndsAt: null,
    entitlements,
    requiredPlan,
    hidden: [],
    limits: { watchlistTickers: null },
  };
}

describe("Entitlements Access Matrix & Contract Test", () => {
  it("Contract: every screen and widget maps to a known catalog entitlement", () => {
    const known = new Set(ENTITLEMENTS.map((e) => e.key));
    for (const [slug, key] of Object.entries(SCREEN_FEATURES)) {
      assert.ok(known.has(key), `Screen '${slug}' maps to unknown key '${key}'`);
    }
    for (const [widget, key] of Object.entries(WIDGET_FEATURES)) {
      assert.ok(known.has(key), `Widget '${widget}' maps to unknown key '${key}'`);
    }
  });

  it("Contract: lowest plan mapping aligns with plan groups tiering", () => {
    for (const [feature, plan] of Object.entries(LOWEST_PLAN)) {
      const group = FEATURE_GROUP_OF[feature];
      assert.ok(group, `Feature '${feature}' has no feature group`);
      assert.ok(
        PLAN_GROUPS[plan].includes(group),
        `Plan '${plan}' must include group '${group}' for feature '${feature}'`,
      );
    }
  });

  describe("Access matrix when SUBSCRIPTIONS_ENABLED is OFF", () => {
    const plans = ["none", "starter", "pro", "elite"];
    for (const planId of plans) {
      it(`Plan '${planId}' has full access to every screen and widget when flag is off`, () => {
        const ent = makeEntitlements({ planId, subscriptionsEnabled: false });
        for (const key of Object.values(SCREEN_FEATURES)) {
          const decision = gateDecisionFor(ent, key);
          assert.equal(decision.kind, "allow", `Screen key ${key} should allow when flag off`);
        }
        for (const key of Object.values(WIDGET_FEATURES)) {
          const decision = gateDecisionFor(ent, key);
          assert.equal(decision.kind, "allow", `Widget key ${key} should allow when flag off`);
        }
      });
    }
  });

  describe("Access matrix when SUBSCRIPTIONS_ENABLED is ON", () => {
    it("Staff has access to every screen and widget", () => {
      const ent = makeEntitlements({ planId: "none", staff: true, subscriptionsEnabled: true });
      for (const key of Object.values(SCREEN_FEATURES)) {
        assert.equal(gateDecisionFor(ent, key).kind, "allow");
      }
      for (const key of Object.values(WIDGET_FEATURES)) {
        assert.equal(gateDecisionFor(ent, key).kind, "allow");
      }
    });

    it("Starter plan: Market Desk & Stock Intelligence allowed; Money Flow & Strategy Lab locked", () => {
      const ent = makeEntitlements({ planId: "starter", subscriptionsEnabled: true });
      // Market Desk screens:
      assert.equal(gateDecisionFor(ent, SCREEN_FEATURES["dashboard"]).kind, "allow");
      assert.equal(gateDecisionFor(ent, SCREEN_FEATURES["movers"]).kind, "allow");
      assert.equal(gateDecisionFor(ent, SCREEN_FEATURES["earnings"]).kind, "allow");
      // Stock Intelligence screens:
      assert.equal(gateDecisionFor(ent, SCREEN_FEATURES["stock"]).kind, "allow");
      assert.equal(gateDecisionFor(ent, SCREEN_FEATURES["si"]).kind, "allow");
      // Money Flow (Pro):
      const mfDecision = gateDecisionFor(ent, SCREEN_FEATURES["money-flow"]);
      assert.equal(mfDecision.kind, "locked");
      assert.equal(mfDecision.requiredPlan, "pro");
      // Strategy Lab (Elite):
      const slDecision = gateDecisionFor(ent, SCREEN_FEATURES["sl"]);
      assert.equal(slDecision.kind, "locked");
      assert.equal(slDecision.requiredPlan, "elite");
    });

    it("Pro plan: Money Flow allowed; Strategy Lab locked", () => {
      const ent = makeEntitlements({ planId: "pro", subscriptionsEnabled: true });
      assert.equal(gateDecisionFor(ent, SCREEN_FEATURES["dashboard"]).kind, "allow");
      assert.equal(gateDecisionFor(ent, SCREEN_FEATURES["stock"]).kind, "allow");
      assert.equal(gateDecisionFor(ent, SCREEN_FEATURES["money-flow"]).kind, "allow");
      const slDecision = gateDecisionFor(ent, SCREEN_FEATURES["sl"]);
      assert.equal(slDecision.kind, "locked");
      assert.equal(slDecision.requiredPlan, "elite");
    });

    it("Elite plan: Strategy Lab, Money Flow and all other features allowed", () => {
      const ent = makeEntitlements({ planId: "elite", subscriptionsEnabled: true });
      for (const key of Object.values(SCREEN_FEATURES)) {
        assert.equal(gateDecisionFor(ent, key).kind, "allow");
      }
      for (const key of Object.values(WIDGET_FEATURES)) {
        assert.equal(gateDecisionFor(ent, key).kind, "allow");
      }
    });
  });
});

