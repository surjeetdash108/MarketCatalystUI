import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FACTS, type SiFacts } from "./data";
import { blend, fundamentalRead, overallVerdict, supportResistance, technicalRead, topTargets, verdictLabel, verdictStatus } from "./si-reads";

const facts = (over: Partial<SiFacts>): SiFacts => ({ ...EMPTY_FACTS, ...over });

// NVDA in the design's sample: below both averages after a sell-off, RSI 61, 32% under its high.
const NVDA = facts({
  price: 165.05,
  changePct: 31.48,
  sma50: 206.08,
  sma200: 203.04,
  rsi14: 61,
  pctFromHigh52: -32.2,
  realizedVol30: 60,
  pivotR1: 172.06,
  pivotR2: 179.06,
  pivotS1: 157.49,
  rsRating: 85,
  rvol: 2.7,
});

test("trend votes on the 200 DMA, the 50 DMA and their order", () => {
  const r = technicalRead(NVDA).reads.find((x) => x.k === "Trend")!;
  // below the 200 (-1), below the 50 (-1), 50 above 200 (+1): -1/3
  assert.ok(Math.abs(r.score - -1 / 3) < 1e-9);
  assert.equal(r.headline, "Leaning down");
  assert.equal(r.dir, "down");
  assert.equal(r.detail, "Price below 200 DMA and below 50 DMA");
});

test("trend needs a price and at least one average", () => {
  assert.equal(technicalRead(facts({ sma50: 100 })).reads.length, 0);
  assert.equal(technicalRead(facts({ price: 100 })).reads.find((x) => x.k === "Trend"), undefined);
});

test("momentum: 55 and over is strong, 70 and over is stretched, 30 and under is oversold", () => {
  const m = (rsi: number) => technicalRead(facts({ price: 100, rsi14: rsi })).reads.find((x) => x.k === "Momentum")!;
  assert.equal(m(61).headline, "Strong");
  assert.equal(m(61).dir, "up");
  assert.equal(m(50).headline, "Neutral");
  assert.equal(m(40).headline, "Weak");
  assert.equal(m(75).headline, "Stretched");
  assert.equal(m(75).caution, true);
  assert.match(m(75).detail, /overbought/);
  assert.equal(m(25).headline, "Oversold");
  assert.equal(m(25).score, -0.4);
});

test("52-week position reads how far under the high the price sits", () => {
  const r = technicalRead(NVDA).reads.find((x) => x.k === "52W position")!;
  assert.equal(r.headline, "Well off highs");
  assert.equal(r.detail, "32.2% below the 52-week high");
  assert.equal(technicalRead(facts({ price: 100, pctFromHigh52: -2 })).reads.find((x) => x.k === "52W position")!.headline, "At the highs");
});

test("volume only counts on a heavy day, in the direction of the day", () => {
  const v = (rvol: number, changePct: number) => technicalRead(facts({ price: 100, rvol, changePct })).reads.find((x) => x.k === "Volume")!;
  assert.equal(v(2.7, 3).headline, "Heavy buying");
  assert.equal(v(2.7, -3).headline, "Heavy selling");
  assert.equal(v(2.7, 0.1).headline, "Heavy, flat day");
  assert.equal(v(1.0, 3).headline, "Normal");
  assert.equal(v(0.5, 3).headline, "Quiet");
  assert.equal(v(2.7, 3).detail, "2.7× the 20-day average on a rising day");
});

test("levels: pivots, averages and the 52-week high, split around the price, nearest first", () => {
  const { supports, resistances } = supportResistance(NVDA);
  assert.deepEqual(supports.map((l) => l.label), ["S1"]);
  assert.deepEqual(resistances.map((l) => l.label), ["R1", "R2", "200 DMA", "50 DMA", "52W high"]);
  assert.equal(resistances[0].label, "R1");
  assert.ok(Math.abs(resistances[0].pct - (172.06 / 165.05 - 1) * 100) < 1e-9);
  assert.ok(resistances.every((l, i, a) => i === 0 || a[i - 1].value <= l.value), "ascending");
  assert.equal(supports[0].kind, "support");
});

test("a level within 0.05% of the price is the price, not a level", () => {
  const { supports, resistances } = supportResistance(facts({ price: 100, sma50: 100.04, pivotS1: 95 }));
  assert.equal(resistances.length, 0);
  assert.deepEqual(supports.map((l) => l.label), ["S1"]);
});

test("no price, no levels", () => {
  assert.deepEqual(supportResistance(facts({ pivotS1: 95 })), { supports: [], resistances: [] });
});

test("a downtrend says sellers are in control and names the 50 DMA to reclaim", () => {
  const t = technicalRead(facts({ price: 90, sma50: 100, sma200: 110, sma21: 95, rsi14: 38, rsRating: 25 }));
  assert.equal(t.verdict.dir, "down");
  assert.equal(t.action, "Sellers are in control. A reclaim of the 50 DMA $100.00 is the first sign of a turn.");
});

test("an uptrend with an overbought RSI is called stretched", () => {
  const t = technicalRead(facts({ price: 120, sma50: 100, sma200: 90, sma21: 110, rsi14: 78, rsRating: 90, pivotS1: 112 }));
  assert.equal(t.verdict.dir, "up");
  assert.match(t.action, /^Trend is up but stretched — a pullback toward \$112\.00/);
});

test("an uptrend names first support and where the trend breaks", () => {
  const t = technicalRead(facts({ price: 120, sma50: 100, sma200: 90, sma21: 110, rsi14: 60, rsRating: 90, pivotS1: 112 }));
  assert.equal(t.action, "Buyers are in control. First support is S1 $112.00; the trend breaks on a close below 50 DMA $100.00.");
});

test("no data, no direction", () => {
  const t = technicalRead(EMPTY_FACTS);
  assert.equal(t.verdict.n, 0);
  assert.equal(t.verdict.label, "NOT ENOUGH DATA");
  assert.equal(t.action, "Not enough price history yet to call a direction.");
});

test("fundamentals: a strong business at a fair price", () => {
  const f = facts({ price: 165, revGrowthYoY: 103.2, opMargin: 66.9, opMarginYearAgo: 63.1, epsBeats: 4, epsReports: 4, fwdEps: 4, nextFyEps: 6 });
  const r = fundamentalRead(f, 14.9);
  assert.equal(r.reads.find((x) => x.k === "Growth")!.headline, "Growing fast");
  assert.equal(r.reads.find((x) => x.k === "Margins")!.headline, "Expanding");
  assert.equal(r.reads.find((x) => x.k === "Earnings")!.headline, "Beats often");
  assert.equal(r.reads.find((x) => x.k === "Valuation")!.headline, "Cheap");
  assert.equal(r.action, "Business momentum is solid and the price isn't stretched against it.");
  assert.equal(r.verdict.dir, "up");
});

test("fundamentals: a strong business at a very high multiple", () => {
  const r = fundamentalRead(facts({ price: 165, revGrowthYoY: 40, opMargin: 30, opMarginYearAgo: 28, epsBeats: 4, epsReports: 4 }), 60);
  assert.equal(r.action, "The business is strong but the price already reflects it — the stock needs to keep beating to hold this multiple.");
});

test("fundamentals: expensive with no growth is vulnerable", () => {
  const r = fundamentalRead(facts({ price: 165, revGrowthYoY: 0, opMargin: 5, opMarginYearAgo: 5 }), 60);
  assert.equal(r.action, "Expensive without growth to back it — vulnerable to any miss.");
});

test("fundamentals: with nothing reported it says so", () => {
  const r = fundamentalRead(EMPTY_FACTS, null);
  assert.equal(r.verdict.n, 0);
  assert.equal(r.action, "Quarterly fundamentals aren't synced for this stock yet.");
  assert.deepEqual(r.reads, []);
});

test("a short beat record counts for less than a full one", () => {
  const full = fundamentalRead(facts({ epsBeats: 4, epsReports: 4 }), null).reads[0];
  const short = fundamentalRead(facts({ epsBeats: 2, epsReports: 2 }), null).reads[0];
  assert.ok(Math.abs(short.score) < Math.abs(full.score));
  assert.equal(short.headline, "Beat so far");
});

test("without the top analysts' list the analyst read uses the mean target", () => {
  const r = fundamentalRead(facts({ price: 100, targetMean: 120, consensus: "Buy", upgrades90: 2, downgrades90: 0 }), null);
  const a = r.reads.find((x) => x.k === "Analysts")!;
  assert.equal(a.headline, "Upside to target");
  assert.equal(a.detail, "Buy · target $120.00 (+20.0%) · 2↑ 0↓ in 90d");
});

test("with the top analysts' list it quotes their average and median", () => {
  assert.deepEqual(topTargets([100, 110, 120, 130, 140, 999]), { n: 5, avg: 120, median: 120 });
  assert.equal(topTargets([]), null);
  assert.equal(topTargets([0, NaN]), null);
});

test("verdict labels step at 0.5 and 0.2", () => {
  assert.equal(verdictLabel(0.5), "BULLISH");
  assert.equal(verdictLabel(0.3), "LEAN BULLISH");
  assert.equal(verdictLabel(0), "NEUTRAL");
  assert.equal(verdictLabel(-0.3), "LEAN BEARISH");
  assert.equal(verdictLabel(-0.5), "BEARISH");
});

test("blend ignores missing reads and re-weights the rest", () => {
  const v = blend([
    { read: { score: 1 }, w: 0.5 },
    { read: null, w: 0.5 },
  ]);
  assert.equal(v.score, 1);
  assert.equal(v.n, 1);
  assert.equal(blend([]).label, "NOT ENOUGH DATA");
});

test("the overall verdict takes the technical read, the fundamental read and MC Confidence", () => {
  const bull = { dir: "up" as const, score: 0.6, label: "BULLISH", n: 3 };
  const none = { dir: "flat" as const, score: 0, label: "NOT ENOUGH DATA", n: 0 };
  assert.equal(overallVerdict(bull, bull, 90).label, "BULLISH");
  // Only MC Confidence has data: 78 -> (78 - 50) / 40 = 0.7
  const onlyMc = overallVerdict(none, none, 78);
  assert.equal(onlyMc.n, 1);
  assert.ok(Math.abs(onlyMc.score - 0.7) < 1e-9);
  assert.equal(overallVerdict(none, none, null).n, 0);
});

test("the menu status is the label in sentence case, or No data", () => {
  assert.deepEqual(verdictStatus({ dir: "up", score: 0.3, label: "LEAN BULLISH", n: 2 }), { status: "Lean bullish", tone: "up" });
  assert.deepEqual(verdictStatus({ dir: "flat", score: 0, label: "NOT ENOUGH DATA", n: 0 }), { status: "No data", tone: "flat" });
});
