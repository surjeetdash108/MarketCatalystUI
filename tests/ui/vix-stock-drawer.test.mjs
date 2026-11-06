// Calendar → VIX-sensitive stocks → click a row: the drawer shows the stock
// (live quote + the stock page's price chart) first, then the dividend block.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const macro = fs.readFileSync(new URL("../../app/iq/screens/macro.tsx", import.meta.url), "utf8");
const drawer = macro.slice(macro.indexOf("function DividendDrawer("), macro.indexOf("function DividendDrawer(") + 6000);

describe("VIX-sensitive row → stock first, then dividends", () => {
  it("the drawer can show the stock's chart card before the dividend metrics", () => {
    assert.match(drawer, /showStock/);
    const chart = drawer.indexOf("<ChartCard sym={stock.sym}");
    assert.ok(chart > 0, "ChartCard in the drawer");
    assert.ok(chart < drawer.indexOf("Latest payment"), "before Latest payment");
    assert.ok(chart < drawer.indexOf("does not currently pay a dividend"), "before the no-dividend note");
  });
  it("a VIX-sensitive row opens it with the stock shown", () => {
    assert.match(macro, /<DividendDrawer stock=\{vixSel\} showStock onClose=/);
  });
});

describe("VIX-sensitive drawer is 2.5× the normal drawer", () => {
  const css = fs.readFileSync(new URL("../../app/iq.css", import.meta.url), "utf8");
  it("the base drawer is 520px; the VIX stock drawer 1300px (2.5×), never wider than the screen", () => {
    assert.match(css, /\.side-drawer \{[^}]*width: min\(520px, 96vw\);/);
    assert.match(css, /\.side-drawer\.vix-stock-drawer \{\s*width: min\(1300px, 96vw\);\s*\}/);
  });
  it("only the VIX-sensitive (showStock) drawer gets the wide class", () => {
    assert.match(drawer, /className=\{showStock \? "side-drawer vix-stock-drawer" : "side-drawer"\}/);
  });
});
