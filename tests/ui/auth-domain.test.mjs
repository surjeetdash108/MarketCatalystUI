// Google's account chooser says "to continue to <auth domain>". The app signs in
// through its own address (Firebase Hosting serves /__/auth/handler there), not
// the project's default market-catalyst-502415.firebaseapp.com.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../../app/firebase.ts", import.meta.url), "utf8");

describe("Google sign-in shows the app's own domain", () => {
  it("the default auth domain is app.marketcatalyst.ai", () => {
    assert.match(src, /authDomain: process\.env\.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \?\? "app\.marketcatalyst\.ai"/);
  });
  it("not the project's firebaseapp.com address", () => {
    assert.doesNotMatch(src, /authDomain:[^\n]*firebaseapp\.com/);
  });
});
