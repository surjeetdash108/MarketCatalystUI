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
    assert.match(privacy, /\[EMAIL PROVIDER PLACEHOLDER\]/);
  });
});
