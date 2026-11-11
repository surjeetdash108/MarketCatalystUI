import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessModule } from "./module-switcher";

describe("ModuleSwitcher access by plan", () => {
  it("Starter has access to MC and SI only", () => {
    assert.equal(canAccessModule("MC", "starter"), true);
    assert.equal(canAccessModule("SI", "starter"), true);
    assert.equal(canAccessModule("MF", "starter"), false);
    assert.equal(canAccessModule("SL", "starter"), false);
  });

  it("Pro has access to MC, SI, and MF, but not SL", () => {
    assert.equal(canAccessModule("MC", "pro"), true);
    assert.equal(canAccessModule("SI", "pro"), true);
    assert.equal(canAccessModule("MF", "pro"), true);
    assert.equal(canAccessModule("SL", "pro"), false);
  });

  it("Elite has access to MC, SI, MF, and SL", () => {
    assert.equal(canAccessModule("MC", "elite"), true);
    assert.equal(canAccessModule("SI", "elite"), true);
    assert.equal(canAccessModule("MF", "elite"), true);
    assert.equal(canAccessModule("SL", "elite"), true);
  });

  it("Staff has access to all modules", () => {
    assert.equal(canAccessModule("MC", "staff"), true);
    assert.equal(canAccessModule("SI", "staff"), true);
    assert.equal(canAccessModule("MF", "staff"), true);
    assert.equal(canAccessModule("SL", "staff"), true);
  });

  it("Free / none has access to MC and SI only", () => {
    assert.equal(canAccessModule("MC", "none"), true);
    assert.equal(canAccessModule("SI", "none"), true);
    assert.equal(canAccessModule("MF", "none"), false);
    assert.equal(canAccessModule("SL", "none"), false);
  });
});

