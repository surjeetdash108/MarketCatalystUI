// Until self-service billing ships (M3), Manage Plan must not promise billing
// that does not exist: no dead buttons, no Stripe/invoice/cancel copy, no
// prices that disagree with the catalog, no limits the app does not enforce.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const plan = read("app/iq/screens/manage-plan.tsx");
const settings = read("app/iq/screens/settings.tsx");

describe("Manage Plan before billing is live", () => {
  it("says paid plans are launching soon and that nothing is charged", () => {
    assert.match(plan, /Paid plans launching soon/);
    assert.match(plan, /won(&apos;|’|')t be charged|not be charged|No payment is taken/);
  });
  it("has no button without an action", () => {
    const buttons = plan.match(/<button\b[^>]*>/g) ?? [];
    for (const b of buttons) assert.match(b, /onClick=|disabled/, b);
  });
  it("makes no billing claims that are not true yet", () => {
    for (const re of [/Billing is managed via Stripe/, /billed monthly/i, /View Invoices/, /Update Payment Method/, /Cancel Subscription/, /Manage Billing/, /Upgrade to /]) {
      assert.doesNotMatch(plan, re);
    }
  });
  it("shows no hardcoded prices and no unenforced limits", () => {
    assert.doesNotMatch(plan, /amountMinor|2999|4999|\$\d/);
    assert.doesNotMatch(plan, /up to 5 stocks|3 symbols/);
  });
  it("Settings no longer promises features behind an upgrade that does not exist", () => {
    assert.doesNotMatch(settings, /Upgrade to Premium to unlock/);
  });
});
