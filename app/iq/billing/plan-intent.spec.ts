import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkoutPath, currentIntent, loadIntent, nextAfterLogin, nextAfterSignup, parsePlanParams, saveIntent, type PlanIntent } from "./plan-intent";

const IDS = ["free", "starter", "pro", "elite"];
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const TILES: PlanIntent[] = ["starter", "pro", "elite"].flatMap((planId) => (["monthly", "annual"] as const).map((interval) => ({ planId, interval })));

describe("website tile → /choose-plan routing (all 6 plan/interval combinations)", () => {
  for (const t of TILES) {
    const mp = `/choose-plan?plan=${t.planId}&interval=${t.interval}`;
    it(`${t.planId} ${t.interval}`, () => {
      // Signed out → sign up with email: straight to /choose-plan with intent
      assert.equal(nextAfterSignup(t, "password"), `${mp}&onboarding=1`);
      // Signed out → sign up with Google (already verified): straight to /choose-plan with intent
      assert.equal(nextAfterSignup(t, "google"), `${mp}&onboarding=1`);
      // Existing account signs in (email or Google): straight to /choose-plan with intent
      assert.equal(nextAfterLogin(t, "/dashboard"), mp);
      // The tile link carries the intent; it survives the Google redirect via sessionStorage.
      const s = mem();
      const fromUrl = parsePlanParams(`?plan=${t.planId}&interval=${t.interval}`, IDS);
      assert.deepEqual(fromUrl, t);
      saveIntent(fromUrl, s);
      assert.deepEqual(currentIntent("", IDS, s), t);
    });
  }

  it("plain signup (no intent) → dashboard; plain login → its usual home", () => {
    assert.equal(nextAfterSignup(null, "password"), "/dashboard");
    assert.equal(nextAfterSignup(null, "google"), "/dashboard");
    assert.equal(nextAfterLogin(null, "/admin"), "/admin");
  });

  it("invalid params are no intent; no interval means annual", () => {
    assert.equal(parsePlanParams("?plan=plus&interval=monthly", IDS), null);
    assert.equal(parsePlanParams("?plan=pro&interval=weekly", IDS), null);
    assert.deepEqual(parsePlanParams("?plan=PRO", IDS), { planId: "pro", interval: "annual" });
  });
});
