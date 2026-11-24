import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// The "View all" drawers (Sector Momentum Intraday, Peers, Key levels…) are nested inside
// the stock screen. Any wrapper that zeroes `.drawer-b` padding for the stock screen
// zeroes theirs too, which pinned the rank numbers to the drawer's left edge. The
// stock opened from the Dashboard (`.drawer.wide`) was missed once; this fails if a
// wrapper zeroes the padding without the nested drawers getting their inset back.
const css = fs.readFileSync(path.join(process.cwd(), "app/iq.css"), "utf8");

describe("nested stock drawers keep their inset", () => {
  const zeroing = [...css.matchAll(/^([^\r\n{,]*?)\s*\.drawer-b\s*\{\s*padding:\s*0\s*;/gm)]
    .map(m => m[1].trim())
    .filter(prefix => prefix !== "");

  it("finds the wrappers that zero the body padding", () => {
    assert.ok(zeroing.includes(".stock-side-drawer"), "side-drawer wrapper not found");
    assert.ok(zeroing.includes(".drawer.wide"), "wide pop-up wrapper not found");
  });

  it("restores an inset for nested side drawers inside every one of them", () => {
    for (const wrapper of zeroing) {
      const override = new RegExp(
        `${wrapper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\.side-drawer \\.drawer-b[^{]*\\{\\s*padding:\\s*\\d+px (\\d+)px \\d+px`,
      ).exec(css);
      assert.ok(override, `${wrapper} zeroes .drawer-b padding but nested .side-drawer bodies get no inset back`);
      assert.ok(Number(override[1]) >= 24, `${wrapper}: side inset ${override[1]}px is too tight`);
    }
  });
});
