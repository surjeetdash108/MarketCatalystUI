// Billing collections are backend-only; collections no browser reads deny all
// client reads (the generated section). Run: npm run test:rules
import { describe, it, before, after, beforeEach } from "node:test";
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const BILLING = ["config", "email_verifications", "email_verification_ips", "refund_claims", "customers", "subscriptions", "payments", "subscription_events", "promo_codes", "promo_redemptions", "promo_attempts", "retention_offers", "stripe_events", "checkout_sessions", "launch_offers", "admin_audit", "fake_billing_subscriptions", "fake_billing_invoices", "fake_billing_checkouts", "fake_billing_customers"];
const GATED = [
  ["earnings_summaries", "s1", "starter"],
  ["fund_holdings", "cik1", "starter"],
  ["options_flow", "o1", "pro"],
  ["block_trades", "b1", "pro"],
  ["story_stocks", "st1", "pro"],
];

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-mc-rules-billing", firestore: { rules: fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") } });
});
after(async () => { await env?.cleanup(); });

async function seed(flag) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const c of BILLING) await setDoc(doc(db, c, "alice"), { userId: "alice", uid: "alice" });
    for (const [c, id] of GATED) await setDoc(doc(db, c, id), { x: 1 });
    await setDoc(doc(db, "news", "n1"), { x: 1 });
    await setDoc(doc(db, "recaps", "r1"), { x: 1 });
    if (flag !== undefined) await setDoc(doc(db, "feature_flags", "default"), { flags: { SUBSCRIPTIONS_ENABLED: flag } });
  });
}
const as = (plan) => env.authenticatedContext("alice", { email: "alice@example.com", ...(plan ? { plan } : {}) }).firestore();
const asClaims = (claims) => env.authenticatedContext("alice", { email: "alice@example.com", ...claims }).firestore();

describe("billing collections are backend-only", () => {
  beforeEach(() => seed(true));
  for (const c of BILLING) {
    it(`${c}: no client read or write, even on the user's own doc and even on Elite`, async () => {
      await assertFails(getDoc(doc(as("elite"), c, "alice")));
      await assertFails(setDoc(doc(as("elite"), c, "alice"), { hacked: true }));
      await assertFails(setDoc(doc(as(), c, "new-doc"), { uid: "alice" }));
    });
  }
});

describe("collections no browser reads deny every client read (generated section)", () => {
  for (const flag of [true, false, undefined]) {
    describe(`SUBSCRIPTIONS_ENABLED ${flag === undefined ? "unset" : flag}`, () => {
      beforeEach(() => seed(flag));
      for (const [c, id] of GATED) {
        it(`${c}: denied on every plan, staff included`, async () => {
          for (const p of [undefined, "starter", "pro", "elite"]) await assertFails(getDoc(doc(as(p), c, id)));
          await assertFails(getDoc(doc(asClaims({ staff: true, email_verified: true }), c, id)));
        });
      }
      it("ungated collections stay readable when signed in (news, recaps)", async () => {
        await assertSucceeds(getDoc(doc(as(), "news", "n1")));
        await assertSucceeds(getDoc(doc(as(), "recaps", "r1")));
      });
      it("signed-out users read nothing", async () => {
        await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "recaps", "r1")));
      });
    });
  }
  it("the generated section is present and lists exactly the denied collections", () => {
    const rules = fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
    const block = rules.slice(rules.indexOf("BEGIN GENERATED: feature map"), rules.indexOf("END GENERATED: feature map"));
    for (const [c] of GATED) if (!block.includes(`match /${c}/{d=**} { allow read, write: if false; }`)) throw new Error(c);
    if (/canReadOnPlan\('(starter|pro|elite)'\)/.test(rules.replace(/function canReadOnPlan[\s\S]*?\n    }/, ""))) throw new Error("a hand-written plan gate remains");
  });
});

describe("staff full access (claim set by the backend for a verified allowlisted email)", () => {
  for (const flag of [true, false]) {
    describe(`SUBSCRIPTIONS_ENABLED ${flag ? "on" : "off"}`, () => {
      beforeEach(() => seed(flag));
      it("verified staff read signed-in market data (news, recaps); denied collections stay denied", async () => {
        const staff = asClaims({ staff: true, email_verified: true });
        await assertSucceeds(getDoc(doc(staff, "news", "n1")));
        await assertSucceeds(getDoc(doc(staff, "recaps", "r1")));
        for (const [c, id] of GATED) await assertFails(getDoc(doc(staff, c, id)));
      });
    });
  }
  describe("SUBSCRIPTIONS_ENABLED on", () => {
    beforeEach(() => seed(true));
    it("staff still can't read or write config/staff_access, customers (phone) or any billing collection", async () => {
      const staff = asClaims({ staff: true, email_verified: true });
      await assertFails(getDoc(doc(staff, "config", "staff_access")));
      await assertFails(setDoc(doc(staff, "config", "staff_access"), { emails: ["me@example.com"] }));
      await assertFails(getDoc(doc(staff, "customers", "alice")));
    });
  });
});
