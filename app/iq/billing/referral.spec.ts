import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REF_KEY, claimStoredReferral, referralCodeFromSearch, referralLinkFor, rememberReferral, storedReferral } from "./referral";
import { REFERRAL_STEPS } from "../../refer-a-friend/referral-steps";

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

test("the shared link goes to /referral (then sign up), not checkout", () => {
  assert.equal(referralLinkFor("https://app.marketcatalyst.ai/", "MC-ABCD2345"), "https://app.marketcatalyst.ai/referral?code=MC-ABCD2345");
  const page = readFileSync(new URL("../../referral/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /\/checkout\?/);
  assert.match(page, /\/auth\/signup\?ref=/);
});

test("codes are read from ?code=, ?ref= or the old ?promo=; junk is ignored", () => {
  assert.equal(referralCodeFromSearch("?code=mc-abcd2345"), "MC-ABCD2345");
  assert.equal(referralCodeFromSearch("?ref=MC-ABCD2345"), "MC-ABCD2345");
  assert.equal(referralCodeFromSearch("?promo=MC-ABCD2345"), "MC-ABCD2345");
  assert.equal(referralCodeFromSearch("?code=<script>"), null);
});

test("after signup the stored code is claimed once, then cleared", async () => {
  const s = memStore();
  rememberReferral("MC-ABCD2345", s);
  assert.equal(storedReferral(s), "MC-ABCD2345");
  const calls: unknown[] = [];
  const r = await claimStoredReferral(async (path, body) => (calls.push([path, body]), { ok: true }), s);
  assert.equal(r, "claimed");
  assert.deepEqual(calls, [["/api/billing/referral/claim", { code: "MC-ABCD2345" }]]);
  assert.equal(s.m.has(REF_KEY), false);
  assert.equal(await claimStoredReferral(async () => ({ ok: true }), s), "none");
});

test("a network failure keeps the code for another try", async () => {
  const s = memStore();
  rememberReferral("MC-ABCD2345", s);
  assert.equal(await claimStoredReferral(async () => { throw new Error("offline"); }, s), "error");
  assert.equal(storedReferral(s), "MC-ABCD2345");
});

test("both signup paths (email and Google) claim the code", () => {
  const form = readFileSync(new URL("../../auth/signup/signup-form.tsx", import.meta.url), "utf8");
  const utils = readFileSync(new URL("../../auth/auth-utils.ts", import.meta.url), "utf8");
  assert.match(form, /await claimStoredReferral\(apiPost\)/);
  assert.match(utils, /await claimStoredReferral\(apiPost\)/);
});

test("Refer a Friend cards: share link / they get $25 credit / you get $25 credit", () => {
  assert.deepEqual(REFERRAL_STEPS.map((s) => s.title + (s.highlight ?? "")), ["Share your link", "They get $25 credit", "You get $25 credit"]);
  assert.equal(REFERRAL_STEPS[1].body, "After their first payment for Starter, Pro or Elite, $25 comes off their next bill.");
  assert.equal(REFERRAL_STEPS[1].footnote, "New customers only.");
  assert.equal(REFERRAL_STEPS[2].body, "Once their first paid charge goes through (after any free trial), $25 comes off your next bill.");
});
