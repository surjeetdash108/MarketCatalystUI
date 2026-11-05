import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fullChartInterval } from "./smc";
import {
  boardCandles,
  computeSquarifiedTiles,
  etClock,
  formatCompactDollars,
  formatMarketCap,
  formatPct,
  indexCard,
  popoverChartWidth,
  popoverLiveScroll,
  popoverPlacement,
  popoverScale,
  popoverStats,
  popoverWidth,
  POPOVER,
  chartRightGutter,
  popoverButtons,
  popChartModes,
  POP_TIMEFRAMES,
  popTimeframes,
  formatRvol,
  phaseTag,
  RVOL_HEAVY,
  flowsLagLabel,
  cardLevels,
  BOARD_HEADINGS,
  zoomIntradayView,
  panIntradayView,
  fullSessionView,
  POP_STAT_VALUE_STYLE,
  popTfLabel,
  popTfForMode,
  chartFrame,
  extendedPivots,
  liveLevels,
  popLevelRows,
  layoutEdgeLabels,
  calloutLaneRows,
  levelTag,
  computeFvgs,
  popText,
  POP_MIN_TEXT_PX,
  timeTicks,
  popoverNext,
  popoverKey,
  popoverInteractive,
  formatCurrency,
  formatLevel,
  sectorNotOnBoardText,
  sectorView,
  withSectorLabels,
  sectorRowTitle,
  TOP_SECTORS,
  SECTOR_BOX_SIZE,
  SECTOR_NAME_STYLE,
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
    assert.ok(v.topInflow.length > 0 && v.topInflow.every((s) => s.flowVal > 0));
    assert.ok(v.topOutflow.length > 0 && v.topOutflow.every((s) => s.flowVal < 0));
    assert.strictEqual(v.topOutflow[0].flowVal, Math.min(...board.sectors.map((s) => s.netFlow)));
    assert.strictEqual(v.remaining.length + v.topInflow.length + v.topOutflow.length, board.sectors.length);
    // One-sided day: every sector positive → no outflow box.
    const allUp = board.sectors.map((s) => ({ ...s, netFlow: Math.abs(s.netFlow) + 1 }));
    assert.strictEqual(sectorView(allUp).topOutflow.length, 0);
  });

  it("pulls the top 3 each side: biggest inflows first, biggest outflows first", () => {
    assert.strictEqual(TOP_SECTORS, 3);
    const flows = [900, 500, 300, 100, -50, -200, -700, -1000];
    const v = sectorView(flows.map((f, i) => ({ ...board.sectors[0], name: `S${i}`, netFlow: f })));
    assert.deepEqual(v.topInflow.map((s) => s.flowVal), [900, 500, 300]);
    assert.deepEqual(v.topOutflow.map((s) => s.flowVal), [-1000, -700, -200]);
    assert.deepEqual(v.remaining.map((s) => s.flowVal), [100, -50]); // the rest stay in the list, nothing lost
    // Fewer than 3 on a side: just those.
    const two = sectorView([10, 5, -3].map((f, i) => ({ ...board.sectors[0], name: `T${i}`, netFlow: f })));
    assert.deepEqual(two.topInflow.map((s) => s.flowVal), [10, 5]);
    assert.deepEqual(two.topOutflow.map((s) => s.flowVal), [-3]);
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

describe("Money Flow hover box", () => {
  const val = (stats: ReturnType<typeof popoverStats>, k: string) => stats.find((x) => x.k === k)?.v;

  it("bullish stock: rank on its side, flow in shares vs VWAP, entry/stop; no R/S levels row", () => {
    const s = board.gainers[0]; // CVNA 68.73, entry 68.07, VWAP 67.85
    const st = popoverStats(s, board);
    assert.deepStrictEqual(st.map((x) => x.k), [
      "Confidence", "Direction", "Rank", "Vol", "Δ", "VWAP", "OB", "Entry/Stop", "R:R", "Rule",
    ]);
    assert.strictEqual(val(st, "Confidence"), "84");
    assert.strictEqual(val(st, "Direction"), "Bullish");
    assert.strictEqual(val(st, "Rank"), `#1 / ${board.gainers.length} gainers`);
    assert.strictEqual(val(st, "Vol"), "2.6× · 62% inflow");
    assert.strictEqual(val(st, "Δ"), "+3.1M · ▲ price above VWAP"); // "above" is the price, not Δ
    assert.strictEqual(val(st, "VWAP"), "67.85");
    assert.strictEqual(val(st, "OB"), "67.81–68.07");
    assert.strictEqual(val(st, "Entry/Stop"), "68.07 · 67.81");
    assert.strictEqual(val(st, "R:R"), "—");
    assert.strictEqual(val(st, "Rule"), "PICK · BULLISH #1"); // 0.96% from entry
  });

  it("bearish stock: net selling, no R/S levels row, and WATCH when price is over 1.2% from entry", () => {
    const now = popoverStats(board.losers[0], board); // NOW −$1.74B at 110.65
    assert.strictEqual(val(now, "Rank"), `#1 / ${board.losers.length} losers`);
    assert.strictEqual(val(now, "Δ"), "−16M · ▼ price below VWAP");
    // The levels are on the chart; the box no longer repeats them (R1/R2, R3/R4, S1/S2 …).
    for (const x of [...now, ...popoverStats(board.gainers[0], board)]) assert.doesNotMatch(x.k, /^[RS]\d\/[RS]\d$/);
    assert.strictEqual(val(now, "Rule"), "PICK · BEARISH #1");
    const alny = popoverStats(board.losers[1], board); // 172.84 vs entry 175.56 = 1.57%
    assert.strictEqual(val(alny, "Rule"), "WATCH · BEARISH #2");
  });

  it("choppy or zone-less stocks have no setup", () => {
    const s = board.gainers[0];
    assert.strictEqual(val(popoverStats({ ...s, chop: true }, board), "Rule"), "NO SETUP");
    // Direction is the side of the move; choppiness is noted, not swapped in for it (the badge / Rule carry NO SETUP).
    assert.strictEqual(val(popoverStats({ ...s, chop: true }, board), "Direction"), "Bullish · choppy");
    const bare = { ...s, zone: null, entry: null, stop: null, vwap: null, rvol: null, buyPct: null };
    const st = popoverStats(bare, board);
    assert.strictEqual(val(st, "Rule"), "NO SETUP");
    assert.strictEqual(val(st, "OB"), "—");
    assert.strictEqual(val(st, "Vol"), "— · — inflow");
    assert.strictEqual(val(st, "VWAP"), "—");
  });

  it("shows R:R target price when target is present", () => {
    const s = { ...board.gainers[0], rr: 2.5, target: 72.5 };
    const st = popoverStats(s, board);
    assert.strictEqual(val(st, "R:R"), "1 : 2.5 (tgt 72.50)");
  });

  it("scales with the window, keeping the box's proportions", () => {
    assert.strictEqual(popoverScale(POPOVER.baseW, POPOVER.baseH), 1);
    assert.strictEqual(popoverScale(1440, 900), 0.75);
    assert.strictEqual(popoverScale(960, 480), 0.5);
    assert.strictEqual(popoverScale(2560, 1600), 4 / 3);
    assert.strictEqual(popoverScale(390, 844), (390 - 24) / POPOVER.w); // phone: fit the width
  });

  it("sits beside the tile, never on it, and stays on screen", () => {
    const right = popoverPlacement({ left: 1500, right: 1620, top: 250 }, 1920, 960, 1, 780);
    assert.strictEqual(right.left, 1500 - POPOVER.w - 12);
    assert.strictEqual(right.top, 250 - 120);
    const left = popoverPlacement({ left: 300, right: 420, top: 900 }, 1920, 960, 1, 780);
    assert.strictEqual(left.left, 432);
    assert.strictEqual(left.top, 960 - 780 - 8);
    const half = popoverPlacement({ left: 750, right: 810, top: 450 }, 960, 480, 0.5, 390);
    assert.strictEqual(half.left, 750 - POPOVER.w * 0.5 - 12);
    assert.strictEqual(half.top, 480 - 390 - 8);
  });

  it("box is as wide as the chart, so the chart never scrolls, and still fits the window", () => {
    for (const tf of [1, 3, 5, 15]) {
      const w = popoverWidth(tf);
      // inner width (box − 2×14 padding − 2×1 border − chart frame 2×1) = chart width
      assert.strictEqual(w - 32, popoverChartWidth(tf));
      for (const [vw, vh] of [[1920, 960], [1440, 900], [1280, 720]]) {
        const sc = popoverScale(vw, vh, w);
        assert.ok(w * sc <= vw - 16 + 1e-9, `tf ${tf} fits ${vw}`);
        const pos = popoverPlacement({ left: vw / 2, right: vw / 2 + 80, top: 300 }, vw, vh, sc, 500, w);
        assert.ok(pos.left >= 8 && pos.left + w * sc <= vw - 8 + 1e-9, `tf ${tf} on screen at ${vw}`);
      }
    }
    assert.strictEqual(popoverWidth(15), POPOVER.w + 82); // never narrower than the design box
    assert.strictEqual(popoverScale(POPOVER.baseW, POPOVER.baseH, popoverWidth(5)), 1); // 5m keeps full size
  });

  it("chart width gives each timeframe readable candles and opens on the live one", () => {
    assert.strictEqual(popoverChartWidth(5), 79 * 8 + 78);
    assert.strictEqual(popoverChartWidth(15), 27 * 16 + 78);
    assert.strictEqual(popoverChartWidth(1), 391 * 5 + 78);
    const W = popoverChartWidth(5);
    const x = popoverLiveScroll(W, 5, 50, 430);
    assert.strictEqual(x, Math.max(0, 6 + 49.5 * ((W - 78) / 79) - 430 * 0.75));
    assert.strictEqual(popoverLiveScroll(W, 5, 0, 430), 0);
  });
});

describe("Money Flow hover chart right edge", () => {
  // Real levels from the fixture board (GOOGL, 2026-10-29).
  const g = [...board.gainers, ...board.losers].find((x) => x.t === "GOOGL")!;
  const FZ = 13.5;
  const boxRight = (txt: string, gutter: number) => -gutter + 2 + txt.length * FZ * 0.62 + 8; // relative to the chart's right edge
  it("leaves room for every R1/R2/S1/S2 box and the last-price tag, with a margin", () => {
    const pv = g.pivots!;
    const labels = [["R2", pv.r2], ["R1", pv.r1], ["S1", pv.s1], ["S2", pv.s2]].map(([n, v]) => `${n} ${formatCurrency(v as number)}`);
    const pr = chartRightGutter(labels, formatCurrency(g.price), FZ, 12);
    for (const t of labels) assert.ok(boxRight(t, pr) <= -4, `${t} box ends ${boxRight(t, pr).toFixed(1)}px from the edge`);
    assert.ok(-pr + 4 + formatCurrency(g.price).length * 12 * 0.62 <= -4, "last-price tag fits");
  });
  it("never goes below the old 72px, and grows for four-digit prices", () => {
    assert.equal(chartRightGutter([], "9.75", 13.5, 12), 72); // no pivot in view, short price
    assert.ok(chartRightGutter(["R2 1,417.54"], "1,410.00", 13.5, 12) > chartRightGutter(["R2 328.40"], "283.79", 13.5, 12));
    assert.ok(chartRightGutter(["R2 328.40"], "283.79", 20, 18) > chartRightGutter(["R2 328.40"], "283.79", 13.5, 12)); // grows with the text size
  });
});

describe("Money Flow pop-up: click is the same pop-up as hover, pinned", () => {
  const T = board.gainers[0].t, U = board.gainers[1].t;
  it("hover shows it, leaving hides it", () => {
    const a = popoverNext(null, { type: "enter", key: T });
    assert.deepEqual(a, { key: T, pinned: false });
    assert.equal(popoverNext(a, { type: "leave" }), null);
  });
  it("a click pins the same pop-up; leaving or hovering another tile keeps it", () => {
    const p = popoverNext(popoverNext(null, { type: "enter", key: T }), { type: "click", key: T });
    assert.deepEqual(p, { key: T, pinned: true });
    assert.deepEqual(popoverNext(p, { type: "leave" }), p);
    assert.deepEqual(popoverNext(p, { type: "enter", key: U }), p);
    assert.deepEqual(popoverNext(p, { type: "click", key: U }), { key: U, pinned: true });
    assert.equal(popoverNext(p, { type: "dismiss" }), null);
  });
  it("buttons open the stock without repeating its ticker", () => {
    assert.deepEqual(popoverButtons(), ["Open in Market Catalyst →", "Open in Stock Intelligence →"]);
  });
});

describe("pivot levels renumber from the current price", () => {
  // Real levels from the fixture board (GOOGL, 2026-10-29): P 324.65, R1 326.65, R2 328.40, R3 330.40, S1 322.90, S2 320.90, S3 319.15.
  const pv = [...board.gainers, ...board.losers].find((x) => x.t === "GOOGL")!.pivots!;
  const near = (a: number | null, b: number) => assert.ok(a != null && Math.abs(a - b) < 0.02, `${a} vs ${b}`);
  it("extends to R4/R5 and S4/S5 with TradingView's Traditional formulas (H, L recovered from P, R1, S1)", () => {
    const x = extendedPivots(pv);
    const H = 2 * pv.pivot! - pv.s1!, L = 2 * pv.pivot! - pv.r1!, P = pv.pivot!;
    near(x.R3, pv.r3!);
    near(x.S3, pv.s3!);
    near(x.R4, P * 3 + (H - 3 * L));
    near(x.S4, P * 3 - (3 * H - L));
    near(x.R5, P * 4 + (H - 4 * L));
    near(x.S5, P * 4 - (4 * H - L));
  });
  it("between S1 and R1 the names are the classic ones", () => {
    const l = liveLevels(pv, 324.0);
    assert.deepEqual(l.map((r) => [r.name, r.from]), [["R2", "R2"], ["R1", "R1"], ["S1", "S1"], ["S2", "S2"]]);
  });
  it("once price touches or passes R1, R2 is called R1 and R3 is called R2", () => {
    for (const px of [pv.r1!, 327.5]) {
      const l = liveLevels(pv, px);
      assert.deepEqual(l.filter((r) => r.name[0] === "R").map((r) => [r.name, r.from]), [["R2", "R3"], ["R1", "R2"]], String(px));
      near(l.find((r) => r.name === "R1")!.v, pv.r2!);
    }
    const far = liveLevels(pv, 331); // above R3: R4 → R1, R5 → R2
    assert.deepEqual(far.filter((r) => r.name[0] === "R").map((r) => r.from), ["R5", "R4"]);
  });
  it("supports do the same on the way down", () => {
    const l = liveLevels(pv, 321.5); // below S1
    assert.deepEqual(l.filter((r) => r.name[0] === "S").map((r) => [r.name, r.from]), [["S1", "S2"], ["S2", "S3"]]);
    near(l.find((r) => r.name === "S1")!.v, pv.s2!);
  });
});

describe("Money Flow pop-up text stays readable", () => {
  it("no text draws smaller than 12px on screen, whatever the box scale", () => {
    assert.equal(POP_MIN_TEXT_PX, 12);
    for (const [vw, vh] of [[1920, 960], [1440, 900], [1280, 720]] as const)
      for (const tf of [1, 3, 5, 15]) {
        const sc = popoverScale(vw, vh, popoverWidth(tf));
        for (const base of [10, 11, 12, 14]) assert.ok(popText(base, sc) * sc >= 12 - 1e-9, `${vw}x${vh} ${tf}m base ${base}: ${popText(base, sc) * sc}`);
      }
  });
  it("keeps the design size when the box is not shrunk", () => {
    assert.equal(popText(13, 1), 13);
    assert.equal(popText(13, 4 / 3), 13);
  });
});

describe("Money Flow hover chart time axis", () => {
  it("labels the session in ET: every hour on 5- and 15-minute candles, every 30 minutes on 1 and 3", () => {
    assert.deepEqual(timeTicks(5).map((t) => t.label), ["9:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30"]);
    assert.deepEqual(timeTicks(15).map((t) => t.label), ["9:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30"]);
    assert.equal(timeTicks(1)[1].label, "10:00");
    assert.equal(timeTicks(3).length, 13);
    // slot index = minutes since 9:30 ÷ candle size (the chart draws slot i at x = PL + i·cw)
    assert.equal(timeTicks(5)[1].i, 12);
    assert.equal(timeTicks(1)[1].i, 30);
  });
});

describe("Money Flow: a tile click opens the hover pop-up (pinned), not the detail window", () => {
  it("handleTileClick pins the same pop-up and never opens the stock drawer", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "../screens/money-flow.tsx"), "utf-8");
    const body = src.slice(src.indexOf("const handleTileClick"), src.indexOf("};", src.indexOf("const handleTileClick")));
    assert.ok(body.length > 0);
    assert.ok(!/openStock\(/.test(body), "tile click must not open the detail window");
    assert.ok(/applyPop\(\{ type: "click"/.test(body), "tile click pins the hover pop-up");
  });
});

describe("Money Flow hover chart: R1/R2/S1/S2 sit outside the chart box", () => {
  it("the chart frame ends where the level column starts", () => {
    const f = chartFrame(980, 340, 110);
    assert.deepEqual(f, { x: 0, y: 0, w: 870, h: 340 });
    const levelLabelX = 980 - 110 + 2; // where the R/S boxes are drawn
    assert.ok(levelLabelX > f.x + f.w);
  });
});

describe("Money Flow pop-up: R/S lines on fixed rows", () => {
  const pv = [...board.gainers, ...board.losers].find((x) => x.t === "GOOGL")!.pivots!;
  it("R2, R1 sit at the top and S1, S2 at the bottom, at the same place whatever the levels or price", () => {
    const a = popLevelRows(10, 418, 26);
    assert.ok(a.y.R2 < a.y.R1 && a.y.R1 < a.band.top, "R rows above the candles");
    assert.ok(a.band.bottom < a.y.S1 && a.y.S1 < a.y.S2, "S rows below the candles");
    assert.ok(a.y.R2 >= 10 && a.y.S2 <= 418);
    // The rows depend only on the box, never on prices: the same rows for any stock.
    assert.deepEqual(popLevelRows(10, 418, 26), a);
  });
  it("pattern lanes sit between the level rows and the candles", () => {
    const r = popLevelRows(10, 418, 26, 39);
    assert.ok(r.lanes.top[0] > r.y.R1 && r.lanes.top[1] <= r.band.top);
    assert.ok(r.lanes.bottom[0] >= r.band.bottom && r.lanes.bottom[1] < r.y.S1);
    assert.equal(r.lanes.top[1] - r.lanes.top[0], 39);
  });
  it("crossing R1 renames the rows, not their place: R2 moves into the R1 row", () => {
    const below = liveLevels(pv, pv.r1! - 0.01).map((l) => l.name);
    const above = liveLevels(pv, pv.r1! + 0.01);
    assert.deepEqual(below, ["R2", "R1", "S1", "S2"]);
    assert.deepEqual(above.map((l) => l.name), ["R2", "R1", "S1", "S2"]);
    assert.equal(above.find((l) => l.name === "R1")!.from, "R2");
  });
  it("the box holds only the name; the value is printed beside it, outside the box", () => {
    const t = levelTag("R1", 241.32, 14, 500);
    assert.equal(t.name, "R1");
    assert.equal(t.value.text, "241.32");
    assert.ok(t.value.x >= t.box.x + t.box.w, "value starts after the box ends");
    assert.ok(t.box.w < 2 * 14 * 0.62 + 10, "box is sized to the name only");
  });
  it("the name box and the value beside it fit in the right column", () => {
    const fz = 14, labels = [["R2", 1417.54], ["S2", 9.75]] as const;
    const pr = chartRightGutter(labels.map(([n, v]) => `${n} ${formatCurrency(v)}`), "1,410.00", fz, 13);
    for (const [n, v] of labels) {
      const t = levelTag(n, v, fz, -pr + 2);
      assert.ok(t.value.x + t.value.text.length * fz * 0.62 <= -4, `${n} ends inside the column`);
    }
  });
});

describe("Money Flow FVG detection (shared by the pop-up and the full chart)", () => {
  const bar = (o: number, h: number, l: number, c: number) => ({ o, h, l, c });
  it("finds a bullish gap and marks where it was filled", () => {
    const c = [bar(100, 101, 99, 100.5), bar(100.5, 103, 100.4, 102.8), bar(102.8, 104, 102, 103.5), bar(103.5, 103.6, 100.8, 101)];
    const f = computeFvgs(c);
    assert.deepEqual(f.map((g) => ({ i: g.i, lo: g.lo, hi: g.hi, bull: g.bull, end: g.end })), [{ i: 1, lo: 101, hi: 102, bull: true, end: 3 }]);
  });
  it("keeps only the latest seven", () => {
    const c: Array<ReturnType<typeof bar>> = [];
    for (let k = 0; k < 40; k++) c.push(bar(100 + k * 3, 101 + k * 3, 99 + k * 3, 100.5 + k * 3));
    assert.equal(computeFvgs(c).length, 7);
    assert.equal(computeFvgs(c, 0).length > 7, true);
  });
});

describe("Money Flow pop-up: chart mode toggle, then timeframe", () => {
  it("the toggle reads Intra-Day Chart | Full Chart, in that order", () => {
    assert.deepEqual(popChartModes().map((m) => m.label), ["Intra-Day Chart", "Full Chart"]);
    assert.deepEqual(popChartModes().map((m) => m.full), [false, true]);
  });
  it("every timeframe button works in both modes: the full chart has bars for each", () => {
    assert.deepEqual([...POP_TIMEFRAMES], [1, 3, 5, 15]);
    for (const tf of POP_TIMEFRAMES) {
      const { interval, group } = fullChartInterval(tf);
      assert.equal(Number(interval.replace("m", "")) * group, tf, `${tf}m full chart candles are ${tf} minutes`);
    }
  });
});

describe("Money Flow pop-up: 1D / 1W / 1M on the full chart only", () => {
  it("the Money Flow chart offers minutes only; the full chart adds 1D, 1W, 1M", () => {
    assert.deepEqual(popTimeframes(false), [1, 3, 5, 15]);
    assert.deepEqual(popTimeframes(true), [1, 3, 5, 15, "1D", "1W", "1M"]);
    assert.deepEqual(popTimeframes(true).map(popTfLabel), ["1m", "3m", "5m", "15m", "1D", "1W", "1M"]);
  });
  it("going back to the Money Flow chart from 1D / 1W / 1M falls back to 5m; minutes are kept", () => {
    for (const tf of ["1D", "1W", "1M"] as const) assert.equal(popTfForMode(tf, false), 5);
    assert.equal(popTfForMode(15, false), 15);
    assert.equal(popTfForMode("1W", true), "1W");
  });
});

describe("Money Flow pop-up: stat values are never cut short", () => {
  it("a value that does not fit beside its label wraps below it instead of ending in an ellipsis", () => {
    assert.equal(POP_STAT_VALUE_STYLE.textOverflow, undefined);
    assert.equal(POP_STAT_VALUE_STYLE.overflow, undefined);
    assert.equal(POP_STAT_VALUE_STYLE.whiteSpace, "nowrap"); // "169.39 · 168.12" stays on one line
    assert.equal(POP_STAT_VALUE_STYLE.marginLeft, "auto"); // right-aligned, on the label's line or the next
  });
});

describe("Intra-Day chart zoom and scroll, today's session only", () => {
  const NB = 79; // 5-minute slots 9:30-16:00
  it("starts on the whole session", () => {
    assert.deepEqual(fullSessionView(NB), { from: 0, to: NB });
  });
  it("zooming in narrows the window around the pointer", () => {
    const v = zoomIntradayView(fullSessionView(NB), 0.5, 0.5, NB);
    assert.ok(Math.abs(v.to - v.from - NB / 2) < 1e-9);
    assert.ok(Math.abs((v.from + v.to) / 2 - NB / 2) < 1e-9, "centred on the pointer");
    const left = zoomIntradayView(fullSessionView(NB), 0.5, 0, NB);
    assert.equal(left.from, 0, "anchored at the left edge");
  });
  it("never zooms out past the session or in past a few candles", () => {
    assert.deepEqual(zoomIntradayView({ from: 10, to: 30 }, 10, 0.5, NB), { from: 0, to: NB });
    const tight = zoomIntradayView({ from: 10, to: 30 }, 0.01, 0.5, NB);
    assert.ok(tight.to - tight.from >= 8 - 1e-9);
  });
  it("scrolling stops at 9:30 and at the close: nothing before or after today's session", () => {
    assert.deepEqual(panIntradayView({ from: 10, to: 30 }, -100, NB), { from: 0, to: 20 });
    assert.deepEqual(panIntradayView({ from: 10, to: 30 }, 100, NB), { from: NB - 20, to: NB });
    assert.deepEqual(panIntradayView({ from: 10, to: 30 }, 5, NB), { from: 15, to: 35 });
  });
});

describe("Money Flow card headings", () => {
  it("say what the cards are: the three biggest movers each side, setup or not", () => {
    assert.deepEqual(BOARD_HEADINGS.bull, ["Top 3 Bullish Stocks", "Biggest Gainers"]);
    assert.deepEqual(BOARD_HEADINGS.bear, ["Top 3 Bearish Stocks", "Biggest Losers"]);
  });
});

describe("pivot levels: R1/R2/S1/S2 always shown, renumbered within each side", () => {
  const pv = [...board.gainers, ...board.losers].find((x) => x.t === "GOOGL")!.pivots!;
  const names = (px: number) => liveLevels(pv, px).map((r) => [r.name, r.from]);
  it("crossing R1 renames the R side only: R2 becomes R1, R3 becomes R2; S1 / S2 stay the classic ones", () => {
    assert.deepEqual(names(327.5), [["R2", "R3"], ["R1", "R2"], ["S1", "S1"], ["S2", "S2"]]); // above R1 (326.65)
  });
  it("crossing S1 renames the S side only", () => {
    assert.deepEqual(names(321.5), [["R2", "R2"], ["R1", "R1"], ["S1", "S2"], ["S2", "S3"]]); // below S1 (322.90)
  });
  it("past R5 the ladder keeps going with the classic step, so R1 and R2 still exist (SWK +14.6%)", () => {
    const x = extendedPivots(pv);
    const H = 2 * pv.pivot! - pv.s1!, L = 2 * pv.pivot! - pv.r1!, P = pv.pivot!;
    const l = liveLevels(pv, 400);
    assert.deepEqual(l.map((r) => r.name), ["R2", "R1", "S1", "S2"]);
    const r1 = l.find((r) => r.name === "R1")!, r2 = l.find((r) => r.name === "R2")!;
    assert.ok(r1.v > 400 && r2.v > r1.v);
    // R_n = H + (n − 1)(P − L) from R2 up: the same rule that gives R2…R5.
    const n = Number(r1.from.slice(1));
    assert.ok(n > 5);
    assert.ok(Math.abs(r1.v - (H + (n - 1) * (P - L))) < 1e-9);
    assert.ok(Math.abs(r2.v - r1.v - (P - L)) < 1e-9);
    assert.ok(Math.abs(x.R5! - (H + 4 * (P - L))) < 1e-9, "R5 fits the same rule");
    assert.deepEqual(l.filter((r) => r.name[0] === "S").map((r) => r.from), ["S1", "S2"]);
  });
  it("past S5 the same on the way down (and never below zero)", () => {
    const l = liveLevels(pv, 250);
    assert.deepEqual(l.map((r) => r.name), ["R2", "R1", "S1", "S2"]);
    assert.ok(Number(l.find((r) => r.name === "S1")!.from.slice(1)) > 5);
    assert.ok(l.every((r) => r.v > 0));
  });
  it("whatever the price, all four rows have a level", () => {
    for (let px = 200; px <= 460; px += 3.7) assert.equal(liveLevels(pv, px).length, 4, String(px));
  });
});

describe("Money Flow card levels", () => {
  it("have two decimals, like the pop-up (one decimal could read 9.8–9.8)", () => {
    const s = { ...board.gainers[0], zone: { lo: 9.751, hi: 9.784, startT: 0 }, rr: 2.345 };
    const c = Object.fromEntries(cardLevels(s).map((x) => [x.k, x.v]));
    assert.deepEqual(Object.keys(c), ["ZONE", "R2", "R1", "S1", "S2", "R:R"]);
    assert.equal(c.ZONE, "9.75–9.78");
    assert.equal(c["R:R"], "1:2.3");
    for (const k of ["R2", "R1", "S1", "S2"]) {
      assert.equal(c[k], formatLevel(liveLevels(s.pivots, s.price).find((l) => l.name === k)?.v));
      assert.match(c[k], /^(\d+\.\d{2}|—)$/);
    }
  });
});

describe("Money Flow freshness line and glossary", () => {
  it("shows how far the bars actually trail the board, not a fixed 15 minutes", () => {
    const b = { ...board, asOf: "2026-10-29T17:36:44.170Z", barsThrough: Date.parse("2026-10-29T17:10:00Z"), sessionComplete: false };
    assert.equal(flowsLagLabel(b), "flows through 1:10 PM ET (27 min behind)");
    assert.equal(flowsLagLabel({ ...b, barsThrough: null }), "flows start after 9:30 AM ET");
    assert.equal(flowsLagLabel({ ...b, sessionComplete: true, barsThrough: Date.parse("2026-10-29T20:00:00Z") }), "flows through 4:00 PM ET (session closed)");
  });
  it("the glossary names the feed the code uses and the code's numbers", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "../screens/money-flow.tsx"), "utf-8");
    assert.doesNotMatch(src, /Polygon 5-minute bars/);
    assert.doesNotMatch(src, /grouped from Polygon 1-minute bars/);
    assert.doesNotMatch(src, /-min delayed/);
    assert.match(src, /easing to 1\.5 at about 1% away/); // 5 × clamp(1 − d/1.5, 0.3, 1) bottoms out at d = 1.05%
    assert.match(src, /first level on the trade’s side/); // the R:R target rule (see the R:R glossary test)
  });
});

describe("Money Flow sector boxes keep their text on a small window", () => {
  it("a box never shrinks below its content, and neither does the sector name line", () => {
    // In a short column, flex items shrink; an overflow-hidden line can shrink to nothing,
    // which hid the sector name under the flow figure. Both are pinned at their content size.
    assert.equal(SECTOR_BOX_SIZE.flexShrink, 0);
    assert.equal(SECTOR_NAME_STYLE.flexShrink, 0);
    assert.equal(SECTOR_NAME_STYLE.overflow, "hidden"); // long names still end in an ellipsis sideways
    assert.equal(SECTOR_NAME_STYLE.whiteSpace, "nowrap");
    assert.ok(SECTOR_NAME_STYLE.lineHeight >= 1.2);
  });
});

describe("Money Flow relative volume: one value for popover, tiles and card tags", () => {
  const s = board.gainers[0];
  it("the popover, the tile and the tag all read the same relative volume", () => {
    const st = popoverStats({ ...s, rvol: 1.46 }, board);
    assert.ok(st.find((x) => x.k === "Vol")!.v.startsWith(formatRvol(1.46) + " "));
    assert.equal(formatRvol(1.46), "1.5×");
    assert.equal(formatRvol(null), "—");
  });
  it("ACCUMULATION / DISTRIBUTION start at the 1.4× the popover shows (TRI / APO at 1.4–1.5× are DISTRIBUTION)", () => {
    assert.equal(RVOL_HEAVY, 1.4);
    assert.equal(phaseTag({ chop: false, rvol: 1.46 }, false), "DISTRIBUTION");
    assert.equal(phaseTag({ chop: false, rvol: 1.46 }, true), "ACCUMULATION");
    // Shown as "1.4×" → tagged as 1.4× (the tag never disagrees with the number on screen).
    assert.equal(formatRvol(1.36), "1.4×");
    assert.equal(phaseTag({ chop: false, rvol: 1.36 }, false), "DISTRIBUTION");
    assert.equal(phaseTag({ chop: false, rvol: 1.34 }, false), "MOMENTUM DOWN");
    assert.equal(phaseTag({ chop: false, rvol: null }, true), "MOMENTUM UP");
    assert.equal(phaseTag({ chop: true, rvol: 3 }, true), "CHOPPY");
  });
});

describe("Money Flow pop-up: no stale preview, Esc always closes", () => {
  const T = board.gainers[0].t;
  it("a hover preview lets the pointer through to the tiles underneath; only a pinned pop-up takes clicks", () => {
    // The pop-up is wider than a tile and sits beside it; an interactive preview held the pointer,
    // so the next tile got no hover until it was left (the 2–5 s stale pop-up).
    assert.equal(popoverInteractive({ key: T, pinned: false }), false);
    assert.equal(popoverInteractive({ key: T, pinned: true }), true);
    assert.equal(popoverInteractive(null), false);
  });
  it("Esc closes the pop-up, pinned or not; other keys leave it alone", () => {
    assert.equal(popoverKey({ key: T, pinned: true }, "Escape"), null);
    assert.equal(popoverKey({ key: T, pinned: false }, "Escape"), null);
    assert.deepEqual(popoverKey({ key: T, pinned: true }, "ArrowLeft"), { key: T, pinned: true });
    assert.equal(popoverKey(null, "Escape"), null);
  });
});

describe("Money Flow sector names agree between the pop-up and the board", () => {
  // The UI renames every JSON "sector" field as responses are parsed (backend.ts →
  // normalizeSector: Consumer Non-Durables → Consumer Defensive), so a stock's sector
  // was renamed but the board's sector list (field "name") was not.
  const revived = {
    ...board,
    gainers: board.gainers.map((g) => (g.sector === "Consumer Non-Durables" ? { ...g, sector: "Consumer Defensive" } : g)),
    losers: board.losers.map((g) => (g.sector === "Consumer Non-Durables" ? { ...g, sector: "Consumer Defensive" } : g)),
  };
  it("every stock's sector is a sector on the board, after the app-wide relabelling", () => {
    const b = withSectorLabels(revived);
    const names = b.sectors.map((x) => x.name);
    for (const st of [...b.gainers, ...b.losers]) if (st.sector) assert.ok(names.includes(st.sector), st.sector);
    assert.ok(names.includes("Consumer Defensive") && !names.includes("Consumer Non-Durables"));
  });
  it("leaves other sector names alone and keeps the flows", () => {
    const b = withSectorLabels(revived);
    assert.deepEqual(b.sectors.map((x) => x.netFlow), board.sectors.map((x) => x.netFlow));
    assert.ok(b.sectors.some((x) => x.name === "Technology Services"));
  });
  it("a sector row's tooltip carries the full name, flow and move", () => {
    const row = sectorView(withSectorLabels(revived).sectors).sectors[0];
    assert.equal(sectorRowTitle(row), `${row.name} · ${row.flowFormatted} net flow · ${row.avgPctFormatted} avg move`);
  });
});

describe("Money Flow chart labels stay readable", () => {
  const y = (p: number) => 400 - (p - 140) * 20; // price 140 → 400 px, 155 → 100 px
  it("labels at the same price merge into one (ORL · LOD · SSL $143.65)", () => {
    const out = layoutEdgeLabels([
      { price: 143.65, name: "ORL", color: "#9aa7ff" },
      { price: 143.65, name: "LOD", color: "#e0bb5e" },
      { price: 143.652, name: "SSL", color: "#4ad0c9" },
      { price: 152.8, name: "SSL", color: "#4ad0c9" },
    ], y, 60, 420, 16);
    assert.equal(out.length, 2);
    assert.ok(out.some((l) => l.text === "ORL · LOD · SSL $143.65"));
    assert.ok(out.some((l) => l.text === "SSL $152.80"));
  });
  it("labels close together are pushed apart, none overlapping, all inside the price area", () => {
    const out = layoutEdgeLabels([150, 150.2, 150.3, 150.4, 150.5].map((p, i) => ({ price: p, name: `L${i}`, color: "#fff" })), y, 60, 420, 16);
    const ys = out.map((l) => l.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 16 - 1e-9, `gap ${ys[i] - ys[i - 1]}`);
    assert.ok(ys[0] >= 60 && ys[ys.length - 1] <= 420);
  });
  it("a level beyond the candles' scale is pinned to the edge with an arrow instead of hidden or stretching the scale", () => {
    const out = layoutEdgeLabels([{ price: 170, name: "PDH", color: "#9aa7ff" }, { price: 120, name: "PDL", color: "#9aa7ff" }], y, 60, 420, 16);
    const up = out.find((l) => l.text.includes("PDH"))!, down = out.find((l) => l.text.includes("PDL"))!;
    assert.equal(up.text, "▲ PDH $170.00");
    assert.equal(up.offScale, "above");
    assert.ok(up.y <= 60 + 16);
    assert.equal(down.text, "▼ PDL $120.00");
    assert.ok(down.y >= 420 - 16);
  });
  it("callout lanes take only the rows the callouts in view need, per side", () => {
    assert.deepEqual(calloutLaneRows([]), { above: 0, below: 0 });
    assert.deepEqual(calloutLaneRows([{ above: true }]), { above: 1, below: 0 });
    assert.deepEqual(calloutLaneRows([{ above: true }, { above: true }, { above: true }, { above: false }]), { above: 2, below: 1 });
  });
  it("level rows leave the candles most of the chart; lanes can differ above and below", () => {
    const none = popLevelRows(10, 416, 22);
    assert.ok(none.band.bottom - none.band.top > 0.75 * 406, `${none.band.bottom - none.band.top}`);
    const r = popLevelRows(10, 416, 22, 20, 0);
    assert.equal(r.band.bottom - r.band.top, none.band.bottom - none.band.top - (20 + 8)); // only the top lane is taken
    assert.equal(r.lanes.top[1] - r.lanes.top[0], 20);
    assert.equal(r.lanes.bottom[1] - r.lanes.bottom[0], 0);
  });
});

describe("Money Flow glossary: click pins the pop-up (no detail window here)", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "../screens/money-flow.tsx"), "utf-8");
  const glossary = src.slice(src.indexOf('title: "Data"'));
  it("documents hover → pop-up, click → pinned, Esc / outside click → closed", () => {
    assert.match(glossary, /term: "Click a card or tile"/);
    assert.match(glossary, /pins it/);
    assert.match(glossary, /Esc/);
  });
  it("does not describe a detail window or heatmap click-through that no longer opens", () => {
    assert.doesNotMatch(glossary, /opens? (the |a )?detail (window|view)|View \S+ in heatmap/i);
  });
});

describe("Money Flow glossary: the R:R target rule", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "../screens/money-flow.tsx"), "utf-8");
  const rr = src.slice(src.indexOf('term: "R:R"'), src.indexOf('term: "Rule"'));
  it("says the target is the first shown level on the trade's side beyond entry and price, skipping passed levels", () => {
    assert.match(rr, /first level on the trade’s side/);
    assert.match(rr, /already passed are skipped/);
    assert.match(rr, /past R5 \/ S5/i);
    assert.doesNotMatch(rr, /S5 … R5/); // the old mixed ladder
  });
});

describe("Money Flow glossary matches the page (Nov 3 test)", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "../screens/money-flow.tsx"), "utf-8");
  const g = src.slice(src.indexOf('title: "Data"'));
  it("covers the Intra-Day Chart / Full Chart tabs, zoom and 1D / 1W / 1M", () => {
    assert.match(g, /term: "Intra-Day Chart · Full Chart"/);
    assert.match(g, /zoom/i);
    assert.match(g, /1D · 1W · 1M/);
  });
  it("relative volume and candles describe the full session (opening auction included)", () => {
    const rv = g.slice(g.indexOf('term: "Relative volume"'), g.indexOf('title: "Confidence'));
    assert.match(rv, /opening auction/);
    assert.match(g.slice(g.indexOf('term: "Candles"'), g.indexOf('title: "Sector Money Flow"')), /Polygon’s prices/);
  });
  it("chart labels: merged by price, off-scale levels pinned with ▲ / ▼, ✕ for a swept level", () => {
    assert.match(g, /one label per price/);
    assert.match(g, /▲ \/ ▼/);
    assert.doesNotMatch(g, /“✕ swept”/);
  });
  it("pattern limit and list match the chart (the six enabled patterns, up to four shown)", () => {
    assert.match(g, /shows up to four patterns/);
    assert.match(g, /six chart patterns/);
    assert.doesNotMatch(g, /candle marks/);
  });
});
