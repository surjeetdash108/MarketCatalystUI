// Billing collections are backend-only; collections no browser reads deny all
// client reads (the generated section). Run: npm run test:rules
import { describe, it, before, after, beforeEach } from "node:test";
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

const BILLING = ["config", "email_verifications", "email_verification_ips", "refund_claims", "customers", "subscriptions", "payments", "subscription_events", "promo_codes", "promo_redemptions", "promo_attempts", "retention_offers", "stripe_events", "checkout_sessions", "launch_offers", "admin_audit", "fake_billing_subscriptions", "fake_billing_invoices", "fake_billing_checkouts", "fake_billing_customers"];
// Market data every screen reads through the backend. These used to allow any
// signed-in account; now no client identity may read them.
const MARKET_CLOSED = ["companies", "tickers", "ohlcv_bars", "earnings_events", "news", "analyst_actions", "macro_events", "market_movers", "market_movers_history", "recaps", "market_indices", "market_indices_history", "sectors", "sectors_history", "ipos", "dividends", "insider_transactions", "options_chains"];
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
    for (const c of MARKET_CLOSED) await setDoc(doc(db, c, "d1"), { x: 1 });
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
      for (const c of MARKET_CLOSED) {
        it(`${c}: no client read on any plan (or none), staff included; reads go through the backend`, async () => {
          for (const p of [undefined, "starter", "pro", "elite"]) {
            await assertFails(getDoc(doc(as(p), c, "d1")));
            await assertFails(getDocs(collection(as(p), c)));
          }
          await assertFails(getDoc(doc(asClaims({ staff: true, email_verified: true }), c, "d1")));
          await assertFails(setDoc(doc(as("elite"), c, "d1"), { hacked: true }));
        });
      }
      it("signed-out users read nothing", async () => {
        await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "recaps", "d1")));
      });
    });
  }
  it("the generated section is present and lists exactly the denied collections", () => {
    const rules = fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
    const block = rules.slice(rules.indexOf("BEGIN GENERATED: feature map"), rules.indexOf("END GENERATED: feature map"));
    for (const [c] of GATED) if (!block.includes(`match /${c}/{d=**} { allow read, write: if false; }`)) throw new Error(c);
    // The one allowed plan gate: the saved Money Flow board. It must match the
    // catalog's minimum plan for Money Flow, so it cannot drift from the backend.
    const mfRule = rules.match(/match \/money_flow\/latest \{\s*allow read:\s*if canReadOnPlan\('(starter|pro|elite)'\);/);
    if (!mfRule) throw new Error("money_flow/latest gate missing");
    const featureMap = fs.readFileSync(new URL("../../app/iq/feature-map.generated.ts", import.meta.url), "utf8");
    const planGroups = JSON.parse(featureMap.match(/export const PLAN_GROUPS = (\{[\s\S]*?\}) as const;/)[1]);
    const minimum = ["starter", "pro", "elite"].find((p) => planGroups[p].includes("moneyFlow"));
    if (mfRule[1] !== minimum) throw new Error(`money_flow/latest gate is '${mfRule[1]}', catalog minimum is '${minimum}'`);
    const withoutAllowed = rules.replace(/function canReadOnPlan[\s\S]*?\n    }/, "").replace(mfRule[0], "");
    if (/canReadOnPlan\('(starter|pro|elite)'\)/.test(withoutAllowed)) throw new Error("a hand-written plan gate remains");
  });
});

describe("money_flow/latest: the saved Money Flow board, read directly by the browser", () => {
  const read = (who) => getDoc(doc(who, "money_flow", "latest"));
  beforeEach(async () => {
    await seed(true);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "money_flow", "latest"), { gz: "x", builtAt: 1 });
      await setDoc(doc(ctx.firestore(), "money_flow", "other"), { x: 1 });
    });
  });
  it("subscriptions on: Pro, Elite and verified staff read it; Starter, no plan and signed-out don't", async () => {
    await assertSucceeds(read(as("pro")));
    await assertSucceeds(read(as("elite")));
    await assertSucceeds(read(asClaims({ staff: true, email_verified: true })));
    await assertFails(read(as("starter")));
    await assertFails(read(as()));
    await assertFails(read(asClaims({ staff: true, email_verified: false })));
    await assertFails(read(env.unauthenticatedContext().firestore()));
  });
  it("subscriptions off: every signed-in user reads it (the backend gates nothing either)", async () => {
    await seed(false);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "money_flow", "latest"), { gz: "x", builtAt: 1 });
    });
    await assertSucceeds(read(as()));
    await assertFails(read(env.unauthenticatedContext().firestore()));
  });
  it("only the latest board: no other document, no listing, no client writes", async () => {
    await assertFails(getDoc(doc(as("elite"), "money_flow", "other")));
    await assertFails(getDocs(collection(as("elite"), "money_flow")));
    await assertFails(setDoc(doc(as("elite"), "money_flow", "latest"), { gz: "hacked" }));
    await assertFails(setDoc(doc(asClaims({ staff: true, email_verified: true }), "money_flow", "latest"), { gz: "hacked" }));
  });
});

describe("staff full access (claim set by the backend for a verified allowlisted email)", () => {
  for (const flag of [true, false]) {
    describe(`SUBSCRIPTIONS_ENABLED ${flag ? "on" : "off"}`, () => {
      beforeEach(() => seed(flag));
      it("verified staff can't read market data from the client either (they use the app, like everyone)", async () => {
        const staff = asClaims({ staff: true, email_verified: true });
        await assertFails(getDoc(doc(staff, "news", "d1")));
        await assertFails(getDoc(doc(staff, "recaps", "d1")));
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
