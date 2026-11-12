import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { REFUND_POLICY } from "../billing/refund-policy.generated";
import { StaffPlan } from "./manage-plan-extras";

const src = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("Manage Plan v2", () => {
  const mp = src("app/iq/screens/manage-plan.tsx");
  it("choosing a plan opens /checkout — the payment step for a new plan, the breakdown + payment step for a change", () => {
    assert.match(mp, /if \(!subscribed\) \{\s*\/\/[^\n]*\n\s*window\.location\.href = checkoutPath\(\{ planId: plan\.id, interval \}\);/);
    assert.match(mp, /\/\/ Subscribers change plan on the checkout page[^\n]*\n\s*window\.location\.href = checkoutPath\(\{ planId: plan\.id, interval \}\);/);
    assert.doesNotMatch(mp, /mp-promo|startCheckout/);
  });
  it("plan history is a timeline table (date & time, what happened, details, amount) and every confirmation mentions the email", () => {
    assert.match(mp, /listTimeline\(\)/);
    assert.match(mp, /<th style=\{\{ textAlign: "left" \}\}>Date &amp; time<\/th>/);
    assert.match(mp, /id="history"/);
    assert.match(mp, /data-testid="done-email"[^>]*>We&apos;ve emailed you a confirmation/);
    assert.doesNotMatch(mp, /Free Tier/);
  });
  it("no refunds: no refund button or call; cancelling says the plan stays active to the end of the paid period", () => {
    assert.doesNotMatch(mp, /refundEligibility|requestRefund|request-refund|refund-confirm|Cancel and refund/);
    assert.match(mp, /data-testid="no-refunds"[^>]*>\{REFUND_POLICY\.managePlanLine\}/);
    assert.equal(REFUND_POLICY.enabled, false);
    assert.match(REFUND_POLICY.managePlanLine, /^No refunds\./);
  });
  it("Manage Plan never charges or changes a plan itself: every change goes to the checkout page", () => {
    assert.doesNotMatch(mp, /applyChange|previewChange|confirmChange|handleStripeAction/);
    assert.match(mp, /window\.location\.href = checkoutPath\(\{ planId: plan\.id, interval \}\)/);
  });
  it("staff see 'Staff access' — no plans, checkout, upgrade prompts or retention", () => {
    assert.match(mp, /if \(ent\.staff && !ent\.checkoutPreview\) return <StaffPlan \/>;/);
    const html = renderToStaticMarkup(<StaffPlan />);
    assert.match(html, /Staff access/);
    assert.match(html, /never billed/);
    assert.doesNotMatch(html, /Upgrade|Choose|checkout|Cancel subscription|refund/i);
  });
  it("account settings and plan manage layout", () => {
    assert.doesNotMatch(mp, /<ContactCard \/>/);
    assert.doesNotMatch(src("app/iq/screens/settings.tsx"), /<ContactCard \/>/);
    // Settings → Plan comes from the server's entitlements (plan, status, dates), not profile fields.
    const settings = src("app/iq/screens/settings.tsx");
    assert.match(settings, /<PlanSettingsCard isStaff=\{isStaff\} isLifetime=\{isLifetime\} \/>/);
    assert.match(settings, /badge = "Staff"/);
    assert.match(settings, /Free trial until \$\{shortDate\(ent\?\.currentPeriodEnd\)\}/);
    assert.match(settings, /data-testid="settings-manage-plan"/);
    assert.doesNotMatch(settings, /"Free"|◈ Premium/);
  });
});
