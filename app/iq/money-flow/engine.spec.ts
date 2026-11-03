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
  popoverChartWidth,
  popoverLiveScroll,
  popoverPlacement,
  popoverScale,
  popoverStats,
  popoverWidth,
  POPOVER,
  chartRightGutter,
  popoverButtons,
  extendedPivots,
  liveLevels,
  popText,
  POP_MIN_TEXT_PX,
  timeTicks,
  popoverNext,
  formatCurrency,
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

describe("Money Flow hover box", () => {
  const val = (stats: ReturnType<typeof popoverStats>, k: string) => stats.find((x) => x.k === k)?.v;

  it("bullish stock: rank on its side, flow in shares vs VWAP, entry/stop and R1/R2", () => {
    const s = board.gainers[0]; // CVNA 68.73, entry 68.07, VWAP 67.85
    const st = popoverStats(s, board);
    assert.deepStrictEqual(st.map((x) => x.k), [
      "Confidence", "Setup", "Rank", "Vol", "Δ", "VWAP", "OB", "Entry/Stop", "R1/R2", "R:R", "Rule",
    ]);
    assert.strictEqual(val(st, "Confidence"), "84");
    assert.strictEqual(val(st, "Setup"), "Bullish");
    assert.strictEqual(val(st, "Rank"), `#1 / ${board.gainers.length} gainers`);
    assert.strictEqual(val(st, "Vol"), "2.6× · 62% buy");
    assert.strictEqual(val(st, "Δ"), "+3.1M · ▲ above VWAP");
    assert.strictEqual(val(st, "VWAP"), "67.85");
    assert.strictEqual(val(st, "OB"), "67.81–68.07");
    assert.strictEqual(val(st, "Entry/Stop"), "68.07 · 67.81");
    assert.strictEqual(val(st, "R1/R2"), "60.35 · 61.66");
    assert.strictEqual(val(st, "R:R"), "—");
    assert.strictEqual(val(st, "Rule"), "PICK · BULLISH #1"); // 0.96% from entry
  });

  it("bearish stock uses S1/S2, net selling and WATCH when price is over 1.2% from entry", () => {
    const now = popoverStats(board.losers[0], board); // NOW −$1.74B at 110.65
    assert.strictEqual(val(now, "Rank"), `#1 / ${board.losers.length} losers`);
    assert.strictEqual(val(now, "Δ"), "−16M · ▼ below VWAP");
    assert.strictEqual(val(now, "S1/S2"), "147.18 · 144.24");
    assert.strictEqual(val(now, "Rule"), "PICK · BEARISH #1");
    const alny = popoverStats(board.losers[1], board); // 172.84 vs entry 175.56 = 1.57%
    assert.strictEqual(val(alny, "Rule"), "WATCH · BEARISH #2");
  });

  it("choppy or zone-less stocks have no setup", () => {
    const s = board.gainers[0];
    assert.strictEqual(val(popoverStats({ ...s, chop: true }, board), "Rule"), "NO SETUP");
    assert.strictEqual(val(popoverStats({ ...s, chop: true }, board), "Setup"), "Choppy");
    const bare = { ...s, zone: null, entry: null, stop: null, vwap: null, rvol: null, buyPct: null };
    const st = popoverStats(bare, board);
    assert.strictEqual(val(st, "Rule"), "NO SETUP");
    assert.strictEqual(val(st, "OB"), "—");
    assert.strictEqual(val(st, "Vol"), "— · — buy");
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

