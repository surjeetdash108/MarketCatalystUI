import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FACTS, buildDrivers, thesisRun, type SiFacts } from "./data";
import { DRIVER_CATEGORIES, DRIVER_DOCS } from "./scoring-docs";

// The design file's own sample stock (NVDA): its facts, and the scores its engine gives them. Our engine must agree
// to two decimals, with ONE exception we keep on purpose: News sentiment. Ours weighs headlines by impact and shrinks
// toward neutral (the 14 Nov fix); the design scores 50 + 8 x (positive - negative). It is left out of the driver and
// Catalysts comparisons below, and MC Confidence is allowed the 0.5 points that difference can make (10% weight).
const FACTS: SiFacts = { ...EMPTY_FACTS, "price": 165.05,
  "changePct": 31.482514140046213,
  "sector": "Technology",
  "revGrowthYoY": 103.2136968038452,
  "grossMargin": 74.8213114188046,
  "opMargin": 66.91757881288629,
  "opMarginYearAgo": 63.16878925025436,
  "epsBeats": 4,
  "epsReports": 4,
  "trailingPe": 17.73,
  "consensus": "Buy",
  "buyCount": 28,
  "holdCount": 6,
  "sellCount": 0,
  "targetMean": 248.43,
  "analystTargets": [
    270,
    300,
    200,
    200,
    240
  ],
  "upgrades90": 2,
  "downgrades90": 0,
  "sma9": 148.95,
  "sma21": 149.58,
  "sma50": 206.08,
  "sma200": 203.04,
  "rsi14": 61.4,
  "pctFromHigh52": -32.18,
  "beta": 2.21,
  "realizedVol30": 60,
  "pivotR1": 172.05666666666667,
  "pivotR2": 179.06333333333333,
  "pivotS1": 157.48666666666668,
  "pivotS2": 149.92333333333335,
  "sectorRank": 10,
  "sectorRankTotal": 60,
  "instOwnershipPct": 63.71,
  "instHoldersChange": 48,
  "newsPos": 3,
  "newsNeg": 4,
  "revGrowth4q": 89.61053662852083,
  "epsGrowth4q": 98.88888888888889,
  "opMargin4q": 65.94365249772005,
  "grossMargin4q": 74.93171384440947,
  "peerRevGrowth4q": 37.647383745705255,
  "peerEpsGrowth4q": 53.142109777935865,
  "peerOpMargin4q": 32.83746783504436,
  "peerGrossMargin4q": 60.032641156358366,
  "peerTickers": [
    "AMD",
    "AVGO",
    "INTC",
    "QCOM",
    "MU"
  ],
  "peerPe": 36.88999999999999,
  "peerPeCount": 4,
  "peerFwdPe": 20.734,
  "peerFwdPeCount": 5 };

const DESIGN_CATEGORIES: Record<string, number> = {
  "BUS": 97.59,
  "EARN": 100,
  "TECH": 46.63,
  "CAT": 42,
  "VAL": 86.7,
  "POS": 62.4,
  "MAC": 60.17
};

const DESIGN_DRIVERS: Record<string, number> = {
  "Revenue growth": 100,
  "Revenue growth vs peers": 100,
  "Gross margin": 89.95,
  "Gross margin vs peers": 99.66,
  "Operating margin": 95.94,
  "Operating margin vs peers": 100,
  "Beat record": 100,
  "EPS growth": 100,
  "EPS growth vs peers": 100,
  "Trend vs 50/200 DMA": 25,
  "RSI(14)": 68.26,
  "News sentiment": 42,
  "P/E": 73.41,
  "P/E vs peers": 100,
  "13F holder count": 54.8,
  "Analyst rating changes": 70,
  "Sector rank": 88.33,
  "Volatility regime": 32
};

const NEWS = "News sentiment";

test("every driver the design scores for its sample stock gets the same score here", () => {
  const ours = new Map(buildDrivers(FACTS).map((d) => [d[1], d[3]]));
  for (const [name, expected] of Object.entries(DESIGN_DRIVERS)) {
    if (name === NEWS) continue;
    assert.ok(ours.has(name), `${name} is scored`);
    assert.ok(Math.abs(ours.get(name)! - expected) < 0.01, `${name}: ${ours.get(name)} vs ${expected}`);
  }
  assert.equal(ours.size, Object.keys(DESIGN_DRIVERS).length, "no driver the design does not have");
});

test("the seven category scores and MC Confidence match the design to two decimals", () => {
  const run = thesisRun("NVDA", "Bull", "6M", undefined, undefined, FACTS);
  for (const c of run.cats) {
    if (c.k === "CAT") continue; // holds News sentiment
    assert.ok(Math.abs(c.score - DESIGN_CATEGORIES[c.k]) < 0.01, `${c.k}: ${c.score} vs ${DESIGN_CATEGORIES[c.k]}`);
  }
  assert.ok(Math.abs(run.conf! - 77.7346) < 0.5, `confidence ${run.conf}`);
});

test("a fully met rule scores 100: there is no 95 ceiling", () => {
  const d = buildDrivers({ ...EMPTY_FACTS, revGrowth4q: 90, epsBeats: 4, epsReports: 4 });
  assert.equal(d.find((x) => x[1] === "Revenue growth")![3], 100);
  assert.equal(d.find((x) => x[1] === "Beat record")![3], 100);
});

test("six-month weights: Business 25, Earnings 20, Technicals 15, Catalysts 10, Valuation 15, Flows 5, Macro 10", () => {
  const run = thesisRun("NVDA", "Bull", "6M", undefined, undefined, FACTS);
  assert.deepEqual(run.W, { BUS: 25, EARN: 20, TECH: 15, CAT: 10, VAL: 15, POS: 5, MAC: 10 });
});

test("the Scoring rules table documents every driver this stock gets, once, under a known category", () => {
  const docs = DRIVER_DOCS.map((d) => d.driver);
  const scored = Object.keys(DESIGN_DRIVERS);
  assert.equal(new Set(docs).size, docs.length, "no driver is documented twice");
  for (const name of scored) assert.ok(docs.includes(name), `${name} has a rule row`);
  for (const d of DRIVER_DOCS) {
    assert.ok(DRIVER_CATEGORIES.includes(d.cat), d.cat);
  }
});

test("growth and margins fall back to the latest quarter without peers, and the peer rows disappear", () => {
  const f: SiFacts = { ...EMPTY_FACTS, revGrowthYoY: 20, grossMargin: 50 };
  const names = buildDrivers(f).map((x) => x[1]);
  assert.deepEqual(names, ["Revenue growth", "Gross margin"]);
  assert.equal(buildDrivers(f)[0][2], "+20.0% y/y (latest quarter)");
});

