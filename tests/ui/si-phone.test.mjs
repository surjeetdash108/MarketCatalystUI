// Stock Intelligence on a phone (≤760px): the header's five stats stack under
// the name in two columns (they were crushed to one character a line), the
// price-history range buttons wrap, and catalyst rows stack.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/si/stock-intelligence.tsx", import.meta.url), "utf8");
const css = (src.match(/@media \(max-width: 760px\) \{([\s\S]*?)\n        \}/) || [])[1] || "";

describe("Stock Intelligence phone layout", () => {
  it("one ≤760px block", () => assert.ok(css.length > 0));
  it("header: identity on its own row, stats two per row", () => {
    assert.match(css, /\.si-hero \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important; \}/);
    assert.match(css, /\.si-hero-id \{ grid-column: 1 \/ -1; min-width: 0 !important;/);
    for (const c of ["si-hero", "si-hero-id", "si-hero-stat"]) assert.match(src, new RegExp(`className="${c}"`), c);
  });
  it("price history header wraps; catalyst rows stack; page padding shrinks", () => {
    assert.match(css, /\.si-ph-head \{ height: auto !important; flex-wrap: wrap;/);
    assert.match(css, /\.si-cat-row \{ grid-template-columns: minmax\(0, 1fr\) !important;/);
    assert.match(css, /\.si-main \{ padding: 14px 12px 100px !important; \}/);
    for (const c of ["si-ph-head", "si-cat-row", "si-cat-imp", "si-main"]) assert.match(src, new RegExp(`className="${c}"`), c);
  });
});
