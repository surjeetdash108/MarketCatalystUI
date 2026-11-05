import { describe, it } from "node:test";
import assert from "node:assert";
import { AUTH_HINT_KEY, gateDecision, readAuthHint, showLoginBeforeAuthReady, writeAuthHint } from "./auth-gate";

/** In-memory stand-in for localStorage. */
function store(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}
const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };

describe("login gate: a signed-in user never sees the login form", () => {
  it("the form may render before Firebase restores the session only when this browser last saw a sign-out", () => {
    assert.equal(showLoginBeforeAuthReady("out"), true);
    assert.equal(showLoginBeforeAuthReady("in"), false, "signed in last time: wait, or the form flashes before /dashboard");
    assert.equal(showLoginBeforeAuthReady(null), false, "unknown (first visit, cleared storage): wait");
  });
  it("once Firebase knows: a user goes to their home (admin → /admin, everyone else → /dashboard); no user sees the form", () => {
    assert.deepEqual(gateDecision({ email: "someone@example.com" }), { kind: "redirect", to: "/dashboard" });
    assert.deepEqual(gateDecision({ email: "admin@marketcatalyst.ai" }), { kind: "redirect", to: "/admin" });
    assert.deepEqual(gateDecision(null), { kind: "login" });
  });
});

describe("auth hint in localStorage", () => {
  it("records the last auth state this browser saw, and reads it back", () => {
    const s = store();
    assert.equal(readAuthHint(s), null);
    writeAuthHint(true, s);
    assert.equal(s.m.get(AUTH_HINT_KEY), "in");
    assert.equal(readAuthHint(s), "in");
    writeAuthHint(false, s);
    assert.equal(readAuthHint(s), "out");
  });
  it("an unknown value or blocked storage reads as unknown (the gate then waits for Firebase)", () => {
    assert.equal(readAuthHint(store({ [AUTH_HINT_KEY]: "maybe" })), null);
    assert.equal(readAuthHint(throwing), null);
    assert.doesNotThrow(() => writeAuthHint(true, throwing));
  });
});
