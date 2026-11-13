import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const checkout = read("./checkout-page.tsx");
const summary = read("./summary-card.tsx");
const plans = read("../choose-plan-screen.tsx");
const success = read("../billing-pages.tsx");
const manage = read("../../screens/manage-plan.tsx");
const settings = read("../../screens/settings.tsx");

test("plan cards and the checkout button say Subscribe, not 'Start your N day free trial'", () => {
  assert.match(plans, /let ctaText = "Subscribe";/);
  assert.doesNotMatch(plans, /Start your \$\{trialDays\} day free trial/);
  assert.doesNotMatch(checkout, /Start your \$\{preview\.trial\.days\} day free trial/);
});

test("the 7-days-free box sits above the card form (in the payment column, not the summary)", () => {
  const box = checkout.indexOf("<TrialBox trial={preview?.trial} />");
  const form = checkout.indexOf("<Form", box);
  assert.ok(box > 0 && form > box, "TrialBox renders right before the card form");
  assert.doesNotMatch(summary.slice(summary.indexOf("export function SummaryCard")), /data-testid="trial-box"/);
});

test("checkout says 'Cancel for free before <date>'", () => {
  assert.match(summary, /Cancel for free before <b>\{trialEnd\(trial\.endsAt\)\}<\/b>\./);
  assert.match(summary, /<li>Cancel for free before \{trialEnd\(trial\.endsAt\)\}\.<\/li>/);
  assert.doesNotMatch(summary, /Cancel in Manage Plan before/);
});

test("success: 'Congratulations! Your <plan> plan is activated'", () => {
  assert.match(success, /`Congratulations! Your \$\{/);
  assert.match(success, /plan is activated`/);
});

test("trial line: 'Free trial until <date>. Cancel for free in your trial period.'", () => {
  assert.match(manage, /Free trial until \{longDate\(summary\.currentPeriodEnd\)\}\. Cancel for free in your trial period\./);
  assert.match(settings, /Cancel for free in your trial period\./);
  assert.doesNotMatch(manage + settings, /Your first charge is on that date/);
});
