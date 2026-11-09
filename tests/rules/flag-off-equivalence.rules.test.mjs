// Deploy safety: with SUBSCRIPTIONS_ENABLED off, the new firestore.rules must
// behave EXACTLY like the rules live in production today.
//
// fixtures/live-baseline.rules is a byte-for-byte copy of the ruleset released
// to production (both the (default) and mc-regional databases) on 2026-11-09
// (ruleset f0b7beaa…; identical to MarketCatalystUI prod:firestore.rules).
//
// Every identity (signed out, no claim, every legacy and current plan/tier
// claim value) is checked against every path the rules know about — get, list,
// create/update — under every "flag off" state (no flag doc, doc without the
// field, field false). The outcome must match the baseline in every case.
// Run: npm run test:rules
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

// Every path family in either ruleset (top-level public data, gated data,
// nested 13F docs, own vs someone else's user subtree, billing, and paths only
// the catch-all covers).
const MARKET = ["companies", "tickers", "ohlcv_bars", "earnings_events", "earnings_summaries", "news", "analyst_actions", "macro_events", "market_movers", "market_movers_history", "options_flow", "block_trades", "fund_holdings", "story_stocks", "recaps", "market_indices", "market_indices_history", "sectors", "sectors_history", "ipos", "dividends", "insider_transactions", "options_chains"];
const BILLING = ["customers", "subscriptions", "payments", "subscription_events", "promo_codes", "promo_redemptions", "promo_attempts", "retention_offers", "stripe_events", "checkout_sessions", "launch_offers", "admin_audit", "fake_billing_customers", "fake_billing_subscriptions", "fake_billing_invoices", "fake_billing_checkouts", "fake_billing_actions", "fake_billing_events", "fake_billing_portal_sessions", "fake_billing_promotions"];
const DOCS = [
  ...MARKET.map((c) => `${c}/d1`),
  "fund_holdings/d1/filings/f1",
  "fund_holdings/d1/filings/f1/positions/AAPL",
  ...["alice", "bob"].flatMap((u) => [`users/${u}`, `users/${u}/portfolios/p1`, `users/${u}/portfolios/p1/holdings/AAPL`, `users/${u}/watchlists/w1`, `users/${u}/alerts/a1`, `users/${u}/notifications/n1`, `settings/${u}`]),
  ...BILLING.map((c) => `${c}/alice`),
  "feature_flags/default",
  "plans/free",
  "unknown_collection/x",
];
const LISTS = [...MARKET, ...BILLING, "plans", "feature_flags"];

// Signed-in identities carry these custom claims. Legacy values: tier
// free/pro/premium (the old tier() claim) and plan plus/pro(legacy $49.99)/premium.
const CLAIMS = {
  "no claim": {},
  "plan=free": { plan: "free" },
  "plan=plus (retired)": { plan: "plus" },
  "plan=pro": { plan: "pro" },
  "plan=premium (legacy)": { plan: "premium" },
  "plan=starter": { plan: "starter" },
  "plan=elite": { plan: "elite" },
  "plan=unexpected": { plan: "gold" },
  "tier=free": { tier: "free" },
  "tier=pro": { tier: "pro" },
  "tier=premium": { tier: "premium" },
  "tier=premium + plan=plus": { tier: "premium", plan: "plus" },
  "admin claim": { admin: true },
};
const FLAG_OFF_STATES = {
  "no flag doc": undefined,
  "flag doc without SUBSCRIPTIONS_ENABLED": { flags: { FF_OTHER: true } },
  "SUBSCRIPTIONS_ENABLED=false": { flags: { SUBSCRIPTIONS_ENABLED: false } },
};

let live, next;
before(async () => {
  live = await initializeTestEnvironment({ projectId: "demo-mc-rules-live", firestore: { rules: read("./fixtures/live-baseline.rules") } });
  next = await initializeTestEnvironment({ projectId: "demo-mc-rules-next", firestore: { rules: read("../../firestore.rules") } });
});
after(async () => { await live?.cleanup(); await next?.cleanup(); });

async function seed(env, flagDoc) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const p of DOCS) if (p !== "feature_flags/default") await setDoc(doc(db, p), { uid: "alice", userId: "alice", name: "seed" });
    if (flagDoc) await setDoc(doc(db, "feature_flags/default"), flagDoc);
  });
}
async function outcome(promise) {
  try { await promise; return "allow"; } catch (e) {
    if (String(e?.code ?? e?.message).includes("permission-denied") || /PERMISSION_DENIED/.test(String(e?.message))) return "deny";
    throw e;
  }
}
function dbFor(env, who) {
  return who === null ? env.unauthenticatedContext().firestore() : env.authenticatedContext("alice", { email: "alice@example.com", ...who }).firestore();
}
async function matrix(env, who) {
  const db = dbFor(env, who), out = {};
  for (const p of DOCS) {
    out[`get ${p}`] = await outcome(getDoc(doc(db, p)));
    // A profile-only field, so owner updates are allowed by both rulesets.
    out[`set ${p}`] = await outcome(setDoc(doc(db, p), { name: "x" }, { merge: true }));
  }
  for (const c of LISTS) out[`list ${c}`] = await outcome(getDocs(collection(db, c)));
  return out;
}

for (const [state, flagDoc] of Object.entries(FLAG_OFF_STATES)) {
  describe(`flag off (${state}): new rules == production rules`, () => {
    for (const [label, claims] of [["signed out", null], ...Object.entries(CLAIMS)]) {
      it(`${label}: same allow/deny on every get, list and write`, async () => {
        await seed(live, flagDoc);
        await seed(next, flagDoc);
        const a = await matrix(live, claims);
        await seed(live, flagDoc); // writes above may have changed docs; reseed both identically
        await seed(next, flagDoc);
        const b = await matrix(next, claims);
        const diffs = Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${k}: live=${a[k]} new=${b[k]}`);
        assert.deepEqual(diffs, []);
        if (claims) {
          // Sanity: the matrix exercises real access, not an all-deny fluke.
          assert.equal(b["get news/d1"], "allow");
          assert.equal(b["get recaps/d1"], "allow");
          assert.equal(b["get options_flow/d1"], "allow");
          assert.equal(b["get users/bob"], "deny");
        }
      });
    }
  });
}

describe("the flag doc itself", () => {
  it("clients can never write feature_flags/default (any claim), so nobody can switch gating on or off from the client", async () => {
    await seed(next, { flags: { SUBSCRIPTIONS_ENABLED: false } });
    for (const who of [null, ...Object.values(CLAIMS)]) {
      assert.equal(await outcome(setDoc(doc(dbFor(next, who), "feature_flags/default"), { flags: { SUBSCRIPTIONS_ENABLED: true } })), "deny");
    }
  });
});
