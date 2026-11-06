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
    assert.match(head, /\{sub\} · \{QUOTE_DELAY_LABEL\}[\s\S]*\{fmt\(x\.value, dec\)\}[\s\S]*\{arr\(x\.change\)\}/);
    assert.match(head, /className="idx-head-px"/);
  });
  it("the body no longer repeats them above the metrics", () => {
    assert.doesNotMatch(body, /fmt\(x\.value, dec\)/);
  });
});
