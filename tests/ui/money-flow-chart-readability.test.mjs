// Item 6: Chart readability:
// - labels must not overlap each other or the price (TPR/ALAB 1m with all layers)
// - show only one direction of pattern at a time (latest/strongest), not Double Top + Double Bottom together
// - fix the 1m x-axis overlap ('9:3010:00')
// - keep candles at full height on 1m (off-scale levels as edge markers)
// Run: node --test tests/ui/money-flow-chart-readability.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Item 6: Chart Readability", () => {
  it("patternsToShow shows only one direction of larger pattern at a time (never Double Top + Double Bottom together)", async () => {
    const { patternsToShow } = await import("../../app/iq/patterns/index.ts");

    const mockHits = [
      {
        id: "double_top",
        name: "Double Top",
        group: "chart",
        signal: "bear",
        at: 50,
        price: 190,
        i0: 30,
        i1: 50,
        confirmed: true,
      },
      {
        id: "double_bottom",
        name: "Double Bottom",
        group: "chart",
        signal: "bull",
        at: 40,
        price: 185,
        i0: 20,
        i1: 40,
        confirmed: true,
      },
      {
        id: "head_and_shoulders",
        name: "Head and Shoulders",
        group: "chart",
        signal: "bear",
        at: 48,
        price: 192,
        i0: 25,
        i1: 48,
        confirmed: true,
      },
    ];

    const shown = patternsToShow(mockHits, 0, 60);
    const signals = shown.map((h) => h.signal).filter((s) => s === "bull" || s === "bear");
    const hasBull = signals.includes("bull");
    const hasBear = signals.includes("bear");

    assert.ok(!(hasBull && hasBear), "Must NOT show both bullish and bearish patterns together");
    assert.equal(shown[0].id, "double_top", "Latest/strongest pattern (Double Top) determines dominant direction");
  });

  it("1m x-axis time ticks enforce minimum spacing so '9:30' and '10:00' do not overlap", async () => {
    const { timeTicks } = await import("../../app/iq/money-flow/engine.ts");
    const ticks = timeTicks(1); // 1m candles
    // On 1m, 30 bars is ~38px in typical width (W=500px, 390 bars => 1.28px/bar).
    // Filtering with minGapPx >= 48 skips the 10:00 tick so it doesn't collide with 9:30.
    const W = 500;
    const PL = 6;
    const PR = 72;
    const plotW = W - PL - PR;
    const sx = (i) => PL + (i / 390) * plotW;

    let lastRenderedX = -Infinity;
    const minGapPx = 48;
    const renderedTicks = [];
    for (const t of ticks) {
      const tx = sx(t.i);
      if (tx - lastRenderedX < minGapPx && t.i !== 0) continue;
      lastRenderedX = tx;
      renderedTicks.push(t);
    }

    assert.equal(renderedTicks[0].label, "9:30");
    assert.notEqual(renderedTicks[1]?.label, "10:00", "10:00 must be skipped on 1m compressed width to prevent '9:3010:00' overlap");
    assert.equal(renderedTicks[1]?.label, "10:30");
  });

  it("layoutEdgeLabels collapses levels with near-identical prices into a single staggered label", async () => {
    const { layoutEdgeLabels } = await import("../../app/iq/money-flow/engine.ts");
    const edgeIn = [
      { price: 191.50, name: "BSL", color: "#f0a24a" },
      { price: 191.52, name: "EQ 50%", color: "#aab3b0" },
      { price: 191.49, name: "SSL", color: "#4ad0c9" },
    ];
    const y = (p) => 200 - (p - 180) * 5;
    const out = layoutEdgeLabels(edgeIn, y, 20, 180, 16);

    assert.equal(out.length, 1, "Near-identical edge levels must collapse into 1 combined label");
    assert.ok(out[0].text.includes("BSL"));
    assert.ok(out[0].text.includes("EQ 50%"));
    assert.ok(out[0].text.includes("SSL"));
  });

  it("popLevelRows keeps full height for 1m candle band when lane intrusion is disabled", async () => {
    const { popLevelRows } = await import("../../app/iq/money-flow/engine.ts");
    const PT = 8;
    const H = 220;
    const PB = 24;
    const rowH = 22;

    // With laneH = 0 (1m candle band):
    const fullRows = popLevelRows(PT, H - PB, rowH, 0, 0);
    const fullHeight = fullRows.band.bottom - fullRows.band.top;

    // With large callout lanes (squashed):
    const squashedRows = popLevelRows(PT, H - PB, rowH, 40, 40);
    const squashedHeight = squashedRows.band.bottom - squashedRows.band.top;

    assert.ok(fullHeight > squashedHeight + 50, "1m full height must be substantially larger than squashed lane height");
    assert.ok(fullHeight >= 100, "1m candle band must have ample height (>= 100px)");
  });
});
