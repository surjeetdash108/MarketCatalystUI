import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { afterLoginPath, afterSignupPath, loadIntent, managePlanPath, parsePlanParams, saveIntent } from "./plan-intent";

const IDS = ["free", "starter", "pro", "elite"];
function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("signup preselection from website tiles", () => {
  for (const plan of ["starter", "pro", "elite"]) {
    for (const interval of ["monthly", "annual"] as const) {
      it(`?plan=${plan}&interval=${interval} preselects ${plan} ${interval}`, () => {
        assert.deepEqual(parsePlanParams(`?plan=${plan}&interval=${interval}`, IDS), { planId: plan, interval });
      });
    }
  }
  it("defaults to annual (the website's default view) when interval is absent", () => {
    assert.deepEqual(parsePlanParams("?plan=pro", IDS), { planId: "pro", interval: "annual" });
  });
  it("invalid params mean no preselection", () => {
    for (const q of ["?plan=foo", "?plan=plus", "?plan=pro&interval=weekly", "", "?interval=annual"]) assert.equal(parsePlanParams(q, IDS), null, q);
  });
  it("the choice survives a Google redirect via sessionStorage, and decides where the user lands", () => {
    const s = mem();
    saveIntent({ planId: "elite", interval: "monthly", promoCode: "WELCOME10" }, s);
    assert.deepEqual(loadIntent(IDS, s), { planId: "elite", interval: "monthly", promoCode: "WELCOME10" });
    assert.equal(afterSignupPath("/dashboard", s), "/billing/start");
    assert.equal(afterLoginPath("/dashboard", s), "/manage-plan?plan=elite&interval=monthly");
    saveIntent(null, s);
    assert.equal(afterSignupPath("/dashboard", s), "/dashboard");
    assert.equal(managePlanPath({ planId: "pro", interval: "annual" }), "/manage-plan?plan=pro&interval=annual");
  });
  it("rejects a tampered stored intent", () => {
    const s = mem();
    s.setItem("mc:plan-intent", JSON.stringify({ planId: "plus", interval: "monthly" }));
    assert.equal(loadIntent(IDS, s), null);
  });
});
