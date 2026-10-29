import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  boardCandles,
  computeSquarifiedTiles,
  etClock,
  formatCompactDollars,
  formatMarketCap,
  formatPct,
  indexCard,
  sectorNotOnBoardText,
  sectorView,
  sessionCandles,
  type MoneyFlowBoard,
} from "./engine";

/**
 * Fixture (real, 2026-10-29 ~13:30 ET): the board GET /live/money-flow built
 * from Polygon + FMP (movers trimmed to 6 a side), and Polygon's own 1-minute
 * and 5-minute AAPL bars for the same session.
 */
const fx = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures/money-flow-2026-10-29.json"), "utf-8"),
);
const board: MoneyFlowBoard = fx.board;

describe("Money Flow view helpers", () => {
  it("formats flows and market caps up to trillions", () => {
    assert.strictEqual(formatCompactDollars(840_000_000), "+$840M");
    assert.strictEqual(formatCompactDollars(-2_400_000_000), "−$2.4B");
    assert.strictEqual(formatMarketCap(5_109_400_000_000), "$5.11T");
    assert.strictEqual(formatMarketCap(75_300_000_000), "$75.3B");
    assert.strictEqual(formatMarketCap(null), "—");
    assert.strictEqual(formatPct(-0.96), "−0.96%");
  });

  it("index cards show a dash, not a made-up level, when the tape has no value", () => {
    assert.deepStrictEqual(indexCard(undefined, String), { px: "—", chg: "—", isUp: null });
    assert.deepStrictEqual(indexCard({ value: 7714.48, pctChange: -0.38 }, (v) => v.toFixed(2)), {
      px: "7714.48",
      chg: "-0.38%",
      isUp: false,
    });
  });

  it("5-minute candles grouped from Polygon 1-minute bars equal Polygon's own 5-minute bars", () => {
    const mine = sessionCandles(fx.aapl1m, board.sessionDate, 5);
    const theirs = (fx.aapl5m as Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>).filter(
      (b) => {
        const { date, minutes } = etClock(b.t);
        return date === board.sessionDate && minutes >= 570 && minutes < 960;
      },
    );
    const n = Math.min(mine.length, theirs.length) - 1; // the last bar may still be forming
    assert.ok(n > 40);
    for (let i = 0; i < n; i++) {
      assert.strictEqual(mine[i].t, theirs[i].t);
      assert.strictEqual(mine[i].o, theirs[i].o);
      assert.strictEqual(mine[i].h, theirs[i].h);
      assert.strictEqual(mine[i].l, theirs[i].l);
      assert.strictEqual(mine[i].c, theirs[i].c);
      assert.ok(Math.abs(mine[i].v / theirs[i].v - 1) < 0.01, `volume bar ${i}`);
    }
  });

  it("15-minute candles start on the quarter hour from 9:30", () => {
    const c = sessionCandles(fx.aapl1m, board.sessionDate, 15);
    assert.deepStrictEqual(
      c.slice(0, 3).map((b) => etClock(b.t).minutes),
      [570, 585, 600],
    );
  });

  it("outflow boxes hold only sectors with negative net flow, inflow boxes only positive", () => {
    const v = sectorView(board.sectors);
    assert.ok(v.top2Inflow.length > 0 && v.top2Inflow.every((s) => s.flowVal > 0));
    assert.ok(v.top2Outflow.length > 0 && v.top2Outflow.every((s) => s.flowVal < 0));
    assert.strictEqual(v.top2Outflow[0].flowVal, Math.min(...board.sectors.map((s) => s.netFlow)));
    assert.strictEqual(v.remaining.length + v.top2Inflow.length + v.top2Outflow.length, board.sectors.length);
    // One-sided day: every sector positive → no outflow box.
    const allUp = board.sectors.map((s) => ({ ...s, netFlow: Math.abs(s.netFlow) + 1 }));
    assert.strictEqual(sectorView(allUp).top2Outflow.length, 0);
  });

  it("sectors are the board's (the app's), not a hardcoded list", () => {
    const names = board.sectors.map((s) => s.name);
    for (const s of [...board.gainers, ...board.losers]) {
      if (s.sector) assert.ok(names.includes(s.sector), s.sector);
    }
    assert.ok(!names.includes("Consumer Defensive"));
  });

  it("tiles read the board's own vs-sector, 30m, RVOL and confidence", () => {
    const items = board.gainers.slice(3);
    const tiles = computeSquarifiedTiles(items, true);
    tiles.forEach((tile, i) => {
      const s = items[i];
      assert.strictEqual(tile.conf, s.confidence?.score ?? null);
      assert.strictEqual(tile.chg, formatPct(s.pctChange));
      if (s.vsSector != null) assert.ok(tile.rsTxt.endsWith(`${Math.abs(s.vsSector).toFixed(2)}%`));
      if (s.m30 != null) assert.ok(tile.m30.endsWith(`${Math.abs(s.m30).toFixed(2)}%`));
      if (s.rvol != null) assert.strictEqual(tile.volx, `${s.rvol.toFixed(1)}×`);
    });
  });

  it("board candles carry the session VWAP and real volume", () => {
    const s = board.losers[0];
    const c = boardCandles(s);
    assert.strictEqual(c.length, s.bars.length);
    assert.ok(c.every((b) => b.v > 0 && b.vw > 0));
    assert.strictEqual(c[c.length - 1].vw, s.vwap);
  });

  it("flags a highlighted sector with no stock on the boards", () => {
    const shown = new Set([...board.gainers, ...board.losers].map((s) => s.sector));
    const absent = board.sectors.find((s) => !shown.has(s.name))!;
    assert.match(sectorNotOnBoardText(absent.name, board.sectors, [...board.gainers, ...board.losers]), /counted in the sector flow only/);
    const present = board.gainers[0].sector!;
    assert.strictEqual(sectorNotOnBoardText(present, board.sectors, board.gainers), "");
  });

  it("ET clock is DST-aware (EST from Nov 1, 2026)", () => {
    assert.deepStrictEqual(etClock(Date.parse("2026-11-02T14:30:00Z")), { date: "2026-11-02", minutes: 570 });
    assert.deepStrictEqual(etClock(Date.parse("2026-10-29T13:30:00Z")), { date: "2026-10-29", minutes: 570 });
  });
});
