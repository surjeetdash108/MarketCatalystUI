// Signup has a "Choose your plan" section with plan cards, interval toggle and promo field.
// The plan is preselected from the website tile (?plan=&interval=) or defaults to Starter monthly.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseSignupParams, checkoutPath, nextAfterSignup } from "../../app/iq/billing/plan-intent.js";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("the signup page does not show plan picker cards", () => {
  const src = read("app/auth/signup/signup-form.tsx");
  assert.doesNotMatch(src, /<PlanPicker/);
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

  // Invalid plan -> null (no plan preselection)
  assert.equal(parseSignupParams("?plan=bogus&interval=annual", plans), null);

  // Invalid interval -> null
  assert.equal(parseSignupParams("?plan=pro&interval=lifetime", plans), null);

  // Missing params -> null
  assert.equal(parseSignupParams("", plans), null);

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

test("the intent routes to Step 2 (/choose-plan) after signup", () => {
  const intentWithPromo = {
    planId: "pro",
    interval: "annual",
    promoCode: "WELCOME20",
  };
  const path = "/choose-plan?plan=pro&interval=annual&promo=WELCOME20";

  // For password signup: validates email first, with intent preserved in next param
  const nextPw = nextAfterSignup(intentWithPromo, "password");
  assert.equal(nextPw, `/verify-email?next=${encodeURIComponent(`${path}&onboarding=1`)}`);

  // For Google signup: goes directly to /choose-plan with intent
  const nextGoogle = nextAfterSignup(intentWithPromo, "google");
  assert.equal(nextGoogle, `${path}&onboarding=1`);
});
