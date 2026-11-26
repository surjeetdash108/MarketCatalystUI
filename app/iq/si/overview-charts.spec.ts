import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FACTS, type SiFacts } from "./data";
import { chartSpec, fiscalLabel, type ChartInput } from "./overview-charts";

// The design's sample stock: four quarters of growth and margins, and the peer averages around them.
const FACTS: SiFacts = {
  ...EMPTY_FACTS,
  revGrowth4q: 89.6,
  peerRevGrowth4q: 37.6,
  epsGrowth4q: 98.9,
  peerEpsGrowth4q: 53.1,
  peerOpMargin4q: 32.8,
  peerGrossMargin4q: 60,
  grossMargin: 74.8,
  trailingPe: 17.7,
  peerPe: 36.9,
  peerPeCount: 5,
  peerFwdPe: 20.7,
  peerFwdPeCount: 5,
  peerTickers: ["AMD", "AVGO", "INTC", "QCOM", "MU"],
};
const q = (period: string, year: number, revenue: number, op: number, gross: number) => ({ fiscalPeriod: period, fiscalYear: year, revenue, operatingIncome: (revenue * op) / 100, grossProfit: (revenue * gross) / 100 });
const INPUT: ChartInput = {
  ticker: "NVDA",
  facts: FACTS,
  forwardPe: 14.9,
  revenue: [
    { label: "Q4'26", yoy: 73, qoq: null },
    { label: "Q1'27", yoy: 85, qoq: null },
    { label: "Q2'27", yoy: 106, qoq: null },
    { label: "Q3'27", yoy: 103, qoq: null },
  ],
  eps: [
    { label: "Q4'26", yoy: 96, qoq: null },
    { label: "Q1'27", yoy: 214, qoq: null },
    { label: "Q2'27", yoy: 128, qoq: null },
    { label: "Q3'27", yoy: 108, qoq: null },
  ],
  quarters: [q("Q3", 2027, 100, 66.9, 74.8), q("Q2", 2027, 100, 66.2, 75), q("Q1", 2027, 100, 65.6, 74.9), q("Q4", 2026, 100, 65, 75)],
};

test("growth: four quarters of revenue growth against the stock's and the peers' four-quarter averages", () => {
  const s = chartSpec("Growth", INPUT)!;
  assert.deepEqual(s.groups, ["Q4 FY26", "Q1 FY27", "Q2 FY27", "Q3 FY27"]);
  assert.deepEqual(s.series[0].values, [73, 85, 106, 103]);
  assert.deepEqual(s.refs!.map((r) => r.label), ["NVDA 4-quarter avg +89.6%", "Top 5 peers avg +37.6%"]);
  assert.equal(s.fmt(103), "103%");
  assert.equal(s.fmt(-4.25), "−4.3%");
});

test("margins: operating and gross by quarter, oldest first, with the peers' averages", () => {
  const s = chartSpec("Margins", INPUT)!;
  assert.deepEqual(s.groups, ["Q4 FY26", "Q1 FY27", "Q2 FY27", "Q3 FY27"]);
  assert.deepEqual(s.series.map((x) => x.tag), ["Op.", "Gross"]);
  assert.deepEqual(s.series[0].values.map((v) => v!.toFixed(1)), ["65.0", "65.6", "66.2", "66.9"]);
  assert.deepEqual(s.refs!.map((r) => r.label), ["Top 5 peers avg operating 32.8%", "Top 5 peers avg gross 60.0%"]);
});

test("margins: no gross line without a gross margin", () => {
  const s = chartSpec("Margins", { ...INPUT, facts: { ...FACTS, grossMargin: null } })!;
  assert.equal(s.series.length, 1);
  assert.equal(s.refs!.length, 1);
});

test("earnings: EPS growth when there is any, else reported against estimate, else nothing", () => {
  const growth = chartSpec("Earnings", INPUT)!;
  assert.equal(growth.series[0].tag, "EPS y/y");
  assert.deepEqual(growth.refs!.map((r) => r.label), ["NVDA 4-quarter avg +98.9%", "Top 5 peers avg +53.1%"]);
  const reported = chartSpec("Earnings", {
    ...INPUT,
    eps: INPUT.eps.map((p) => ({ ...p, yoy: null })),
    quarters: [
      { fiscalPeriod: "Q2", fiscalYear: 2027, epsActualReported: 1.1, epsEstimateReported: 1.0 },
      { fiscalPeriod: "Q1", fiscalYear: 2027, epsActualReported: 0.9, epsEstimateReported: 1.0 },
    ],
  })!;
  assert.deepEqual(reported.series.map((x) => x.name), ["Estimate", "Actual"]);
  assert.equal(reported.series[1].color(0, true), "var(--ov-dn)");
  assert.equal(reported.series[1].color(1, true), "var(--ov-up)");
  const none = chartSpec("Earnings", { ...INPUT, eps: [], quarters: [] })!;
  assert.equal(none.groups.length, 0);
});

test("valuation: trailing and forward P/E against the peers' averages, cheaper in green", () => {
  const s = chartSpec("Valuation", INPUT)!;
  assert.deepEqual(s.groups, ["Trailing P/E", "Forward P/E"]);
  assert.deepEqual(s.series[0].values, [17.7, 14.9]);
  assert.deepEqual(s.series[1].values, [36.9, 20.7]);
  assert.equal(s.series[0].color(0, true), "var(--ov-up)");
  assert.equal(s.highlightLast, false);
  // Fewer than three peers with a P/E: the stock's own bar only, in the neutral colour.
  const alone = chartSpec("Valuation", { ...INPUT, facts: { ...FACTS, peerPeCount: 2, peerFwdPeCount: 1 } })!;
  assert.equal(alone.series.length, 1);
  assert.equal(alone.series[0].color(0, true), "var(--ov-eps)");
});

test("a read with no chart gets none, and fiscal labels read Q3 FY27", () => {
  assert.equal(chartSpec("Analysts", INPUT), null);
  assert.equal(fiscalLabel("Q3 '27"), "Q3 FY27");
});
