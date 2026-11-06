// Item 7: Layer toggles reset when a different stock's popover opens.
// Run: node --test tests/ui/money-flow-layer-toggles-reset.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const screenSrc = fs.readFileSync(new URL("../../app/iq/screens/money-flow.tsx", import.meta.url), "utf8");

describe("Item 7: Layer toggles reset when opening a different stock", () => {
  it("defines DEFAULT_POP_LAYERS or resets layer toggles in applyPop on switching stocks", () => {
    assert.match(
      screenSrc,
      /setPopLayers\(\s*(?:DEFAULT_POP_LAYERS|{\s*ob:\s*true,\s*vwap:\s*true,\s*fvg:\s*false,\s*liq:\s*false,\s*str:\s*false,\s*pat:\s*false\s*})\s*\)/,
      "applyPop must reset popLayers when opening a different stock"
    );
  });
});
