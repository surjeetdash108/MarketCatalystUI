import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../../store/auth-slice";
import profileReducer from "../../store/profile-slice";
import { ManagePlanSoon } from "../screens/manage-plan-soon";
import { RetentionChoice } from "../screens/manage-plan";
import { LockedFeature } from "../entitlement-gate";
import { gateDecisionFor, type Entitlements } from "../hooks/useEntitlements";

function storeWith(profile: Record<string, unknown> | null) {
  return configureStore({
    reducer: { auth: authReducer, profile: profileReducer },
    preloadedState: {
      auth: { user: { uid: "u1", email: "u1@example.com", displayName: "U One", photoURL: null }, status: "ready" as const },
      profile: { data: profile as never, status: "ready" as const },
    },
  });
}
const render = (profile: Record<string, unknown> | null) =>
  renderToStaticMarkup(
    <Provider store={storeWith(profile)}>
      <ManagePlanSoon />
    </Provider>,
  );

describe("Premium badge / Manage Plan (rendered)", () => {
  it("shows Current Access — never Premium or Free — when the profile is missing", () => {
    const html = render(null);
    assert.match(html, />Current Access</);
    assert.doesNotMatch(html, /Premium/);
    assert.doesNotMatch(html, />Free</);
    assert.match(html, /Paid plans launching soon/);
    assert.match(html, /won&#x27;t be charged anything/);
  });
  it("shows Current Access for a profile with only the legacy tier field", () => {
    assert.match(render({ uid: "u1", tier: "pro" }), />Current Access</);
  });
  it("shows the paid plan only for a confirmed live subscription", () => {
    assert.match(render({ uid: "u1", currentPlan: "pro", subscriptionStatus: "ACTIVE", subscriptionExpiryDate: "2099-01-01" }), />Pro</);
    assert.match(render({ uid: "u1", currentPlan: "pro", subscriptionStatus: "EXPIRED" }), />Current Access</);
  });
  it("has no price and no button without an action in the launching-soon state", () => {
    const html = render(null);
    assert.doesNotMatch(html, /\$\d/);
    assert.doesNotMatch(html, /<button/);
  });
});

describe("retention offer screen (rendered)", () => {
  const offer = { mode: "percent_next_invoices", percentOff: 50, months: 2, interval: "monthly" as const, creditAmount: null, currency: "USD", appliesFrom: "2026-12-10T12:00:00.000Z", headline: "Keep your plan for 50% off for the next 2 months", description: "50% off your next 2 monthly invoices" };
  it("is one screen: the headline, 'Keep my plan at 50%' and 'Cancel my plan' in different colours", () => {
    const html = renderToStaticMarkup(<RetentionChoice offer={offer} busy={false} onKeep={() => {}} onCancel={() => {}} onClose={() => {}} />);
    assert.match(html, new RegExp(offer.headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const keep = html.match(/<button[^>]*data-testid="retention-keep"[^>]*>/)![0];
    const cancel = html.match(/<button[^>]*data-testid="retention-cancel"[^>]*>/)![0];
    assert.match(html, />Keep my plan at 50%</);
    assert.match(html, />Cancel my plan</);
    const look = (b: string) => (b.match(/class="([^"]*)"/)?.[1] ?? "") + (b.match(/style="([^"]*)"/)?.[1] ?? "");
    assert.notEqual(look(keep), look(cancel), "the two choices must not be the same colour");
    assert.equal((html.match(/<button/g) ?? []).length, 3, "the two choices plus the close button — nothing else");
  });
});

describe("locked feature (rendered)", () => {
  it("every lock: 🔒, which plan has it, and one 'See the plans' button to the plans page (no hard-coded prices)", () => {
    const html = renderToStaticMarkup(<LockedFeature entitlement="moneyFlow" requiredPlan="pro" />);
    assert.match(html, /data-testid="locked-feature"/);
    assert.match(html, /🔒/);
    assert.match(html, /data-testid="locked-title"[^>]*>Money Flow</);
    assert.match(html, />Available on Pro and up</);
    assert.match(html, /href="\/choose-plan\?plan=pro">See the plans</);
    assert.doesNotMatch(html, /\$\d/);
    const elite = renderToStaticMarkup(<LockedFeature entitlement="strategyLab" requiredPlan="elite" />);
    assert.match(elite, />Available on Elite</);
    assert.match(elite, /Strategy Lab/);
  });
});

describe("gateDecisionFor", () => {
  const ent = (over: Partial<Entitlements>): Entitlements => ({
    subscriptionsEnabled: true, paidPlansAvailable: true, provider: "fake", planId: "free", planName: "Free", status: "NONE", interval: null,
    cancelAtPeriodEnd: false, currentPeriodEnd: null, inGrace: false, graceEndsAt: null,
    entitlements: { moneyFlow: false, watchlist: true }, requiredPlan: { moneyFlow: "pro" }, hidden: ["alerts"], limits: { watchlistTickers: 5 }, ...over,
  });
  it("locks with the required plan when the plan lacks the feature", () => {
    assert.deepEqual(gateDecisionFor(ent({}), "moneyFlow"), { kind: "locked", requiredPlan: "pro" });
  });
  it("allows everything while subscriptions are off (today's behaviour)", () => {
    assert.deepEqual(gateDecisionFor(ent({ subscriptionsEnabled: false }), "moneyFlow"), { kind: "allow" });
  });
  it("hides unbuilt features and waits while loading", () => {
    assert.deepEqual(gateDecisionFor(ent({}), "alerts"), { kind: "hidden" });
    assert.deepEqual(gateDecisionFor(null, "moneyFlow"), { kind: "loading" });
    assert.deepEqual(gateDecisionFor(ent({}), null), { kind: "allow" });
  });
});
