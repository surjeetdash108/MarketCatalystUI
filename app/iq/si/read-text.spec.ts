import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FACTS } from "./data";
import { fundamentalReadText, sentences, technicalReadText } from "./read-text";

test("fundamental read says so when no quarterly data has loaded", () => {
  assert.equal(fundamentalReadText("NVDA", EMPTY_FACTS, null), "Quarterly fundamentals for NVDA are not available yet.");
});

test("fundamental read describes growth, margin, earnings record and valuation", () => {
  const f = {
    ...EMPTY_FACTS,
    price: 100,
    revGrowthYoY: 62.4,
    opMargin: 60,
    opMarginYearAgo: 50,
    epsBeats: 8,
    epsReports: 8,
    fwdEps: 4,
    nextFyEps: 5,
    consensus: "Strong Buy",
    targetMean: 120,
  };
  const text = fundamentalReadText("NVDA", f, 22.5);
  assert.match(text, /NVDA is growing fast: revenue \+62\.4% y\/y, with an operating margin of 60\.0% \(up 10\.0 pts on a year ago\)\./);
  assert.match(text, /usually beats earnings estimates \(8 of the last 8 reports\) and analysts expect EPS to grow 25\.0% next year\./);
  assert.match(text, /Valuation is a moderate 22\.5× forward earnings, and analysts rate it Strong Buy with a \$120 target \(\+20\.0%\)\./);
});

test("technical read without averages keeps the not-available sentence", () => {
  assert.equal(technicalReadText(EMPTY_FACTS), "Moving-average data is not available for this stock yet.");
});

test("technical read adds momentum, strength and distance from the high", () => {
  const f = { ...EMPTY_FACTS, price: 90, sma50: 100, sma200: 95, rsi14: 38, rsRating: 40, rvol: 1.2, pctFromHigh52: -12.5 };
  const text = technicalReadText(f);
  assert.match(text, /Momentum is weak \(RSI 38\)\./);
  assert.match(text, /It is lagging the market \(RS rating 40\/99\), and volume is 1\.2× its 20-day average\./);
  assert.match(text, /Price sits 12\.5% below its 52-week high\./);
});

test("sentences splits on a full stop followed by a capital", () => {
  assert.deepEqual(sentences("One thing. Another thing. third stays with it."), ["One thing.", "Another thing. third stays with it."]);
});
