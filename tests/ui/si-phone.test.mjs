// Stock Intelligence on a phone (≤760px): the masthead (identity, price, market cap, P/E, 52-week
// range) wraps with tighter padding and a smaller price, the page padding shrinks, and the tab rail
// stops sticking.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/si/stock-intelligence.tsx", import.meta.url), "utf8");
const redesign = fs.readFileSync(new URL("../../app/iq/si/si-redesign-css.ts", import.meta.url), "utf8");
const css = (src.match(/@media \(max-width: 760px\) \{([\s\S]*?)\n        \}/) || [])[1] || "";

describe("Stock Intelligence phone layout", () => {
  it("one ≤760px block", () => assert.ok(css.length > 0));
  it("masthead: tighter padding, a smaller price, tabs with less side padding", () => {
    assert.match(redesign, /@media \(max-width:760px\)\{\.ovx-mast\{padding:14px 12px;gap:16px 24px\}\.ovx-price\{font-size:28px\}\.ovx-tabs\{padding:7px 12px\}\}/);
    assert.match(src, /<SiMasthead\b/);
  });
  it("page padding shrinks and the tab rail stops sticking", () => {
    assert.match(css, /\.si-main \{ padding: 14px 12px 100px !important; \}/);
    assert.match(css, /\.si-tabrail \{ position: static !important; \}/);
    assert.match(src, /className="si-main"/);
  });
});
