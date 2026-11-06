// Item 5: Tile "vs sector" must use the same sector the board groups the stock in
// (TPR tile implies Consumer Defensive, board has Retail Trade; LITE/LRCX/ROK vs Producer Manufacturing).
// Run: node --test tests/ui/money-flow-tile-vs-sector.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Item 5: Tile vs sector consistency with board grouped sector", () => {
  it("withSectorLabels recomputes vsSector using the stock's grouped sector avgPct on the board", async () => {
    const { withSectorLabels, computeSquarifiedTiles } = await import("../../app/iq/money-flow/engine.ts");

    const rawBoard = {
      sectors: [
        { name: "Retail Trade", netFlow: 1000000, inflow: 2000000, outflow: 1000000, buyPct: 54, avgPct: -2.13, count: 19 },
        { name: "Producer Manufacturing", netFlow: 1300000, inflow: 2500000, outflow: 1200000, buyPct: 56, avgPct: -4.69, count: 32 },
        { name: "Consumer Non-Durables", netFlow: 400000, inflow: 1000000, outflow: 600000, buyPct: 55, avgPct: -0.80, count: 29 },
      ],
      gainers: [
        // TPR grouped under Retail Trade on the board, but backend sent vsSector +7.18 (against Consumer Non-Durables)
        { t: "TPR", name: "Tapestry", sector: "Retail Trade", pctChange: 6.38, price: 60.0, prevClose: 56.4, vsSector: 7.18 },
      ],
      losers: [
        // LITE, LRCX, ROK grouped under Producer Manufacturing (-4.69%), but backend sent vsSector against Electronic Technology
        { t: "LITE", name: "Lumentum", sector: "Producer Manufacturing", pctChange: -15.62, price: 70.0, prevClose: 82.96, vsSector: -7.75 },
        { t: "LRCX", name: "Lam Research", sector: "Producer Manufacturing", pctChange: -14.39, price: 75.0, prevClose: 87.61, vsSector: -6.52 },
        { t: "ROK", name: "Rockwell", sector: "Producer Manufacturing", pctChange: -13.76, price: 250.0, prevClose: 289.9, vsSector: -5.89 },
      ],
    };

    const board = withSectorLabels(rawBoard);

    const tpr = board.gainers.find((s) => s.t === "TPR");
    assert.equal(tpr?.sector, "Retail Trade");
    assert.equal(tpr?.vsSector, 8.51, "TPR vsSector must be 6.38 - (-2.13) = +8.51%");

    const lite = board.losers.find((s) => s.t === "LITE");
    assert.equal(lite?.vsSector, -10.93, "LITE vsSector must be -15.62 - (-4.69) = -10.93%");

    const lrcx = board.losers.find((s) => s.t === "LRCX");
    assert.equal(lrcx?.vsSector, -9.70, "LRCX vsSector must be -14.39 - (-4.69) = -9.70%");

    const rok = board.losers.find((s) => s.t === "ROK");
    assert.equal(rok?.vsSector, -9.07, "ROK vsSector must be -13.76 - (-4.69) = -9.07%");

    // Verify tile layout reflects this:
    const gTiles = computeSquarifiedTiles(
      [
        { t: "D1", pctChange: 10, price: 10, prevClose: 9 },
        { t: "D2", pctChange: 9, price: 10, prevClose: 9 },
        { t: "D3", pctChange: 8, price: 10, prevClose: 9 },
        tpr,
      ],
      true
    );
    const tprTile = gTiles.find((tile) => tile.t === "TPR");
    assert.equal(tprTile?.rsTxt, "+8.51%");
  });
});
