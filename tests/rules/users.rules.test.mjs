// Firestore security rules for users/{uid}, run against the emulator with the
// live ruleset (firestore.rules). Run: npm run test:rules
//
// A signed-in user must not be able to grant themselves a plan from the
// browser: plan, subscription, Stripe, feature-flag and identity fields are
// written only by the backend (Admin SDK, which bypasses rules).
import { describe, it, before, after, beforeEach } from "node:test";
import fs from "node:fs";
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const UID = "alice";
const EMAIL = "alice@example.com";
const SERVER_OWNED = {
  tier: "pro",
  currentPlan: "elite",
  subscriptionStatus: "ACTIVE",
  subscriptionStartDate: "2026-01-01",
  subscriptionExpiryDate: "2099-12-31",
  featureFlags: { strategyLab: true },
  stripeCustomerId: "cus_x",
  stripeSubId: "sub_x",
  uid: "mallory",
  email: "mallory@example.com",
  createdAt: "1999-01-01",
};

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mc-rules",
    firestore: { rules: fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", UID), {
      uid: UID, email: EMAIL, name: "Alice", tier: "free", currentPlan: "free",
      subscriptionStatus: "NONE", createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

const alice = () => env.authenticatedContext(UID, { email: EMAIL }).firestore();
const mallory = () => env.authenticatedContext("mallory", { email: "mallory@example.com" }).firestore();

describe("users/{uid} update", () => {
  it("the owner may change investor-profile fields", async () => {
    await assertSucceeds(updateDoc(doc(alice(), "users", UID), {
      name: "Alice B", riskTolerance: "High", preferredAssetClasses: ["Stocks"], updatedAt: "2026-11-09T00:00:00.000Z",
    }));
  });
  for (const [field, value] of Object.entries(SERVER_OWNED)) {
    it(`the owner may not write ${field}`, async () => {
      await assertFails(updateDoc(doc(alice(), "users", UID), { [field]: value }));
    });
    it(`the owner may not slip ${field} in beside a profile field`, async () => {
      await assertFails(updateDoc(doc(alice(), "users", UID), { name: "Alice C", [field]: value }));
    });
  }
  it("another user may not write the profile", async () => {
    await assertFails(updateDoc(doc(mallory(), "users", UID), { name: "pwned" }));
  });
});

describe("users/{uid} create", () => {
  beforeEach(async () => { await env.clearFirestore(); });
  it("the owner may create a profile of profile fields plus their own uid and auth email", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users", UID), {
      uid: UID, email: EMAIL, name: "Alice", createdAt: "2026-11-09T00:00:00.000Z",
    }));
  });
  for (const field of ["tier", "currentPlan", "subscriptionStatus", "subscriptionExpiryDate", "featureFlags", "stripeCustomerId", "stripeSubId"]) {
    it(`create may not carry ${field}`, async () => {
      await assertFails(setDoc(doc(alice(), "users", UID), {
        uid: UID, email: EMAIL, name: "Alice", createdAt: "2026-11-09T00:00:00.000Z", [field]: SERVER_OWNED[field],
      }));
    });
  }
  it("create may not claim another uid or email", async () => {
    await assertFails(setDoc(doc(alice(), "users", UID), { uid: "mallory", email: EMAIL, createdAt: "x" }));
    await assertFails(setDoc(doc(alice(), "users", UID), { uid: UID, email: "mallory@example.com", createdAt: "x" }));
  });
});

describe("users/{uid} read and delete", () => {
  it("the owner may read; others may not", async () => {
    await assertSucceeds(getDoc(doc(alice(), "users", UID)));
    await assertFails(getDoc(doc(mallory(), "users", UID)));
  });
  it("nobody may delete from the client", async () => {
    await assertFails(deleteDoc(doc(alice(), "users", UID)));
  });
});
