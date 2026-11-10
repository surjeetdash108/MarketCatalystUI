// Signup has a "Choose your plan" section with plan cards, interval toggle and promo field.
// The plan is preselected from the website tile (?plan=&interval=) or defaults to Starter monthly.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseSignupParams, checkoutPath, nextAfterSignup } from "../../app/iq/billing/plan-intent.js";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("the signup page has a plan picker and promo field", () => {
  const src = read("app/auth/signup/signup-form.tsx");
  assert.match(src, /PlanPicker/);
  assert.match(src, /promoCode/);
  assert.equal(fs.existsSync(new URL("../../app/iq/billing/plan-picker.tsx", import.meta.url)), true);
});

test("6 tile × interval preselection cases, including invalid params", () => {
  const plans = ["starter", "pro", "elite"];

  // 1. starter monthly
  assert.deepEqual(parseSignupParams("?plan=starter&interval=monthly", plans), {
    planId: "starter",
    interval: "monthly",
  });

  // 2. starter annual
  assert.deepEqual(parseSignupParams("?plan=starter&interval=annual", plans), {
    planId: "starter",
    interval: "annual",
  });

  // 3. pro monthly
  assert.deepEqual(parseSignupParams("?plan=pro&interval=monthly", plans), {
    planId: "pro",
    interval: "monthly",
  });

  // 4. pro annual
  assert.deepEqual(parseSignupParams("?plan=pro&interval=annual", plans), {
    planId: "pro",
    interval: "annual",
  });

  // 5. elite monthly
  assert.deepEqual(parseSignupParams("?plan=elite&interval=monthly", plans), {
    planId: "elite",
    interval: "monthly",
  });

  // 6. elite annual
  assert.deepEqual(parseSignupParams("?plan=elite&interval=annual", plans), {
    planId: "elite",
    interval: "annual",
  });

  // Invalid plan -> falls back to starter
  assert.deepEqual(parseSignupParams("?plan=bogus&interval=annual", plans), {
    planId: "starter",
    interval: "annual",
  });

  // Invalid interval -> falls back to monthly
  assert.deepEqual(parseSignupParams("?plan=pro&interval=lifetime", plans), {
    planId: "pro",
    interval: "monthly",
  });

  // Missing params -> falls back to starter monthly
  assert.deepEqual(parseSignupParams("", plans), {
    planId: "starter",
    interval: "monthly",
  });

  // Promo in query string is captured
  assert.deepEqual(parseSignupParams("?plan=pro&interval=annual&promo=SAVE20", plans), {
    planId: "pro",
    interval: "annual",
    promoCode: "SAVE20",
  });
});

test("email signup, Google signup and both sign-ins route through the plan intent", () => {
  assert.match(read("app/auth/signup/signup-form.tsx"), /routeAfterSignup\("password"\)/);
  const utils = read("app/auth/auth-utils.ts");
  assert.match(utils, /routeAfterSignup\("google"\)/);
  assert.match(utils, /routeAfterLogin\(postLoginPath/);
  assert.match(read("app/auth/login/login-form.tsx"), /routeAfterLogin\(postLoginPath\(email\)\)/);
});

test("the promo is carried to checkout, including the Google path", () => {
  const intentWithPromo = {
    planId: "pro",
    interval: "annual",
    promoCode: "WELCOME20",
  };
  const path = checkoutPath(intentWithPromo);
  assert.equal(path, "/checkout?plan=pro&interval=annual&promo=WELCOME20");

  // For password signup: goes through verify-email with next
  const nextPw = nextAfterSignup(intentWithPromo, "password", true);
  assert.equal(nextPw, `/verify-email?next=${encodeURIComponent(path)}`);

  // For Google signup: goes directly to checkout with promo
  const nextGoogle = nextAfterSignup(intentWithPromo, "google", true);
  assert.equal(nextGoogle, path);
});
