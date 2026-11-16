import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FACTS, thesisRun, thesisTargets, thesisWeights } from "./data";

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

test("every horizon's engine weights add up to 100, bullish and bearish", () => {
  for (const hz of ["1M", "3M", "6M", "9M"]) {
    assert.equal(sum(thesisWeights("Bull", hz)), 100, `${hz} bull`);
    assert.equal(sum(thesisWeights("Bear", hz)), 100, `${hz} bear`);
  }
});

test("horizons lean on different drivers: 1M on price action, 9M on business and valuation", () => {
  const short = thesisWeights("Bull", "1M");
  const mid = thesisWeights("Bull", "3M");
  const long = thesisWeights("Bull", "9M");
  assert.ok(short.TECH > mid.TECH && mid.TECH > long.TECH);
  assert.ok(long.BUS > short.BUS && long.VAL > short.VAL);
  assert.deepEqual(thesisWeights("Bull", "12M"), long, "the old 12M horizon reads as 9M");
});

test("a bearish run moves 5 points from Business and Technical to Valuation and Macro", () => {
  const bull = thesisWeights("Bull", "6M");
  const bear = thesisWeights("Bear", "6M");
  assert.equal(bear.BUS, bull.BUS - 5);
  assert.equal(bear.TECH, bull.TECH - 5);
  assert.equal(bear.VAL, bull.VAL + 5);
  assert.equal(bear.MAC, bull.MAC + 5);
});

const facts = {
  ...EMPTY_FACTS,
  price: 100,
  nextFyEps: 5,
  fwdEps: 4,
  targetMean: 130,
  buyCount: 20,
  holdCount: 5,
  sellCount: 1,
  pivotR1: 110,
  pivotS1: 90,
  sma50: 95,
  sma200: 80,
};

test("trade confidence stretches the target (0.6x to 1.4x) and the stop (0.8x to 1.2x)", () => {
  const at = (conf: number) => thesisTargets("TEST", "Bull", "6M", { conf }, 100, facts);
  const mid = at(50);
  const high = at(100);
  const low = at(0);
  assert.ok(mid.target > 100 && mid.stop < 100);
  const ratio = (a: number, b: number) => (a - 100) / (b - 100);
  assert.ok(Math.abs(ratio(high.target, mid.target) - 1.4) < 1e-9);
  assert.ok(Math.abs(ratio(low.target, mid.target) - 0.6) < 1e-9);
  assert.ok(Math.abs(ratio(high.stop, mid.stop) - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio(low.stop, mid.stop) - 0.8) < 1e-9);
});

test("without a confidence the plan is built at the neutral 50", () => {
  const none = thesisTargets("TEST", "Bull", "6M", {}, 100, facts);
  const fifty = thesisTargets("TEST", "Bull", "6M", { conf: 50 }, 100, facts);
  assert.equal(none.target, fifty.target);
  assert.equal(none.stop, fifty.stop);
});

test("a bearish plan puts the target below the price and the stop above it", () => {
  const t = thesisTargets("TEST", "Bear", "3M", { conf: 60 }, 100, facts);
  assert.ok(t.target < 100);
  assert.ok(t.stop > 100);
});

test("the 9M horizon reaches further than 6M and uses the 200 DMA for the stop level", () => {
  const six = thesisTargets("TEST", "Bull", "6M", { conf: 50 }, 100, facts);
  const nine = thesisTargets("TEST", "Bull", "9M", { conf: 50 }, 100, facts);
  assert.ok(nine.target > six.target);
  assert.equal(nine.lvl, facts.sma200);
  assert.equal(six.lvl, 90);
});

test("every driver counts the same: a run no longer gives core drivers double weight", () => {
  const run = thesisRun("TEST", "Bull", "6M", undefined, undefined, {
    ...EMPTY_FACTS,
    price: 100,
    sma50: 90,
    sma200: 80,
    rsRating: 90,
    revGrowthYoY: 10,
    grossMargin: 50,
  });
  const tech = run.cats.find((c) => c.k === "TECH");
  assert.ok(tech && tech.ds.length >= 2);
  const plain = tech.ds.reduce((s: number, d: { ev: number }) => s + d.ev, 0) / tech.ds.length;
  assert.ok(Math.abs(tech.score - plain) < 1e-9);
});
