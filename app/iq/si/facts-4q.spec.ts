import assert from "node:assert/strict";
import test from "node:test";
import { analystTargetList, epsGrowths, grossMargins, mean, operatingMargins, peerAverage, peerStats, revenueGrowths, type FactQuarter } from "./facts-4q";

const q = (fiscalPeriod: string, fiscalYear: number, endDate: string, over: Partial<FactQuarter> = {}): FactQuarter => ({ fiscalPeriod, fiscalYear, endDate, ...over });

// Newest first is not required: the helpers sort by end date.
const Q: FactQuarter[] = [
  q("Q3", 2027, "2026-10-26", { revenue: 400, epsActual: 4, operatingIncome: 200, grossProfit: 300 }),
  q("Q2", 2027, "2026-07-27", { revenue: 300, epsActual: 3, operatingIncome: 120, grossProfit: 210 }),
  q("Q1", 2027, "2026-04-27", { revenue: 250, epsActual: 2, operatingIncome: 100, grossProfit: 175 }),
  q("Q4", 2026, "2026-01-26", { revenue: 200, epsActual: 1, operatingIncome: 80, grossProfit: 140 }),
  q("Q3", 2026, "2025-10-26", { revenue: 150, epsActual: 2, operatingIncome: 60, grossProfit: 105 }),
  q("Q2", 2026, "2025-07-27", { revenue: 120, epsActual: 1.5, operatingIncome: 50, grossProfit: 80 }),
  q("Q1", 2026, "2025-04-27", { revenue: 100, epsActual: 1, operatingIncome: 40, grossProfit: 70 }),
  q("Q4", 2025, "2025-01-26", { revenue: 90, epsActual: 0.9, operatingIncome: 35, grossProfit: 60 }),
];

test("revenue growth is year over year for each of the latest four quarters", () => {
  const steady = [
    q("Q3", 2027, "2026-10-26", { revenue: 115 }),
    q("Q2", 2027, "2026-07-27", { revenue: 110 }),
    q("Q1", 2027, "2026-04-27", { revenue: 105 }),
    q("Q4", 2026, "2026-01-26", { revenue: 120 }),
    q("Q3", 2026, "2025-10-26", { revenue: 100 }),
    q("Q2", 2026, "2025-07-27", { revenue: 100 }),
    q("Q1", 2026, "2025-04-27", { revenue: 100 }),
    q("Q4", 2025, "2025-01-26", { revenue: 100 }),
  ];
  const g = revenueGrowths(steady);
  assert.equal(g.length, 4);
  assert.ok(Math.abs(g[0] - 15) < 1e-9, "latest quarter against Q3 FY26");
  assert.ok(Math.abs(g[3] - 20) < 1e-9, "fourth quarter back against Q4 FY25");
});

test("the big series is capped: 400 against 150 is +167%, read as +100%", () => {
  assert.equal(revenueGrowths(Q)[0], 100);
});

test("each quarter's growth is capped at +-100% so one hypergrowth quarter cannot dominate", () => {
  const wild = [q("Q2", 2027, "2026-07-27", { revenue: 1000 }), q("Q2", 2026, "2025-07-27", { revenue: 10 })];
  assert.deepEqual(revenueGrowths(wild), [100]);
  const crash = [q("Q2", 2027, "2026-07-27", { revenue: 1 }), q("Q2", 2026, "2025-07-27", { revenue: 100 })];
  assert.ok(Math.abs(revenueGrowths(crash)[0] - -99) < 1e-9);
});

test("a quarter whose year-ago figure is missing or zero is skipped, not shifted", () => {
  const noBase = Q.filter((x) => !(x.fiscalPeriod === "Q3" && x.fiscalYear === 2026));
  assert.equal(revenueGrowths(noBase).length, 3);
  const zero = [q("Q3", 2027, "2026-10-26", { revenue: 5 }), q("Q3", 2026, "2025-10-26", { revenue: 0 })];
  assert.deepEqual(revenueGrowths(zero), []);
});

test("EPS growth skips a base at or under 5 cents, and a negative base", () => {
  const near = [q("Q3", 2027, "2026-10-26", { epsActual: 1 }), q("Q3", 2026, "2025-10-26", { epsActual: 0.04 })];
  assert.deepEqual(epsGrowths(near), []);
  const negative = [q("Q3", 2027, "2026-10-26", { epsActual: 1 }), q("Q3", 2026, "2025-10-26", { epsActual: -0.5 })];
  assert.deepEqual(epsGrowths(negative), []);
  assert.ok(Math.abs(epsGrowths(Q)[0] - 100) < 1e-9, "4 against 2 is +100%");
});

test("margins are percent of revenue for the latest four quarters", () => {
  assert.deepEqual(operatingMargins(Q), [50, 40, 40, 40]);
  assert.deepEqual(grossMargins(Q), [75, 70, 70, 70]);
  assert.deepEqual(operatingMargins([q("Q1", 2027, "2026-04-27", { revenue: 0, operatingIncome: 5 })]), []);
});

test("mean of nothing is null", () => {
  assert.equal(mean([]), null);
  assert.equal(mean([2, 4]), 3);
});

test("a peer average needs three peers with quarters", () => {
  assert.equal(peerStats({ A: Q, B: Q }), null);
  assert.equal(peerStats({ A: Q, B: Q, C: [] }), null);
  const s = peerStats({ A: Q, B: Q, C: Q })!;
  assert.deepEqual(s.tickers, ["A", "B", "C"]);
  assert.ok(Math.abs(s.revGrowth! - mean(revenueGrowths(Q))!) < 1e-9);
  assert.ok(Math.abs(s.opMargin! - 42.5) < 1e-9);
});

test("peer P/E averages the positive values and needs three", () => {
  assert.equal(peerAverage({ A: 20, B: 30 }), null);
  assert.equal(peerAverage({ A: 20, B: 30, C: null, D: -5 }), null);
  assert.deepEqual(peerAverage({ A: 20, B: 30, C: 40, D: null }), { avg: 30, n: 3 });
});

test("the top analysts' targets: the latest from each of up to five distinct firms", () => {
  const grades = [
    { date: "2026-11-01", firm: "A", priceTarget: 100 },
    { date: "2026-11-10", firm: "A", priceTarget: 120 },
    { date: "2026-11-05", firm: "B", priceTarget: 110 },
    { date: "2026-11-06", firm: "C", priceTarget: 0 },
    { date: "2026-11-07", firm: "", priceTarget: 150 },
    { date: "2026-11-08", firm: "D", priceTarget: 130 },
  ];
  // newest first: A 120 (11-10), D 130 (11-08), B 110 (11-05); A's older 100 is a repeat firm
  assert.deepEqual(analystTargetList(grades), [120, 130, 110]);
  assert.equal(analystTargetList([]), null);
  assert.equal(analystTargetList(undefined), null);
});
