// The app's Terms and Privacy carry no draft markers (W-22, 24 Nov 2026 audit):
// §12 is the neutral pre-launch paragraph until counsel approves the full text,
// which is kept in docs/legal only. Run: node --test tests/ui/
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
  it("§12 is the neutral pre-launch paragraph", () => {
    assert.ok(terms.includes("Paid plans are launching soon. Subscription terms will be published here before any charge."));
    assert.ok(!terms.includes("7-day free trial"));
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
