import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FACTS } from "./data";
import { barPct, bigPct, chipPct, fundamentalLead, fundamentalsPane, niceMax, type FundamentalsInput, type FxMarginsTile, type FxStatTile, type FxValuationTile } from "./fundamentals-model";
import { fundamentalRead, type ReadFacts } from "./si-reads";

const facts = (over: Partial<ReadFacts>): ReadFacts => ({ ...EMPTY_FACTS, ...over });
const q = (period: string, year: number, gross: number, extra: Record<string, number> = {}) => ({ fiscalPeriod: period, fiscalYear: year, revenue: 1000, grossProfit: gross * 10, ...extra });

// PLTR as the design (pltr-fundamentals.html) shows it.
const PLTR_FACTS = facts({
  price: 180,
  revGrowthYoY: 96,
  revGrowth4q: 85.9,
  peerRevGrowth4q: 1.0,
  epsGrowth4q: 220,
  peerEpsGrowth4q: -2.9,
  opMargin: 46.9,
  opMarginYearAgo: 40.9,
  peerOpMargin4q: -19.6,
  grossMargin: 83.4,
  peerGrossMargin4q: 48.2,
  epsBeats: 4,
  epsReports: 4,
  trailingPe: 116.5,
  peerPe: 29.2,
  peerPeCount: 5,
});
const PLTR = (over: Partial<FundamentalsInput> = {}): FundamentalsInput => ({
  ticker: "PLTR",
  facts: PLTR_FACTS,
  forwardPe: 66.5,
  fund: fundamentalRead(PLTR_FACTS, 66.5),
  revenue: [
    { label: "Q4'25", yoy: 70, qoq: null },
    { label: "Q1'26", yoy: 85, qoq: null },
    { label: "Q2'26", yoy: 93, qoq: null },
    { label: "Q3'26", yoy: 96, qoq: null },
  ],
  eps: [
    { label: "Q4'25", yoy: null, qoq: null },
    { label: "Q1'26", yoy: 306, qoq: null },
    { label: "Q2'26", yoy: 215, qoq: null },
    { label: "Q3'26", yoy: 132, qoq: null },
  ],
  // newest first; gross margin 83.4 now, 87.0 four quarters back
  quarters: [q("Q3", 2026, 83.4), q("Q2", 2026, 84.9), q("Q1", 2026, 86.4), q("Q4", 2025, 87.0)],
  ...over,
});
const text = (segs: Array<{ t: string }>) => segs.map((s) => s.t).join("");
const tile = <T extends { kind: string }>(tiles: Array<{ kind: string }>, kind: T["kind"]) => tiles.find((t) => t.kind === kind) as unknown as T;

test("PLTR: the pill and the headline are the design's", () => {
  const p = fundamentalsPane(PLTR())!;
  assert.equal(p.pill.text, "Fundamentals · Bullish");
  assert.equal(p.pill.tone, "up");
  assert.equal(p.lead, "Strong business, but the price already reflects it. PLTR has to keep beating to hold this multiple.");
  assert.deepEqual(
    p.tiles.map((t) => t.kind),
    ["growth", "margins", "earnings", "valuation"],
  );
});

test("PLTR growth: +96%, peers +1.0%, four-quarter average +85.9%, four bars", () => {
  const g = tile<FxStatTile>(fundamentalsPane(PLTR())!.tiles, "growth");
  assert.equal(g.title, "GROWTH");
  assert.deepEqual(g.status, { text: "▲ Growing fast", tone: "up" });
  assert.equal(g.caption, "Revenue growth y/y");
  assert.equal(g.period, "Q3 FY26");
  assert.deepEqual(g.big, { text: "+96%", tone: "up" });
  assert.deepEqual(
    g.chips.map((c) => [c.label, c.value]),
    [
      ["PEERS AVG", "+1.0%"],
      ["PLTR 4Q AVG", "+85.9%"],
    ],
  );
  assert.equal(g.badge, null, "accelerating growth carries no Slowing mark");
  assert.deepEqual(
    g.mini!.bars.map((b) => [b.x, b.text, b.latest]),
    [
      ["Q4'25", "70%", false],
      ["Q1'26", "85%", false],
      ["Q2'26", "93%", false],
      ["Q3'26", "96%", true],
    ],
  );
  const h = g.mini!.bars.map((b) => b.h);
  assert.equal(h[3], 60, "the tallest bar is the plot's full bar height");
  assert.ok(h[0] < h[1] && h[1] < h[2] && h[2] < h[3]);
});

test("PLTR margins: 46.9% up from 40.9%, gross 83.4% steady at 83-87% with the peers' tick at 48.2", () => {
  const m = tile<FxMarginsTile>(fundamentalsPane(PLTR())!.tiles, "margins");
  assert.deepEqual(m.status, { text: "▲ Expanding", tone: "up" });
  const [op, gross] = m.rows;
  assert.equal(op.name, "Operating");
  assert.equal(op.text, "46.9%");
  assert.equal(op.width, 46.9);
  assert.equal(op.fill, "up");
  assert.equal(op.tick, null, "peers at -19.6% do not fit the 0-100 scale, so no tick");
  assert.equal(text(op.sub), "Up from 40.9% a year ago · peers −19.6%");
  assert.equal(op.sub.find((s) => s.strong)!.tone, "dn");
  assert.equal(gross.name, "Gross");
  assert.equal(gross.text, "83.4%");
  assert.equal(gross.fill, "blue");
  assert.deepEqual(gross.tick, { at: 48.2, label: "Peers 48.2%" });
  assert.equal(text(gross.sub), "Steady at 83–87% · white tick = peers 48.2%");
});

test("PLTR earnings: +132% and slowing, peers -2.9%, peak +306% in Q1'26, Q4'25 n/a", () => {
  const e = tile<FxStatTile>(fundamentalsPane(PLTR())!.tiles, "earnings");
  assert.deepEqual(e.status, { text: "▲ Beats often", tone: "up" });
  assert.equal(e.caption, "EPS growth y/y");
  assert.equal(e.period, "Q3 FY26");
  assert.deepEqual(e.big, { text: "+132%", tone: "blue" });
  assert.deepEqual(e.badge, { text: "▼ Slowing", tone: "warn" });
  assert.deepEqual(
    e.chips.map((c) => [c.label, c.value, c.tone]),
    [
      ["PEERS AVG", "−2.9%", "dn"],
      ["PEAK · Q1'26", "+306%", "hi"],
    ],
  );
  assert.deepEqual(
    e.mini!.bars.map((b) => [b.x, b.text, b.tone]),
    [
      ["Q4'25", "n/a", "none"],
      ["Q1'26", "306%", "blue"],
      ["Q2'26", "215%", "blue"],
      ["Q3'26", "132%", "blue"],
    ],
  );
  assert.equal(e.mini!.bars[0].h, 0);
});

test("PLTR valuation: 116.5x is 4.0x the peers' 29.2x, forward 66.5x, about 75% growth priced in", () => {
  const v = tile<FxValuationTile>(fundamentalsPane(PLTR())!.tiles, "valuation");
  assert.deepEqual(v.status, { text: "▼ Pricier than peers", tone: "dn" });
  assert.equal(v.caption, "Trailing P/E");
  assert.equal(v.period, "today");
  assert.deepEqual(v.big, { text: "116.5×", tone: "dn" });
  assert.deepEqual(v.badge, { text: "4.0× peers", tone: "dn" });
  assert.deepEqual(
    v.chips.map((c) => [c.label, c.value]),
    [
      ["PEERS AVG", "29.2×"],
      ["FORWARD P/E", "66.5×"],
    ],
  );
  const line = v.line!;
  assert.equal(line.max, 120);
  assert.equal(line.mid, 60);
  assert.deepEqual(
    line.markers.map((m) => [m.key, m.text, Math.round(m.at * 10) / 10, m.above]),
    [
      ["peers", "29.2×", 24.3, false],
      ["fwd", "66.5×", 55.4, false],
      ["now", "116.5×", 97.1, true],
    ],
  );
  assert.equal(line.seg!.side, "r");
  assert.equal(v.note, "Forward P/E implies about 75% EPS growth is already priced in.");
});

test("growth that slowed carries the Slowing mark; a flat blip does not", () => {
  const slow = tile<FxStatTile>(fundamentalsPane(PLTR({ revenue: [{ label: "Q4'25", yoy: 40, qoq: null }, { label: "Q1'26", yoy: 31, qoq: null }] }))!.tiles, "growth");
  assert.equal(slow.badge?.text, "▼ Slowing");
  const blip = tile<FxStatTile>(fundamentalsPane(PLTR({ revenue: [{ label: "Q4'25", yoy: 40.4, qoq: null }, { label: "Q1'26", yoy: 40, qoq: null }] }))!.tiles, "growth");
  assert.equal(blip.badge, null);
});

test("a negative operating margin draws no bar and reads red; peers inside 0-100 get the tick text", () => {
  const f = facts({ revGrowthYoY: 5, opMargin: -12.3, opMarginYearAgo: -20, grossMargin: 40, peerOpMargin4q: 15, peerGrossMargin4q: 55 });
  const m = tile<FxMarginsTile>(fundamentalsPane(PLTR({ facts: f, fund: fundamentalRead(f, null), quarters: [q("Q3", 2026, 40)] }))!.tiles, "margins");
  const [op, gross] = m.rows;
  assert.deepEqual([op.text, op.tone, op.width, op.fill], ["−12.3%", "dn", 0, "dn"]);
  assert.deepEqual(op.tick, { at: 15, label: "Peers 15.0%" });
  assert.equal(text(op.sub), "Up from −20.0% a year ago · white tick = peers 15.0%");
  assert.equal(text(gross.sub), "white tick = peers 55.0%", "one quarter of gross margin gives no trend line");
});

test("a gross margin that moved more than five points says where it started", () => {
  const f = { ...PLTR_FACTS, grossMargin: 70 };
  const m = tile<FxMarginsTile>(fundamentalsPane(PLTR({ facts: f, fund: fundamentalRead(f, 66.5), quarters: [q("Q3", 2026, 70), q("Q2", 2026, 66), q("Q1", 2026, 64), q("Q4", 2025, 62)] }))!.tiles, "margins");
  assert.match(text(m.rows[1].sub), /^Up from 62\.0% in Q4 FY25/);
});

test("without a trailing P/E the tile uses the forward one against the peers' forward P/E", () => {
  const f = facts({ ...PLTR_FACTS, trailingPe: null, peerPe: null, peerPeCount: null, peerFwdPe: 25, peerFwdPeCount: 5 });
  const v = tile<FxValuationTile>(fundamentalsPane(PLTR({ facts: f, forwardPe: 20, fund: fundamentalRead(f, 20) }))!.tiles, "valuation");
  assert.equal(v.caption, "Forward P/E");
  assert.equal(v.big.text, "20.0×");
  assert.deepEqual(v.badge, { text: "0.8× peers", tone: "mid" });
  assert.deepEqual(
    v.chips.map((c) => c.label),
    ["PEERS AVG"],
  );
  assert.deepEqual(
    v.line!.markers.map((m) => m.key),
    ["peers", "now"],
  );
  assert.equal(v.note, null);
});

test("with no peers the P/E tile still shows the forward figure and what it prices in; with no P/E at all the analysts stand in", () => {
  const f = facts({ ...PLTR_FACTS, peerPe: null, peerPeCount: null });
  const v = tile<FxValuationTile>(fundamentalsPane(PLTR({ facts: f, fund: fundamentalRead(f, 66.5) }))!.tiles, "valuation");
  assert.equal(v.badge, null);
  assert.deepEqual(
    v.chips.map((c) => c.label),
    ["FORWARD P/E"],
  );

  const noPe = facts({ price: 100, revGrowthYoY: -4, opMargin: 8, opMarginYearAgo: 8, targetMean: 120, consensus: "Buy", analystTargets: [110, 120, 130] });
  const pane = fundamentalsPane(PLTR({ facts: noPe, forwardPe: null, fund: fundamentalRead(noPe, null), quarters: [], revenue: [], eps: [] }))!;
  const a = tile<FxStatTile>(pane.tiles, "analysts");
  assert.equal(a.title, "VALUATION");
  assert.equal(a.period, "", "the caption is about targets, not a moment, so it has no period");
  assert.deepEqual(a.big, { text: "+20%", tone: "up" });
  assert.deepEqual(
    a.chips.map((c) => [c.label, c.value]),
    [
      ["TOP 3 AVG TARGET", "$120.00"],
      ["MEDIAN", "$120.00"],
    ],
  );
  assert.equal(pane.tiles.some((t) => t.kind === "valuation"), false);
});

test("with no year-over-year EPS the earnings tile shows the beat record and the EPS it reported", () => {
  const f = facts({ ...PLTR_FACTS, epsBeats: 3, epsReports: 4 });
  const quarters = [
    q("Q3", 2026, 80, { epsActualReported: 0.4, epsEstimateReported: 0.3 }),
    q("Q2", 2026, 80, { epsActualReported: 0.3, epsEstimateReported: 0.35 }),
    q("Q1", 2026, 80, { epsActualReported: 0.2, epsEstimateReported: 0.1 }),
  ];
  const e = tile<FxStatTile>(fundamentalsPane(PLTR({ facts: f, fund: fundamentalRead(f, 66.5), eps: [{ label: "Q3'26", yoy: null, qoq: null }], quarters }))!.tiles, "earnings");
  assert.equal(e.big.text, "3 of 4");
  assert.equal(e.big.tone, "up");
  assert.equal(e.badge, null);
  assert.deepEqual(
    e.mini!.bars.map((b) => [b.x, b.text, b.tone]),
    [
      ["Q1'26", "$0.20", "up"],
      ["Q2'26", "$0.30", "dn"],
      ["Q3'26", "$0.40", "up"],
    ],
  );
});

test("peers, forward and price within a few points of each other: the dots stay put, the labels are moved apart", () => {
  // JPM on 27 Nov: peers 11.6x, forward 12.6x, trailing 13.6x on a 0-20x axis.
  const f = facts({ ...PLTR_FACTS, trailingPe: 13.6, peerPe: 11.6, peerPeCount: 5 });
  const v = tile<FxValuationTile>(fundamentalsPane(PLTR({ facts: f, forwardPe: 12.6, fund: fundamentalRead(f, 12.6) }))!.tiles, "valuation");
  const m = Object.fromEntries(v.line!.markers.map((x) => [x.key, x]));
  assert.equal(v.line!.max, 20);
  assert.ok(Math.abs(m.peers.at - 58) < 1e-9 && Math.abs(m.fwd.at - 63) < 1e-9, "dots at their true values");
  assert.ok(m.fwd.labelAt - m.peers.labelAt >= 20, "labels at least 20% of the line apart");
  assert.ok(m.peers.labelAt < m.fwd.at && m.fwd.labelAt > m.peers.at, "in the order of the dots");
  assert.equal(m.now.above, true);
  // Markers near the right end keep their labels inside the line.
  const g = facts({ ...PLTR_FACTS, trailingPe: 19.8, peerPe: 19.5, peerPeCount: 5 });
  const w = tile<FxValuationTile>(fundamentalsPane(PLTR({ facts: g, forwardPe: 19.6, fund: fundamentalRead(g, 19.6) }))!.tiles, "valuation");
  const labels = w.line!.markers.filter((x) => !x.above).map((x) => x.labelAt);
  assert.ok(Math.max(...labels) <= 89 && Math.min(...labels) >= 11 && Math.max(...labels) - Math.min(...labels) >= 20);
});

test("a stock with nothing reported has no pane", () => {
  assert.equal(fundamentalsPane(PLTR({ facts: EMPTY_FACTS, fund: fundamentalRead(EMPTY_FACTS, null), forwardPe: null, revenue: [], eps: [], quarters: [] })), null);
});

test("the headline names the stock where the design does, and every call has one", () => {
  assert.equal(fundamentalLead("NVDA", "rich"), "Expensive without growth to back it. NVDA is vulnerable to any miss.");
  assert.equal(fundamentalLead("NVDA", "strong"), "Strong business, and the price isn’t stretched against it.");
  assert.equal(fundamentalLead("NVDA", "weakening"), "Fundamentals are weakening. Earnings need to turn before the story improves.");
  assert.equal(fundamentalLead("NVDA", "mixed"), "Mixed picture. No strong fundamental push either way.");
  assert.equal(fundamentalLead("NVDA", "none"), "Quarterly fundamentals aren’t synced for this stock yet.");
});

test("number formats and the P/E axis", () => {
  assert.equal(bigPct(96.4), "+96%");
  assert.equal(bigPct(7.25), "+7.3%");
  assert.equal(bigPct(-12), "−12%");
  assert.equal(chipPct(1), "+1.0%");
  assert.equal(chipPct(-2.94), "−2.9%");
  assert.equal(chipPct(85.94), "+85.9%");
  assert.equal(chipPct(306.2), "+306%");
  assert.equal(barPct(306), "306%");
  assert.equal(barPct(-5.24), "−5.2%");
  assert.equal(niceMax(116.5), 120);
  assert.equal(niceMax(29.2), 40);
  assert.equal(niceMax(5), 20);
  assert.equal(niceMax(230), 300);
});
