// The module switcher (Market Catalyst · Stock Intelligence · Strategy Lab ·
// Money Flow) needs ~420px; on a narrower phone it scrolls sideways with the
// active module centred, instead of clipping "Money Flow" off the edge.
// Run: node --test tests/ui/
import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/module-switcher.tsx", import.meta.url), "utf8");
it("the pill scrolls sideways (no scrollbar) and centres the active module", () => {
  assert.match(src, /overflowX: "auto",\s*scrollbarWidth: "none",/);
  assert.match(src, /g\.scrollLeft = el\.offsetLeft - \(g\.clientWidth - el\.offsetWidth\) \/ 2;/);
});
