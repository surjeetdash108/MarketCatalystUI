import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessModule } from "./module-switcher";
import type { Entitlements } from "./hooks/useEntitlements";

const ent = (planId: string, status: string, open: Record<string, boolean>): Entitlements => ({
  subscriptionsEnabled: true, paidPlansAvailable: true, provider: "stripe",
  planId, planName: planId, status, interval: null, cancelAtPeriodEnd: false,
  currentPeriodEnd: null, inGrace: false, graceEndsAt: null,
  entitlements: open, requiredPlan: { moneyFlow: "pro", strategyLab: "elite" }, hidden: [],
  limits: { watchlistTickers: null },
});

describe("ModuleSwitcher access follows entitlements, not the plan name", () => {
  it("new-account intro opens Money Flow but not Strategy Lab", () => {
    const e = ent("intro", "INTRO", { marketDesk: true, stockIntelligence: true, moneyFlow: true, strategyLab: false });
    assert.equal(canAccessModule("MC", e), true);
    assert.equal(canAccessModule("SI", e), true);
    assert.equal(canAccessModule("MF", e), true);
    assert.equal(canAccessModule("SL", e), false);
  });
  it("Starter: Market Catalyst and Stock Intelligence only", () => {
    const e = ent("starter", "ACTIVE", { moneyFlow: false, strategyLab: false });
    assert.equal(canAccessModule("MF", e), false);
    assert.equal(canAccessModule("SL", e), false);
  });
  it("Pro opens Money Flow; Elite opens both", () => {
    assert.equal(canAccessModule("MF", ent("pro", "ACTIVE", { moneyFlow: true, strategyLab: false })), true);
    assert.equal(canAccessModule("SL", ent("pro", "ACTIVE", { moneyFlow: true, strategyLab: false })), false);
    assert.equal(canAccessModule("SL", ent("elite", "TRIALING", { moneyFlow: true, strategyLab: true })), true);
  });
  it("subscriptions switched off: everything open", () => {
    const e = { ...ent("none", "NONE", {}), subscriptionsEnabled: false };
    assert.equal(canAccessModule("MF", e), true);
    assert.equal(canAccessModule("SL", e), true);
  });
  it("entitlements still loading: paid modules locked, free modules open", () => {
    assert.equal(canAccessModule("MC", null), true);
    assert.equal(canAccessModule("SI", null), true);
    assert.equal(canAccessModule("MF", null), false);
    assert.equal(canAccessModule("SL", null), false);
  });
});
