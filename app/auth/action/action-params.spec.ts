import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { continuePath, parseActionParams } from "./action-params";

const ORIGIN = "https://app.marketcatalyst.ai";

test("verify email: mode, code and the continue path on our own site", () => {
  const a = parseActionParams("?mode=verifyEmail&oobCode=Y8ozwhotSX0pdAknFvPRRzVQ&apiKey=x&continueUrl=https%3A%2F%2Fapp.marketcatalyst.ai%2Fverify-email%3Fnext%3D%252Fcheckout&lang=en", ORIGIN);
  assert.deepEqual(a, { mode: "verifyEmail", oobCode: "Y8ozwhotSX0pdAknFvPRRzVQ", next: "/verify-email?next=%2Fcheckout" });
});

test("an off-site continueUrl is never followed", () => {
  assert.equal(continuePath("https://evil.example/phish", ORIGIN), "/dashboard");
  assert.equal(continuePath("javascript:alert(1)", ORIGIN), "/dashboard");
  assert.equal(continuePath(null, ORIGIN, "/auth/login"), "/auth/login");
});

test("password reset defaults to sign-in afterwards; unknown modes and bad codes are rejected", () => {
  assert.equal(parseActionParams("?mode=resetPassword&oobCode=abcdefghijkl", ORIGIN).next, "/auth/login");
  assert.equal(parseActionParams("?mode=signIn&oobCode=abcdefghijkl", ORIGIN).mode, null);
  assert.equal(parseActionParams("?mode=verifyEmail&oobCode=<x>", ORIGIN).oobCode, null);
});

test("the page strips the code from the address bar and handles every Firebase email action", () => {
  const src = readFileSync(new URL("./action-handler.tsx", import.meta.url), "utf8");
  assert.match(src, /window\.history\.replaceState\(null, "", "\/auth\/action"\)/);
  for (const fn of ["applyActionCode", "verifyPasswordResetCode", "confirmPasswordReset", "checkActionCode"]) assert.ok(src.includes(`${fn}(firebaseAuth`), fn);
});
