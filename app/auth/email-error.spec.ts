import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EMAIL_IN_USE_MESSAGE, errorAfterEmailEdit } from "./email-error";

test("editing the email clears 'An account already exists with this email.'", () => {
  assert.equal(errorAfterEmailEdit(EMAIL_IN_USE_MESSAGE), "");
});

test("other errors stay", () => {
  assert.equal(errorAfterEmailEdit("Passwords do not match. Please re-enter your password."), "Passwords do not match. Please re-enter your password.");
});

test("the signup form clears it on every email change", () => {
  const src = readFileSync(new URL("./signup/signup-form.tsx", import.meta.url), "utf8");
  assert.match(src, /if \(field === "email"\) setError\(errorAfterEmailEdit\)/);
});
