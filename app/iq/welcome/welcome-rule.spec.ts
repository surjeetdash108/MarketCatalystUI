import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { welcomeDecision } from "./welcome-rule";

test("new signup without a plan (normal, or from a website plan without subscribing): show", () => {
  assert.equal(welcomeDecision(true, "INTRO"), "show");
  assert.equal(welcomeDecision(true, "NONE"), "show");
  assert.equal(welcomeDecision(true, "EXPIRED"), "show");
});

test("signed up from a website plan and subscribed (trial or paid): don't show", () => {
  assert.equal(welcomeDecision(true, "TRIALING"), "drop");
  assert.equal(welcomeDecision(true, "ACTIVE"), "drop");
});

test("waits for entitlements; nothing without the signup flag", () => {
  assert.equal(welcomeDecision(true, undefined), "wait");
  assert.equal(welcomeDecision(false, "INTRO"), "drop");
});

test("the modal uses the rule and the new wording", () => {
  const src = readFileSync(new URL("../welcome-feedback-modals.tsx", import.meta.url), "utf8");
  assert.match(src, /welcomeDecision\(/);
  assert.match(src, /As a thank-you for being a valued customer, enjoy/);
  assert.doesNotMatch(src, /We value our customers, so we are providing/);
});
