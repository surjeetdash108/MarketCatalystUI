import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { periodOf, valCfg } from "../../app/iq/sl/lab-config.js";

const controllerSrc = fs.readFileSync(new URL("../../app/iq/sl/lab-controller.jsx", import.meta.url), "utf8");

describe("Strategy Lab default run duration is 1Y", () => {
  it("lab-controller defaults yrs to 1 in defaultCfg", () => {
    assert.match(
      controllerSrc,
      /defaultCfg\([^)]*\)[\s\S]*?yrs:\s*"1"/,
      "defaultCfg must default yrs to 1"
    );
  });

  it("lab-config periodOf defaults to 1 year when yrs is empty or unstated", () => {
    assert.deepEqual(periodOf({}, "d"), { years: 1 });
    assert.equal(valCfg({}, "d").years, 1);
  });
});
