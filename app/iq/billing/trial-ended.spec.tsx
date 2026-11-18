// Once the 7 free days are over and there's no plan, every locked Market
// Catalyst screen and widget shows one card: "Your free trial has ended" +
// "Choose a plan" — never "Every plan starts with an N-day free trial" (the
// trial is those same 7 days, so there is no further trial to offer).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { TrialEndedCard, cheapestPlanLine, trialEnded, trialEndedLine } from "../entitlement-gate";
import type { Entitlements } from "../hooks/useEntitlements";
import type { CatalogPlan } from "./catalog";

const base: Entitlements = {
  subscriptionsEnabled: true, paidPlansAvailable: true, provider: "stripe", planId: "none", planName: "No plan", status: "NONE",
  interval: null, cancelAtPeriodEnd: false, currentPeriodEnd: null, inGrace: false, graceEndsAt: null,
  entitlements: { news: false }, requiredPlan: { news: "starter" }, hidden: [], limits: { watchlistTickers: null },
};

describe("trialEnded", () => {
  it("no plan after the intro: the trial has ended", () => {
    assert.equal(trialEnded(base), "trial");
    assert.equal(trialEnded({ ...base, status: "EXPIRED" }), "trial");
  });
  it("a cancelled or unpaid plan: the plan has ended", () => {
    assert.equal(trialEnded({ ...base, status: "CANCELLED" }), "plan");
    assert.equal(trialEnded({ ...base, status: "PAST_DUE" }), "plan");
  });
  it("intro, a plan, a trial, grace, staff, or plans not launched: not ended", () => {
    assert.equal(trialEnded({ ...base, status: "INTRO", introEndsAt: "2026-11-20T04:59:59Z" }), null);
    assert.equal(trialEnded({ ...base, status: "ACTIVE", subscriptionPlanId: "starter" }), null);
    assert.equal(trialEnded({ ...base, status: "TRIALING", subscriptionPlanId: "pro" }), null);
    assert.equal(trialEnded({ ...base, status: "PAST_DUE", inGrace: true }), null);
    assert.equal(trialEnded({ ...base, staff: true }), null);
    assert.equal(trialEnded({ ...base, subscriptionsEnabled: false }), null);
    assert.equal(trialEnded(null), null);
  });
});

describe("the card", () => {
  it("matches the design: title, per-screen line, Choose a plan, price line · Cancel anytime", () => {
    const html = renderToStaticMarkup(<TrialEndedCard entitlement="news" ended="trial" planLine="Starter from $31.20/mo, billed annually" />);
    assert.match(html, />Your free trial has ended</);
    assert.match(html, />Choose a plan to keep getting real-time market news and commentary in the Live Feed\.</);
    assert.match(html, /href="\/choose-plan"[^>]*>Choose a plan</);
    assert.match(html, />Starter from \$31\.20\/mo, billed annually · Cancel anytime</);
    assert.doesNotMatch(html, /is part of|Available on|free trial\.|-day/);
  });
  it("a lapsed plan says so; no price line yet → just Cancel anytime", () => {
    const html = renderToStaticMarkup(<TrialEndedCard entitlement="heatmap" ended="plan" variant="widget" planLine={null} />);
    assert.match(html, />Your plan has ended</);
    assert.match(html, />Cancel anytime</);
  });
  it("unknown screens fall back to their label", () => {
    assert.equal(trialEndedLine("chartsDaily"), "Choose a plan to keep using Daily Charts.");
  });
  it("price line: the cheapest annual plan, per month, from the catalog", () => {
    const plan = (id: string, name: string, annual: number): CatalogPlan => ({ id, name, description: "", currency: "USD", sortOrder: 1, prices: { monthly: { amount: 3900, lookupKey: "m" }, annual: { amount: annual, lookupKey: "a" } } });
    assert.equal(cheapestPlanLine([plan("pro", "Pro", 70000), plan("starter", "Starter", 37440)]), "Starter from $31.20/mo, billed annually");
    assert.equal(cheapestPlanLine([]), null);
  });
});

describe("no leftover trial offers", () => {
  it("the locked panel and Settings no longer promise an N-day trial", () => {
    for (const f of ["app/iq/entitlement-gate.tsx", "app/iq/screens/settings.tsx"]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      assert.doesNotMatch(src, /starts with a \$\{[^}]*\}-day free trial/, f);
    }
  });
  it("the locked panel switches to the card when the trial has ended", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/iq/entitlement-gate.tsx"), "utf8");
    assert.match(src, /const ended = trialEnded\(ent\);\n\s+if \(ended\) return <TrialEndedCard/);
  });
});
