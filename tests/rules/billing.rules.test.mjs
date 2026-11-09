// Billing collections are backend-only; plan-gated market data follows the
// `plan` claim while SUBSCRIPTIONS_ENABLED is on. Run: npm run test:rules
import { describe, it, before, after, beforeEach } from "node:test";
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const BILLING = ["customers", "subscriptions", "payments", "subscription_events", "promo_codes", "promo_redemptions", "promo_attempts", "retention_offers", "stripe_events", "checkout_sessions", "launch_offers", "admin_audit", "fake_billing_subscriptions", "fake_billing_invoices", "fake_billing_checkouts", "fake_billing_customers"];
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

describe("plan-gated market data (TODO(tier-gating) restored)", () => {
  describe("SUBSCRIPTIONS_ENABLED on", () => {
    beforeEach(() => seed(true));
    for (const [c, id, min] of GATED) {
      it(`${c} needs ${min}+`, async () => {
        const rank = { free: 0, starter: 1, pro: 2, elite: 3 };
        for (const p of ["free", "starter", "pro", "elite"]) {
          const read = getDoc(doc(as(p === "free" ? undefined : p), c, id));
          if (rank[p] >= rank[min]) await assertSucceeds(read);
          else await assertFails(read);
        }
      });
    }
    it("ungated collections stay readable on Free (news; recaps feed every dashboard)", async () => {
      await assertSucceeds(getDoc(doc(as(), "news", "n1")));
      await assertSucceeds(getDoc(doc(as(), "recaps", "r1")));
    });
    it("signed-out users read nothing", async () => {
      await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "recaps", "r1")));
    });
  });
  for (const flag of [false, undefined]) {
    describe(`SUBSCRIPTIONS_ENABLED ${flag === undefined ? "unset" : "off"}`, () => {
      beforeEach(() => seed(flag));
      it("every signed-in user reads gated data, as today", async () => {
        for (const [c, id] of GATED) await assertSucceeds(getDoc(doc(as(), c, id)));
      });
    });
  }
});
