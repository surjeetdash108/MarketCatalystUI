// The app's Terms and Privacy carry no draft markers (W-22, 24 Nov 2026 audit);
// §12 prints the shared subscription terms (W-26, 26 Nov 2026 audit). Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const terms = read("app/auth/legal/terms-content.tsx");
const privacy = read("app/auth/legal/privacy-content.tsx");
const entity = read("app/auth/legal/legal-entity.ts");

describe("app legal pages", () => {
  it("no placeholders, example addresses or draft notices", () => {
    for (const src of [terms, privacy]) {
      assert.doesNotMatch(src, /PLACEHOLDER/);
      assert.doesNotMatch(src, /example\.com/);
      assert.doesNotMatch(src, /Draft — legal review required/);
    }
  });
  it("§12 prints the shared subscription terms that Home and checkout state (W-26)", () => {
    assert.match(terms, /SUBSCRIPTION_TERMS\.termsParagraphs\.map/);
    assert.ok(!terms.includes("launching soon"));
    const gen = read("app/iq/billing/refund-policy.generated.ts");
    assert.match(gen, /7-day free trial, counted from sign-up/);
    assert.match(gen, /Plans renew automatically until you cancel\. No refunds\./);
    assert.match(read("app/iq/billing/checkout/summary-card.tsx"), /REFUND_POLICY\.checkoutLine/);
  });
  it("one spelling of advisor, no options figures while there is no options chain (W-14, W-27)", () => {
    for (const src of [terms, privacy]) assert.doesNotMatch(src, /\badvisers?\b/);
    assert.doesNotMatch(terms, /options figures/);
  });
  it("entity and Last Updated come from legal-entity.ts, one format", () => {
    assert.match(entity, /LEGAL_ENTITY = "MarketCatalyst Analytics LLC"/);
    for (const src of [terms, privacy]) assert.match(src, /Last Updated: <strong>\{LEGAL_UPDATED\}<\/strong>/);
  });
  it("Privacy: billing data disclosures stay", () => {
    assert.match(privacy, /one-way cryptographic hash of your email address/);
    assert.match(privacy, /through our email provider, Twilio SendGrid,/);
    assert.doesNotMatch(privacy, /Phone number/);
    assert.match(privacy, /We keep only your country, state and ZIP\/postal code/);
  });
});
