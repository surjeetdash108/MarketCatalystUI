import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { resendWaitSeconds, safeNext, verifyContinueUrl } from "./email-code";
import { EmailLinkStep } from "./email-link-step";
import { shouldSync } from "../staff-sync";

describe("email verification step", () => {
  it("follows only same-site paths after verifying", () => {
    assert.equal(safeNext("/checkout?plan=pro&interval=annual"), "/checkout?plan=pro&interval=annual");
    for (const bad of ["//evil.example.com", "https://evil.example.com", "\\\\x", null]) assert.equal(safeNext(bad as string), "/dashboard");
  });
  it("renders the link step: 'I've verified' and 'Resend link', no code box", () => {
    const html = renderToStaticMarkup(<EmailLinkStep onVerified={() => {}} />);
    assert.match(html, /verification link/);
    assert.match(html, /data-testid="email-link-check"/);
    assert.match(html, /Resend link/);
    assert.doesNotMatch(html, /one-time-code/i);
  });
  it("the email's link returns to /verify-email and then to the same-site next page", () => {
    assert.equal(verifyContinueUrl("https://app.marketcatalyst.ai", "/checkout?plan=pro"), "https://app.marketcatalyst.ai/verify-email?next=%2Fcheckout%3Fplan%3Dpro");
    assert.equal(verifyContinueUrl("https://app.marketcatalyst.ai", "/dashboard"), "https://app.marketcatalyst.ai/verify-email");
    assert.equal(verifyContinueUrl("https://app.marketcatalyst.ai", "//evil.example.com"), "https://app.marketcatalyst.ai/verify-email");
  });
  it("one link per minute (a page reload doesn't resend)", () => {
    assert.equal(resendWaitSeconds(null, 1_000_000), 0);
    assert.equal(resendWaitSeconds(1_000_000, 1_010_000), 50);
    assert.equal(resendWaitSeconds(1_000_000, 1_070_000), 0);
  });
  it("uses Firebase's verification email, not our 6-digit code API", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/iq/billing/email-link-step.tsx"), "utf8");
    assert.match(src, /sendEmailVerification\(u, \{ url: verifyContinueUrl/);
    assert.match(src, /getIdToken\(true\)/);
    assert.doesNotMatch(src, /sendEmailCode|verifyEmailCode/);
  });
  it("no phone OTP, WhatsApp, date of birth or PAN anywhere in the signup/checkout code", () => {
    const files = ["app/iq/billing/email-link-step.tsx", "app/verify-email/page.tsx", "app/auth/signup/signup-form.tsx"];
    for (const f of files) assert.doesNotMatch(fs.readFileSync(path.join(process.cwd(), f), "utf8"), /whatsapp|date of birth|\bdob\b|\bPAN\b|sms code/i);
  });
});

describe("staff claim sync", () => {
  it("syncs on sign-in, on a different user, and again after 5 minutes (no refresh loop)", () => {
    assert.equal(shouldSync("u1", 0, null), true);
    assert.equal(shouldSync("u1", 60_000, { uid: "u1", at: 0 }), false);
    assert.equal(shouldSync("u2", 60_000, { uid: "u1", at: 0 }), true);
    assert.equal(shouldSync("u1", 300_000, { uid: "u1", at: 0 }), true);
  });
  it("the app listener calls it on every ID-token change", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/store/firebase-listener.tsx"), "utf8");
    assert.match(src, /onIdTokenChanged\(firebaseAuth, \(user\) => \{\s*if \(!cancelled\) void syncStaffClaim\(user\);/);
  });
});
