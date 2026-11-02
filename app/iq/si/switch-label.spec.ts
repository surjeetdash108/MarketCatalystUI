import { describe, it } from "node:test";
import assert from "node:assert";
import { LABEL_TOP, switchLabel } from "./switch-label";

describe("module switch label", () => {
  it("is title case for every module, like Market Catalyst — never all caps", () => {
    assert.deepEqual(switchLabel("MC").words, ["Market", "Catalyst"]);
    assert.deepEqual(switchLabel("SI").words, ["Stock", "Intelligence"]);
    assert.deepEqual(switchLabel("SL").words, ["Strategy", "Lab"]);
    assert.deepEqual(switchLabel("MF").words, ["Money", "Flow"]);
    for (const m of ["MC", "SI", "SL", "MF"] as const) {
      const w = switchLabel(m).words.join(" ");
      assert.notEqual(w, w.toUpperCase(), m);
    }
  });
  it("uses Market Catalyst's type for every module and sits in the exact middle of the screen", () => {
    const mc = switchLabel("MC");
    for (const m of ["SI", "SL", "MF"] as const) {
      const l = switchLabel(m);
      assert.equal(l.font, mc.font);
      assert.equal(l.size, mc.size);
      assert.equal(l.weight, mc.weight);
      assert.equal(l.letterSpacing, mc.letterSpacing);
    }
    assert.equal(LABEL_TOP, "50%");
  });
});
