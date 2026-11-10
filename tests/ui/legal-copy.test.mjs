// Terms §12 and Privacy must describe how billing actually works, and stay
// flagged for legal review until approved. Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const terms = read("app/auth/legal/terms-content.tsx");
const privacy = read("app/auth/legal/privacy-content.tsx");

describe("Terms §12 matches the subscription system", () => {
  for (const phrase of [
    "Manage Plan page",
    "you keep access to your paid plan until that date",
    "take effect immediately; we charge a prorated amount",
    "take effect at the end of the current billing period",
    "we retry it over the following 7 days",
    "once per person",
    "We do not currently offer free trials on paid plans",
    "at least 30 days",
  ]) it(`says: ${phrase}`, () => assert.ok(terms.includes(phrase), phrase));
  it("is flagged for legal review and uses placeholders, not invented details", () => {
    assert.match(terms, /\[LEGAL REVIEW PLACEHOLDER/);
    assert.match(terms, /MarketCatalyst LLC \[PLACEHOLDER\]/);
    assert.match(terms, /support@example\.com/);
  });
});

describe("Privacy discloses billing data handling", () => {
  it("mentions the retained hashed email for the retention offer and the email provider", () => {
    assert.match(privacy, /one-way cryptographic hash of your email address/);
    assert.match(privacy, /kept after you close your account/);
    assert.match(privacy, /through our email provider, Twilio SendGrid,/);
    assert.doesNotMatch(privacy, /\[EMAIL PROVIDER PLACEHOLDER\]/);
  });
});

describe("checkout v2 copy (draft, flagged for legal review)", () => {
  it("Terms §12 refund paragraph is the generated REFUND_WINDOW_DAYS copy (one switch)", () => {
    assert.match(terms, /<strong>Refunds\.<\/strong> <span data-testid="terms-refunds">\{REFUND_POLICY\.termsParagraph\}<\/span>/);
    assert.match(terms, /import \{ REFUND_POLICY \} from "\.\.\/\.\.\/iq\/billing\/refund-policy\.generated"/);
    assert.doesNotMatch(terms, /We do not provide refunds or credits for partial billing periods or unused time, except as required by law or where we decide otherwise/);
  });
  it("Terms §12 describes renewal at the full price and the recorded renewal consent", () => {
    assert.match(terms, /Renewals are charged at the full price of your plan/);
    assert.match(terms, /ticking the renewal consent box; we keep a record of when you agreed, the wording you saw, the plan, billing period and price, and your IP address/);
  });
  it("Privacy: phone for account and billing contact; no marketing texts without opt-in; only country/state/ZIP of the address", () => {
    assert.match(privacy, /mobile number you give at checkout\. We use it for account and billing contact/);
    assert.match(privacy, /We do not send marketing text messages unless you opt in/);
    assert.match(privacy, /We keep only your country, state and ZIP\/postal code/);
    assert.match(privacy, /We do not collect government ID numbers or your date of birth/);
  });
});
