import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FACTS } from "./data";
import { headlineRead, moveSummary } from "./si-headline";
import { fundamentalRead, overallVerdict, technicalRead, type ReadFacts } from "./si-reads";

const day = (d: number) => Date.UTC(2026, 10, d); // November 2026: the 20th is a Friday, the 23rd a Monday

// A sell-off to the 52-week low on Friday, then a jump on Monday.
const BARS = [
  { t: day(13), c: 200 },
  { t: day(16), c: 190 },
  { t: day(17), c: 180 },
  { t: day(18), c: 170 },
  { t: day(19), c: 160 },
  { t: day(20), c: 125.5 },
  { t: day(23), c: 165.05 },
];

const FACTS: ReadFacts = {
  ...EMPTY_FACTS,
  price: 165.05,
  changePct: 31.48,
  sma50: 206.08,
  sma200: 203.04,
  rsi14: 61,
  pctFromHigh52: -32.2,
  pivotR1: 172.06,
  pivotS1: 157.49,
  revGrowthYoY: 103.2,
  opMargin: 66.9,
  opMarginYearAgo: 63.1,
  epsBeats: 4,
  epsReports: 4,
  fwdEps: 4,
  nextFyEps: 6,
  trailingPe: 17.7,
  peerPe: 33,
  peerPeCount: 5,
};

function build(facts: ReadFacts, mc: number | null = 78) {
  const tech = technicalRead(facts);
  const fund = fundamentalRead(facts, 14.9);
  const overall = overallVerdict(tech.verdict, fund.verdict, mc);
  return { tech, fund, overall, read: headlineRead("NVDA", facts, tech, fund, overall, { bars: BARS, low52: 125.53 }) };
}

test("a low then a jump reads as a 52-week low on Friday, then the jump on Monday", () => {
  const m = moveSummary("NVDA", BARS, 125.53)!;
  assert.equal(m.text, "NVDA hit a 52-week low on Friday, then jumped 31.5% on Monday.");
  assert.ok(m.lastPct > 31 && m.prevPct < -20);
});

test("without a low in the last five sessions, the last move and the week", () => {
  const m = moveSummary("NVDA", BARS, 50)!;
  // five sessions earlier the close was 190: 165.05 is 13.1% under it
  assert.equal(m.text, "NVDA jumped 31.5% on Monday, and is down 13.1% over the last five sessions.");
});

test("small moves are 'rose' and 'slipped'", () => {
  const up = moveSummary("X", [{ t: day(18), c: 100 }, { t: day(19), c: 100 }, { t: day(20), c: 101 }], null)!;
  assert.equal(up.text, "X rose 1.0% on Friday.");
  const down = moveSummary("X", [{ t: day(18), c: 100 }, { t: day(19), c: 100 }, { t: day(20), c: 99 }], null)!;
  assert.equal(down.text, "X slipped 1.0% on Friday.");
});

test("fewer than three bars say nothing about a move", () => {
  assert.equal(moveSummary("X", [{ t: day(19), c: 100 }, { t: day(20), c: 101 }], null), null);
  assert.equal(moveSummary("X", undefined, null), null);
});

test("a strong, cheap business with an unconfirmed chart after a reversal", () => {
  const { read } = build(FACTS);
  assert.equal(read!.headline, "The sell-off reversed. The business is strong and cheap, but the chart hasn't confirmed the rebound.");
  assert.equal(
    read!.body,
    "NVDA hit a 52-week low on Friday, then jumped 31.5% on Monday. Revenue is up 103.2% y/y, and the stock trades at half the peer P/E. Price is still below its 50 DMA and 200 DMA, and two prices decide what happens next.",
  );
});

test("the body says DMA, never 50-day average", () => {
  const { read } = build(FACTS);
  assert.doesNotMatch(read!.body, /-day average|day averages/);
});

test("levels to watch: a close above confirms and a close below voids, with the distance from the price", () => {
  const { read } = build(FACTS);
  assert.deepEqual(
    read!.levels.map((l) => [l.title, l.priceText, l.sub, l.tone]),
    [
      ["Confirms: a close above", "$172.06", "Next resistance · 4.2% above today's price", "up"],
      ["Voids: a close below", "$157.49", "Next support · 4.6% below today's price", "down"],
    ],
  );
});

test("without peer P/E there is no cheap or pricey, and no peer sentence", () => {
  const { read } = build({ ...FACTS, peerPe: null, peerPeCount: null });
  assert.equal(read!.headline, "The sell-off reversed. The business is strong, but the chart hasn't confirmed the rebound.");
  assert.doesNotMatch(read!.body, /peer/);
});

test("a chart that agrees says so", () => {
  const strongChart: ReadFacts = { ...FACTS, price: 120, sma50: 100, sma200: 90, sma21: 110, rsi14: 60, rsRating: 90, pctFromHigh52: -1, pivotS1: 112, pivotR1: 130 };
  const { read, overall, tech } = build(strongChart);
  assert.equal(overall.dir, "up");
  assert.equal(tech.verdict.dir, "up");
  assert.match(read!.headline, /and the chart agrees\.$/);
  assert.equal(read!.chart!.label, "Chart agrees");
  assert.match(read!.body, /Price holds above its 50 DMA and 200 DMA\.$/);
});

test("a bearish read puts the levels the other way round", () => {
  const weak: ReadFacts = { ...EMPTY_FACTS, price: 90, sma50: 100, sma200: 110, sma21: 95, rsi14: 38, rsRating: 25, pivotR1: 96, pivotS1: 85, revGrowthYoY: -12, opMargin: -3, opMarginYearAgo: 2 };
  const { read, overall } = build(weak, 30);
  assert.equal(overall.dir, "down");
  assert.deepEqual(read!.levels.map((l) => l.title), ["Voids: a close above", "Confirms: a close below"]);
});

test("with no data at all there is no read", () => {
  const tech = technicalRead(EMPTY_FACTS);
  const fund = fundamentalRead(EMPTY_FACTS, null);
  assert.equal(headlineRead("X", EMPTY_FACTS, tech, fund, overallVerdict(tech.verdict, fund.verdict, null)), null);
});
