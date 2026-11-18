// Index drawer (click S&P 500 / Nasdaq / … on the tape): the price and change
// sit to the right of the name and "Equity index · ~15 min delayed", in the
// header, not on their own line under it.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../../app/iq/shell.tsx", import.meta.url), "utf8");
const drawer = shell.slice(shell.indexOf('<div className="side-drawer index-side-drawer">'));
const head = drawer.slice(0, drawer.indexOf('<div className="drawer-b">'));
const body = drawer.slice(drawer.indexOf('<div className="drawer-b">'), drawer.indexOf('<div className="metric-grid">'));

describe("index drawer header", () => {
  it("the price and the change are in the header, after the name and subtitle", () => {
    assert.match(head, /\{sub\}[\s\S]*\{fmt\(x\.value, dec\)\}[\s\S]*\{arr\(x\.change\)\}/);
    assert.match(head, /className="idx-head-px"/);
  });
  it("the subtitle carries no delay note", () => {
    assert.doesNotMatch(head, /QUOTE_DELAY_LABEL|min delayed/);
  });
  it("every index and asset draws its own mark instead of a letter tile", () => {
    assert.match(head, /<AssetMark kind=\{assetKind\(x\.label\)!\} label=\{x\.label\} \/>/);
    for (const kind of ["bitcoin", "ethereum", "gold", "oil", "sp500", "nasdaq", "dow", "russell", "vix", "yield", "dollar"]) {
      assert.match(shell, new RegExp(`"${kind}"`), kind);
    }
  });
  it("has no Calendar button", () => {
    assert.doesNotMatch(drawer, /Go to Calendar/);
  });
  it("keeps the 'full analysis & technicals' button and opens the ticker through the shell's goToStock", () => {
    assert.match(drawer, /Open \{chartTicker\} full analysis & technicals/);
    assert.match(drawer, /onOpenStock\(chartTicker\)/);
    // The old button pushed /menu/stock?ticker=X; the Stock page never reads `ticker`, so it
    // opened on whichever stock was viewed last (someone else's data).
    assert.doesNotMatch(drawer, /menu\/stock\?ticker=/);
    // the shell must hand the drawer its goToStock
    assert.match(shell, /<IndexDrawer [^\n]*onOpenStock=\{goToStock\}/);
  });
  it("the body no longer repeats them above the metrics", () => {
    assert.doesNotMatch(body, /fmt\(x\.value, dec\)/);
  });
});
