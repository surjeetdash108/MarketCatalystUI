// The results panel's helper notes ("So far: over the 2 stocks that meet the
// rules so far · return 10D after each signal", "Showing the full 5Y backtest —
// …", the candle note, the run meta) were 11px grey and hard to read. They use
// one style: semibold, white in dark mode / near-black in light mode.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lightOf } from "../../app/iq/theme/module-theme.js";

const panels = fs.readFileSync(new URL("../../app/iq/sl/lab-panels.jsx", import.meta.url), "utf8");

describe("results notes are readable", () => {
  it("one NOTE style: semibold, 12px+, the white token (near-black in light mode)", () => {
    const m = panels.match(/const NOTE = \{([^}]*)\};/);
    assert.ok(m, "NOTE style");
    assert.match(m[1], /fontWeight: 600/);
    assert.match(m[1], /fontSize: 12/);
    assert.match(m[1], /color: "var\(--th-ffffff\)"/);
    assert.equal(lightOf("#ffffff"), "#212121");
  });
  it("every note uses it — none is the old grey", () => {
    assert.equal((panels.match(/<span style=\{NOTE\}>\{f\.candleNote\}<\/span>/g) || []).length, 2, "candle note (both places)");
    assert.match(panels, /<span style=\{\{ \.\.\.NOTE, marginLeft: "auto" \}\}>\{r\.meta\}<\/span>/);
    assert.match(panels, /<div style=\{\{ \.\.\.NOTE, display: "flex", alignItems: "center", gap: 6 \}\}>\s*\{r\.soFar[\s\S]{0,400}\{r\.sumNote\}/);
    assert.match(panels, /<span style=\{NOTE\}>\{r\.winNote\}<\/span>/);
  });
});
