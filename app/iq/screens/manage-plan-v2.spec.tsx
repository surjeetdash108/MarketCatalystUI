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
  it("no refunds: no refund button or call; the cancel popup puts 'Keep my plan' first and has no refunds line", () => {
    assert.doesNotMatch(mp, /refundEligibility|requestRefund|request-refund|refund-confirm|Cancel and refund|data-testid="no-refunds"/);
    const dlg = mp.slice(mp.indexOf('testId="cancel-dialog"'), mp.indexOf('testId="cancel-dialog"') + 900);
    assert.ok(dlg.indexOf('testId="cancel-keep"') < dlg.indexOf('testId="cancel-confirm"'), "Keep my plan comes first");
    assert.equal(REFUND_POLICY.enabled, false);
  });
  it("renames: Credits available, Update payment method, Purchase history, Switch to <plan>, thank-you after the offer", () => {
    assert.match(mp, />Credits available: \{formatMoney\(summary\.creditBalance/);
    assert.doesNotMatch(mp, /used automatically on your next invoice\)|Update card<|Plan history<|Upgrade to \$\{|Downgrade to \$\{|"Discount applied"/);
    assert.match(mp, />Update payment method</);
    assert.match(mp, /<h3>Purchase history<\/h3>/);
    assert.match(mp, /label = `Switch to \$\{p\.name\}`;/);
    assert.match(mp, /afterChange\("Thank you for trusting us", "Enjoy 50% off for the next 2 months\."\)/);
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
    assert.match(settings, /<PlanSettingsCard isStaff=\{isStaff\} \/>/);
    assert.match(settings, /badge = "Staff"/);
    assert.match(settings, /Free trial until \$\{shortDate\(ent\?\.currentPeriodEnd\)\}/);
    assert.match(settings, /data-testid="settings-manage-plan"/);
    assert.doesNotMatch(settings, /"Free"|◈ Premium/);
  });
});
