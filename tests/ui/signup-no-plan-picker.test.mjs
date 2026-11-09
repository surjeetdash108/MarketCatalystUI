// Signup has no "Choose your plan" section; the plan comes only from the website
// tile (?plan=&interval=) and every sign-in path continues to /checkout.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("the signup page has no plan picker or promo field", () => {
  const src = read("app/auth/signup/signup-form.tsx");
  assert.doesNotMatch(src, /PlanPicker|Choose your plan|promo/i);
  assert.equal(fs.existsSync(new URL("../../app/iq/billing/plan-picker.tsx", import.meta.url)), false);
});

test("email signup, Google signup and both sign-ins route through the plan intent", () => {
  assert.match(read("app/auth/signup/signup-form.tsx"), /routeAfterSignup\("password"\)/);
  const utils = read("app/auth/auth-utils.ts");
  assert.match(utils, /routeAfterSignup\("google"\)/);
  assert.match(utils, /routeAfterLogin\(postLoginPath/);
  assert.match(read("app/auth/login/login-form.tsx"), /routeAfterLogin\(postLoginPath\(email\)\)/);
});

test("signup and login keep the tile's plan (capture + query string on the cross links)", () => {
  for (const p of ["app/auth/signup/signup-form.tsx", "app/auth/login/login-form.tsx"]) {
    const src = read(p);
    assert.match(src, /useCaptureIntent\(\)/);
    assert.match(src, /withSearch\("\/auth\/(login|signup)"\)/);
  }
});
