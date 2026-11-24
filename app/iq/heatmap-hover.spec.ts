import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// The heatmap's hover card is the old pop-up again: the hovered stock's details,
// then EVERY stock in its sector (largest first, the hovered one highlighted),
// with no bar after the percentage. Source checks, like the repo's other screen
// specs: the card needs the whole screen's state to render.
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const src = read("app/iq/screens/heatmap.tsx");
const css = read("app/iq.css");

describe("heatmap hover card", () => {
  it("lists the whole sector, not only the tiles that are big enough to draw", () => {
    // groups[].stocks holds every stock in the sector, including the ones bundled into "+N more".
    assert.match(src, /groups\.find\(g => g\.name === hov\.sector\)\?\.stocks/);
    assert.match(src, /\.sort\(\(a, b\) => b\.mcap - a\.mcap\)/);
    assert.match(src, /<PeerRow key=\{p\.sym\}/);
  });

  it("highlights the hovered stock's own row", () => {
    assert.match(src, /hi=\{p\.sym === hover\.sym\}/);
    assert.match(src, /hpop-row-hi/);
  });

  it("shows the stock's details above the list", () => {
    for (const label of ["Mkt Cap", "Price", "RVOL", "RS Rating"]) {
      assert.ok(src.includes(`<span>${label}</span>`), `missing ${label}`);
    }
  });

  it("has no bar after the percentage", () => {
    assert.ok(!src.includes("hpop-bar"));
    assert.ok(!css.includes("hpop-bar"));
  });

  it("can be scrolled and clicked: leaving a tile only starts a delay the card cancels", () => {
    assert.match(src, /onMouseEnter=\{cancelHover\} onMouseLeave=\{hideHover\}/);
    assert.match(src, /setTimeout\(\(\) => setHover\(null\), 200\)/);
    assert.match(src, /overflowY: "auto"/);
  });

  it("only offers 'Open sector heatmap' on the all-sectors map", () => {
    assert.match(src, /\{isOverall && <span className="link"[^>]*>Open sector heatmap →<\/span>\}/);
  });

  it("the old one-stock card is gone", () => {
    assert.ok(!src.includes("hm2-tip"));
    assert.ok(!css.includes("hm2-tip"));
  });
});
