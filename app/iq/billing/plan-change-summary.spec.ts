import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { planChangeLines, type PlanChangeSummary } from "./plan-change-summary";

const money = (n: number) => "$" + (n / 100).toFixed(2);
const date = (iso: string) => iso.slice(0, 10);
const base: PlanChangeSummary = {
  kind: "upgrade",
  planId: "pro",
  fromPlanName: "Starter",
  toPlanName: "Pro",
  interval: "monthly",
  chargedNow: 1333,
  credit: 0,
  effectiveAt: null,
  nextRenewalAmount: 5900,
  nextRenewalDate: "2026-12-10T12:00:00.000Z",
  currency: "USD",
};

describe("plan change confirmation", () => {
  it("upgrade: new plan, prorated charge today, next renewal", () => {
    assert.deepEqual(planChangeLines(base, money, date), [
      "You're now on Pro (Monthly). The new features are available now.",
      "Charged today: $13.33 (prorated).",
      "Next renewal: $59.00 on 2026-12-10.",
    ]);
    assert.equal(planChangeLines({ ...base, chargedNow: 0 }, money, date)[1], "Nothing was charged today.");
  });

  it("downgrade: credit to the account, not refunded to the card", () => {
    const l = planChangeLines({ ...base, kind: "downgrade", fromPlanName: "Elite", toPlanName: "Pro", chargedNow: 0, credit: 10667 }, money, date);
    assert.equal(l[0], "You're now on Pro (Monthly).");
    assert.match(l[1], /^\$106\.67 was credited to your account for the unused part of Elite\. .* isn't refunded to your card\.$/);
  });

  it("annual → monthly: scheduled date, keep the current plan until then, nothing charged", () => {
    const l = planChangeLines({ ...base, kind: "scheduled", fromPlanName: "Pro", effectiveAt: "2027-11-10T12:00:00.000Z" }, money, date);
    assert.deepEqual(l.slice(0, 2), [
      "Your Pro (Monthly) plan starts on 2027-11-10.",
      "You keep Pro until then. Nothing is charged today.",
    ]);
  });

  it("the confirmation page verifies the change with the server before showing it, and mentions the email", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/iq/billing/billing-pages.tsx"), "utf8");
    assert.match(src, /summary\?\.kind === "scheduled"\s*\? s\.scheduledChange\?\.planId === plan\s*: s\.planId === plan/);
    assert.match(src, /data-testid="success-email"[^>]*>\s*We&apos;ve emailed you a confirmation/);
    const checkout = fs.readFileSync(path.join(process.cwd(), "app/iq/billing/checkout/checkout-page.tsx"), "utf8");
    assert.match(checkout, /rememberPlanChange\(\{/);
  });
});
