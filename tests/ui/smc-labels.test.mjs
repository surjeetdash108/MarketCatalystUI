// Money Flow layers (Order blocks, VWAP, FVG, Liquidity, Structure, Patterns):
// labels go through one layout (declutterLabels) on both the pop-up's intraday
// SVG chart and its canvas Full Chart, instead of each drawing in place.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const svg = fs.readFileSync(new URL("../../app/iq/money-flow/chart-svg.tsx", import.meta.url), "utf8");
const cc = fs.readFileSync(new URL("../../app/iq/candle-chart.tsx", import.meta.url), "utf8");
const smc = cc.slice(cc.indexOf("function drawSmc("), cc.indexOf("function tag("));

describe("overlay labels never print over one another", () => {
  it("intraday chart: every layer label is collected and laid out once", () => {
    for (const k of ["zone", "ob_", "fvg_", "premium", "discount", "sw_", "bos_", "pp"]) assert.match(svg, new RegExp(`label\\(\\{ key: \`?"?${k}`), k);
    assert.match(svg, /declutterLabels\(chartLabels,/);
    assert.match(svg, /\.filter\(\(l\) => !l\.hidden\)/);
  });
  it("Full Chart (canvas): zone / line / swing labels are laid out once, clear of the pattern tags", () => {
    assert.doesNotMatch(smc, /fillText\(o\.label|fillText\(o\.text, x,/);
    assert.match(smc, /declutterLabels\(labels, \{ top: g\.top, bottom: g\.priceB/);
    assert.match(cc, /drawSmc\(ctx, m\.smc, "over", g, xOf, yOf, g\.w \/ span, pal\.font, patBoxes\)/);
  });
});
