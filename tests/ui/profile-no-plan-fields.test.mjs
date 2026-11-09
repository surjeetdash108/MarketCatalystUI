// The app must never send plan, billing or identity fields to PATCH /api/profile.
// The backend strips them (InvestorProfilePatchDto), and plan state is written
// only by the Stripe webhook — the client sending `tier: "free"` implied it
// owned that field. Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const callers = ["app/auth/signup/signup-form.tsx", "app/auth/auth-utils.ts", "app/profile/edit/profile-edit-form.tsx"];
const SERVER_OWNED = /\b(tier|currentPlan|subscriptionStatus|subscriptionStartDate|subscriptionExpiryDate|featureFlags|stripeCustomerId|stripeSubId|uid)\s*:/;

/** Every object literal passed to apiPatch("/api/profile", { ... }). */
function profilePatchBodies(src) {
  const out = [];
  const re = /apiPatch(?:<[^>]*>)?\(\s*"\/api\/profile"\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, i = re.lastIndex;
    while (depth && i < src.length) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; i++; }
    out.push(src.slice(re.lastIndex, i - 1));
  }
  return out;
}

describe("profile writes carry profile fields only", () => {
  for (const file of callers) {
    it(`${file} sends no server-owned field to /api/profile`, () => {
      for (const body of profilePatchBodies(read(file))) {
        assert.doesNotMatch(body, SERVER_OWNED, `server-owned field in: ${body.trim()}`);
      }
    });
  }
  it("every /api/profile write goes through toProfilePatch, so a profile loaded from GET cannot echo plan fields back", () => {
    for (const file of callers) {
      const calls = read(file).match(/apiPatch(?:<[^>]*>)?\(\s*"\/api\/profile"\s*,\s*[^)]*/g) ?? [];
      assert.ok(calls.length > 0, `${file} has no profile write`);
      for (const c of calls) assert.match(c, /toProfilePatch\(/, `${file}: ${c}`);
    }
  });
  it("toProfilePatch keeps investor fields and drops server-owned ones", () => {
    const src = read("app/profile/profile-fields.tsx");
    const list = src.match(/PROFILE_PATCH_FIELDS = \[([^\]]*)\]/)[1];
    for (const k of ["name", "riskTolerance", "preferredAssetClasses", "profile_image"]) assert.match(list, new RegExp(`"${k}"`));
    for (const k of ["email", "tier", "currentPlan", "uid"]) assert.doesNotMatch(list, new RegExp(`"${k}"`));
  });
  it("signup and Google sign-in still create the profile", () => {
    const count = (f) => (read(f).match(/apiPatch(?:<[^>]*>)?\(\s*"\/api\/profile"/g) ?? []).length;
    assert.equal(count("app/auth/signup/signup-form.tsx"), 1);
    assert.equal(count("app/auth/auth-utils.ts"), 1);
  });
});
