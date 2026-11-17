import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessModule, showsModule } from "./module-switcher";
import { hiddenInTrial } from "./hooks/useEntitlements";
import type { Entitlements } from "./hooks/useEntitlements";

const ent = (planId: string, status: string, open: Record<string, boolean>): Entitlements => ({
  subscriptionsEnabled: true, paidPlansAvailable: true, provider: "stripe",
  planId, planName: planId, status, interval: null, cancelAtPeriodEnd: false,
  currentPeriodEnd: null, inGrace: false, graceEndsAt: null,
  entitlements: open, requiredPlan: { moneyFlow: "pro", strategyLab: "elite", alphaSignals: "elite" }, hidden: [],
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

describe("Alpha Signals: Elite only, never revealed during the trial", () => {
  it("is the last segment's module and opens on an active Elite plan", () => {
    const e = ent("elite", "ACTIVE", { moneyFlow: true, strategyLab: true, alphaSignals: true });
    assert.equal(showsModule("AS", e), true);
    assert.equal(canAccessModule("AS", e), true);
  });
  it("Elite free trial: Strategy Lab opens, Alpha Signals is not shown at all", () => {
    const e = { ...ent("elite", "TRIALING", { moneyFlow: true, strategyLab: true, alphaSignals: false }), trialWithheld: ["alphaSignals"] };
    assert.equal(canAccessModule("SL", e), true);
    assert.equal(showsModule("AS", e), false);
    assert.equal(hiddenInTrial(e, "alphaSignals"), true);
  });
  it("new-account intro: not shown", () => {
    const e = ent("intro", "INTRO", { moneyFlow: true, alphaSignals: false });
    assert.equal(showsModule("AS", e), false);
  });
  it("Starter / Pro (paid, not trialing): shown locked, the upgrade pop-up explains it", () => {
    const e = ent("pro", "ACTIVE", { moneyFlow: true, strategyLab: false, alphaSignals: false });
    assert.equal(showsModule("AS", e), true);
    assert.equal(canAccessModule("AS", e), false);
  });
  it("an admin grant during the trial wins; staff and subscriptions-off see it", () => {
    assert.equal(showsModule("AS", ent("elite", "TRIALING", { alphaSignals: true })), true);
    assert.equal(showsModule("AS", { ...ent("staff", "STAFF", { alphaSignals: true }), staff: true }), true);
    assert.equal(showsModule("AS", { ...ent("none", "NONE", {}), subscriptionsEnabled: false }), true);
  });
  it("hidden while entitlements load; other modules always listed", () => {
    assert.equal(showsModule("AS", null), false);
    assert.equal(showsModule("SL", null), true);
    assert.equal(canAccessModule("AS", null), false);
  });
});
