// Strategy Lab on a phone (≤640px): the results table becomes stacked cards with
// labelled numbers, the strategy library stacks above the selected strategy, and
// nothing is wider than the screen.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LAB_MOBILE_CSS } from "../../app/iq/sl/lab-mobile.js";

const read = (f) => fs.readFileSync(new URL("../../app/iq/sl/" + f, import.meta.url), "utf8");
const panels = read("lab-panels.jsx"), view = read("lab-view.jsx"), ctl = read("lab-controller.jsx"), screen = read("strategy-lab-screen.tsx");
const phone = (LAB_MOBILE_CSS.match(/@media \(max-width:640px\)\{([\s\S]*)\}$/) || [])[1] || "";
const rule = (sel) => (phone.match(new RegExp("(?:^|\\})" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}")) || [])[1] || "";

describe("Strategy Lab phone layout", () => {
  it("the phone rules are one ≤640px media block on the Lab page", () => {
    assert.ok(phone.length > 0, "no @media (max-width:640px) block");
    assert.match(ctl, /LAB_MOBILE_CSS/);
  });

  it("results: the column header row is hidden and each row is a card — stock + price on top, four numbers below", () => {
    assert.match(rule(".sl-res-hdr"), /display:none/);
    assert.match(rule(".sl-res-row"), /grid-template-columns:(minmax\(0,[\d.]+fr\) ?){4} !important/);
    assert.match(rule(".sl-res-stat"), /white-space:nowrap/, "a number like '41 + 1 open' must not wrap under its label");
    assert.match(rule(".sl-res-stock"), /grid-column:1 \/ 4/);
    assert.match(rule(".sl-res-px"), /grid-column:4/);
    assert.match(panels, /className="sl-res-hdr"/);
    assert.match(panels, /className="slx7 sl-res-row"/);
    assert.match(panels, /className="sl-res-stock"/);
    assert.match(panels, /className="sl-res-px"/);
  });

  it("results: each number carries its column name as a label on the phone", () => {
    assert.match(rule(".sl-res-stat::before"), /content:attr\(data-l\)/);
    for (const [i, v] of [[2, "x.ret"], [3, "x.ex"], [4, "x.win"], [5, "x.tr"]])
      assert.match(panels, new RegExp(`className="sl-res-stat" data-l=\\{r\\.cols\\[${i}\\]\\.l\\}[^>]*>\\{${v.replace(".", "\\.")}\\}`), `column ${i} (${v}) has no label`);
  });

  it("library: the strategy list stacks above the selected strategy instead of a fixed 220px side column", () => {
    assert.match(rule(".sl-lib-grid"), /grid-template-columns:minmax\(0,1fr\)/);
    assert.match(rule(".sl-lib-side"), /position:static/);
    assert.match(view, /className="sl-lib-grid"/);
    assert.match(view, /className="sl-lib-side"/);
  });

  it("page, strategy box and pop-up padding shrink so the content gets the width", () => {
    for (const sel of [".sl-pad", ".sl-box", ".sl-res-box", ".sl-modal"]) assert.match(rule(sel), /padding:/, sel);
    assert.match(ctl, /className="sl-pad"/);
    assert.match(view, /className="sl-box"/);
    assert.match(panels, /className=\{boxed \? "sl-res-box" : undefined\}/);
    assert.match(panels, /className="sl-modal"/);
  });

  it("pop-up: the close button sits in the top-right corner instead of wrapping onto its own line", () => {
    assert.match(rule(".sl-modal"), /position:relative/);
    assert.match(rule(".sl-modal-x"), /position:absolute/);
    assert.match(panels, /title="Close" className="sl-modal-x"/);
  });

  it("pop-up trade list scrolls sideways rather than squeezing seven columns", () => {
    assert.match(rule(".sl-trades"), /overflow-x:auto/);
    assert.match(rule(".sl-trades>div"), /min-width:/);
    assert.match(panels, /className="sl-trades"/);
  });

  it("report: the two side-by-side cards never ask for more than the screen width", () => {
    assert.doesNotMatch(panels, /minmax\(340px,1fr\)/);
    assert.match(panels, /minmax\(min\(100%,340px\),1fr\)/);
  });

  it("header: the right-hand slot (theme switch) moves to the top-right corner on the phone", () => {
    assert.match(screen, /className="sl-hdr-right"/);
    assert.match(screen, /@media \(max-width:640px\)\{\.sl-hdr-right\{position:absolute;top:10px;right:14px;width:auto !important\}\}/);
  });
});
