import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkoutPath, currentIntent, loadIntent, nextAfterLogin, nextAfterSignup, parsePlanParams, saveIntent, type PlanIntent } from "./plan-intent";

const IDS = ["free", "starter", "pro", "elite"];
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const TILES: PlanIntent[] = ["starter", "pro", "elite"].flatMap((planId) => (["monthly", "annual"] as const).map((interval) => ({ planId, interval })));

describe("website tile → /checkout routing (all 6 plan/interval combinations)", () => {
  for (const t of TILES) {
    const co = `/checkout?plan=${t.planId}&interval=${t.interval}`;
    it(`${t.planId} ${t.interval}`, () => {
      assert.equal(checkoutPath(t), co);
      // Signed out → sign up with email: verify first, then straight to checkout (no plan choice in between).
      assert.equal(nextAfterSignup(t, "password", true), `/verify-email?next=${encodeURIComponent(co)}`);
      // Signed out → sign up with Google (already verified).
      assert.equal(nextAfterSignup(t, "google", true), co);
      // Existing account signs in (email or Google).
      assert.equal(nextAfterLogin(t, "/dashboard", true), co);
      // The tile link carries the intent; it survives the Google redirect via sessionStorage.
      const s = mem();
      const fromUrl = parsePlanParams(`?plan=${t.planId}&interval=${t.interval}`, IDS);
      assert.deepEqual(fromUrl, t);
      saveIntent(fromUrl, s);
      assert.deepEqual(currentIntent("", IDS, s), t);
    });
  }

  it("plain signup (no intent) → Free → dashboard; plain login → its usual home", () => {
    assert.equal(nextAfterSignup(null, "password", true), "/dashboard");
    assert.equal(nextAfterSignup(null, "google", true), "/dashboard");
    assert.equal(nextAfterLogin(null, "/admin", true), "/admin");
  });

  it("paid plans unavailable (flag off / no provider): dashboard (banner), intent kept", () => {
    const t = TILES[3];
    const s = mem();
    saveIntent(t, s);
    assert.equal(nextAfterSignup(t, "password", false), "/dashboard");
    assert.equal(nextAfterSignup(t, "google", false), "/dashboard");
    assert.equal(nextAfterLogin(t, "/dashboard", false), "/dashboard");
    assert.deepEqual(loadIntent(IDS, s), t);
  });

  it("invalid params are no intent; no interval means annual", () => {
    assert.equal(parsePlanParams("?plan=plus&interval=monthly", IDS), null);
    assert.equal(parsePlanParams("?plan=pro&interval=weekly", IDS), null);
    assert.deepEqual(parsePlanParams("?plan=PRO", IDS), { planId: "pro", interval: "annual" });
  });
});
