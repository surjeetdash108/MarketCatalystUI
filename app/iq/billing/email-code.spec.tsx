import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { safeNext, sanitizeCode } from "./email-code";
import { EmailCodeStep } from "./email-code-step";
import { shouldSync } from "../staff-sync";

describe("email verification step", () => {
  it("accepts only 6 digits (paste-friendly)", () => {
    assert.equal(sanitizeCode("123 456"), "123456");
    assert.equal(sanitizeCode("12-34-56-78"), "123456");
    assert.equal(sanitizeCode("abc"), "");
  });
  it("follows only same-site paths after verifying", () => {
    assert.equal(safeNext("/checkout?plan=pro&interval=annual"), "/checkout?plan=pro&interval=annual");
    for (const bad of ["//evil.example.com", "https://evil.example.com", "\\\\x", null]) assert.equal(safeNext(bad as string), "/dashboard");
  });
  it("renders a one-time-code input, Verify (disabled until 6 digits) and Resend", () => {
    const html = renderToStaticMarkup(<EmailCodeStep onVerified={() => {}} />);
    assert.match(html, /autoComplete="one-time-code"|autocomplete="one-time-code"/);
    assert.match(html, /maxLength="6"|maxlength="6"/);
    assert.match(html, /data-testid="email-code-verify"[^>]*disabled/);
    assert.match(html, /Resend code/);
  });
  it("no phone OTP, WhatsApp, date of birth or PAN anywhere in the signup/checkout code", () => {
    const files = ["app/iq/billing/email-code-step.tsx", "app/verify-email/page.tsx", "app/auth/signup/signup-form.tsx"];
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
