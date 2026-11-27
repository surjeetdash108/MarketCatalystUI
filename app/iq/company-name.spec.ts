import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasCompanyName } from "./company-name";

describe("hasCompanyName", () => {
  it("is true for a real name", () => {
    assert.equal(hasCompanyName("Banco Bradesco S.A.", "BBD"), true);
    assert.equal(hasCompanyName("Accelevation Corp", "ACCV"), true);
  });
  it("is false when the name is just the ticker (the fallback), however it is cased or spaced", () => {
    assert.equal(hasCompanyName("CSQR", "CSQR"), false);
    assert.equal(hasCompanyName("csqr", "CSQR"), false);
    assert.equal(hasCompanyName(" CSQR ", "CSQR"), false);
  });
  it("is false when there is no name at all", () => {
    assert.equal(hasCompanyName("", "CSQR"), false);
    assert.equal(hasCompanyName("   ", "CSQR"), false);
    assert.equal(hasCompanyName(null, "CSQR"), false);
    assert.equal(hasCompanyName(undefined, "CSQR"), false);
  });
  it("a name that merely contains the ticker is still a name", () => {
    assert.equal(hasCompanyName("CSQR Holdings", "CSQR"), true);
  });
});
