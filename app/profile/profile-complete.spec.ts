import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProfileIncomplete } from "./profile-fields";

describe("profile completeness follows the Edit Profile form", () => {
  it("name + age saved → complete, even with the hidden investor fields empty", () => {
    const saved = { name: "Sample User", age: "25", incomeRange: "", riskTolerance: "", preferredAssetClasses: [] as string[] };
    assert.equal(isProfileIncomplete(saved), false);
  });
  it("a missing name or age → incomplete", () => {
    assert.equal(isProfileIncomplete({ name: "Sample User", age: "" }), true);
    assert.equal(isProfileIncomplete({ name: " ", age: "25" }), true);
    assert.equal(isProfileIncomplete(null), true);
  });
});

describe("one completeness rule everywhere", () => {
  it("Settings and the My Profile 'Pending' pill both use isProfileIncomplete", async () => {
    const fs = await import("node:fs");
    for (const f of ["app/iq/screens/settings.tsx", "app/iq/shell.tsx"]) {
      const src = fs.readFileSync(f, "utf8");
      assert.match(src, /isProfileIncomplete\(profile\)/, f);
      assert.doesNotMatch(src, /"incomeRange",\s*"investmentExperience"/, f);
    }
  });
});
