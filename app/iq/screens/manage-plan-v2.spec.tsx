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
  it("is the only place a signed-in user chooses a plan: a new paid plan opens /checkout; subscribers keep preview/confirm", () => {
    assert.match(mp, /if \(!subscribed\) \{\s*\/\/[^\n]*\n\s*window\.location\.href = checkoutPath\(\{ planId: plan\.id, interval \}\);/);
    assert.match(mp, /const preview = await run\(\(\) => previewChange\(/);
    assert.doesNotMatch(mp, /mp-promo|startCheckout/);
  });
  it("Request refund exists only while REFUND_WINDOW_DAYS > 0 and the backend says the payment is eligible", () => {
    assert.match(mp, /if \(REFUND_POLICY\.enabled\) setRefund\(await refundEligibility\(\)/);
    assert.match(mp, /\{REFUND_POLICY\.enabled && refund\?\.eligible && \(/);
    assert.match(mp, /<div>\{REFUND_POLICY\.managePlanLine\}<\/div>/);
    assert.equal(REFUND_POLICY.enabled, true);
    assert.equal(REFUND_POLICY.windowDays, 14);
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
    assert.match(src("app/iq/screens/settings.tsx"), /isStaff \? "Staff"/);
  });
});
