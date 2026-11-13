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
