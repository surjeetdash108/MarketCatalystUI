import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { sanitizeCode } from "./email-code";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("email flows go through our branded emails (SendGrid), not Firebase's", () => {
  it("verification is the 6-digit code step, on /verify-email and in checkout", () => {
    assert.match(read("../../verify-email/page.tsx"), /<EmailCodeStep onVerified=/);
    assert.match(read("./checkout/checkout-page.tsx"), /<EmailCodeStep title="Verify your email to continue"/);
    assert.match(read("./email-code-step.tsx"), /sendEmailCode\(\)/);
    assert.equal(sanitizeCode("12a3 45-67"), "123456");
  });
  it("Firebase's verification and reset emails are commented out", () => {
    assert.match(read("./email-link-step.tsx"), /\/\/ await sendEmailVerification\(/);
    const forgot = read("../../auth/forgot-password/forgot-form.tsx");
    assert.match(forgot, /\/\/ await sendPasswordResetEmail\(/);
    assert.match(forgot, /apiPost\("\/api\/account\/password-reset", \{ email: email\.trim\(\) \}\)/);
  });
  it("Settings has the tips-and-offers switch; the email logo is hosted", () => {
    assert.match(read("../screens/settings.tsx"), /<MarketingEmailToggle \/>/);
    assert.match(read("../marketing-email-toggle.tsx"), /\/api\/account\/email-prefs/);
    assert.ok(existsSync(new URL("../../../public/email/logo.png", import.meta.url)));
  });
});
