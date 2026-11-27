import assert from "node:assert/strict";
import test from "node:test";
import { growthSeries, scoreRows, statusForTone, toneForScore } from "./overview-model";
import { growthHeadline } from "./si-overview";

const q = (fiscalPeriod: string, fiscalYear: number, endDate: string, revenue: number | null, epsActual: number | null) => ({
  fiscalPeriod,
  fiscalYear,
  endDate,
  revenue,
  epsActual,
});

// Newest first, as the financials doc stores them. Q3 FY27 is the latest.
const QUARTERS = [
  q("Q3", 2027, "2026-10-26", 400, 4),
  q("Q2", 2027, "2026-07-27", 300, 3),
  q("Q1", 2027, "2026-04-27", 250, 2),
  q("Q4", 2026, "2026-01-26", 200, 1),
  q("Q3", 2026, "2025-10-26", 150, 2),
  q("Q2", 2026, "2025-07-27", 120, 1.5),
  q("Q1", 2026, "2025-04-27", 100, 1),
  q("Q4", 2025, "2025-01-26", 90, 0.9),
];

test("growth is drawn oldest quarter first, four quarters, labelled by fiscal period", () => {
  const [rev] = growthSeries(QUARTERS);
  assert.equal(rev.key, "rev");
  assert.deepEqual(
    rev.rows.map((r) => r.label),
    ["Q4'26", "Q1'27", "Q2'27", "Q3'27"],
  );
});

test("year over year compares with the same fiscal period a year earlier", () => {
  const [rev, eps] = growthSeries(QUARTERS);
  const latest = rev.rows[3];
  assert.ok(Math.abs(latest.yoy! - ((400 - 150) / 150) * 100) < 1e-9);
  assert.ok(Math.abs(eps.rows[3].yoy! - ((4 - 2) / 2) * 100) < 1e-9);
});

test("quarter over quarter compares with the quarter before", () => {
  const [rev] = growthSeries(QUARTERS);
  assert.ok(Math.abs(rev.rows[3].qoq! - ((400 - 300) / 300) * 100) < 1e-9);
});

test("each bar names what it is measured against: the same quarter a year earlier, or the quarter before", () => {
  const [rev, eps] = growthSeries(QUARTERS);
  assert.deepEqual(
    rev.rows.map((r) => r.yoyVs),
    ["Q4'25", "Q1'26", "Q2'26", "Q3'26"],
  );
  assert.deepEqual(
    rev.rows.map((r) => r.qoqVs),
    ["Q3'26", "Q4'26", "Q1'27", "Q2'27"],
  );
  // Revenue and EPS share their quarters, so the axis can use either series' labels.
  assert.deepEqual(eps.rows.map((r) => [r.yoyVs, r.qoqVs]), rev.rows.map((r) => [r.yoyVs, r.qoqVs]));
});

test("a quarter with no year-ago quarter has no year-over-year base, and a gap shows the quarter really used", () => {
  const gappy = QUARTERS.filter((x) => !(x.fiscalPeriod === "Q3" && x.fiscalYear === 2026));
  const [rev] = growthSeries(gappy);
  const latest = rev.rows[rev.rows.length - 1];
  assert.equal(latest.yoyVs, null);
  // Q4 FY26 is now measured against Q2 FY26 (Q3 FY26 is missing), and the label says so rather than "Q3".
  assert.equal(rev.rows[0].qoqVs, "Q2'26");
});

test("a year-ago quarter that is missing leaves that year over year gap empty, not shifted", () => {
  // Drop Q3 FY26, the year-ago quarter of the latest one.
  const gappy = QUARTERS.filter((x) => !(x.fiscalPeriod === "Q3" && x.fiscalYear === 2026));
  const [rev] = growthSeries(gappy);
  assert.equal(rev.rows[rev.rows.length - 1].yoy, null);
});

test("growth over a base within 5 cents (EPS) is left out rather than shown as a huge percentage", () => {
  const nearZero = [q("Q3", 2027, "2026-10-26", 400, 1), q("Q3", 2026, "2025-10-26", 150, 0.03)];
  const eps = growthSeries(nearZero).find((s) => s.key === "eps")!;
  assert.equal(eps.rows[eps.rows.length - 1].yoy, null);
});

test("no quarters, no series", () => {
  assert.deepEqual(growthSeries(undefined), []);
  assert.deepEqual(growthSeries([]), []);
});

test("headline counts the straight quarters at 100% or more", () => {
  const rows = (yoy: Array<number | null>) => yoy.map((v, i) => ({ label: `Q${i + 1}'27`, yoy: v, qoq: null }));
  const s = (yoy: Array<number | null>) => ({ key: "rev" as const, name: "Revenue", rows: rows(yoy) });
  assert.equal(growthHeadline(s([73, 85, 106, 103]), "yoy"), "Revenue has doubled for 2 straight quarters");
  assert.equal(growthHeadline(s([110, 120, 130, 140]), "yoy"), "Revenue has doubled in each of the last 4 quarters");
  assert.equal(growthHeadline(s([20, 30, 40, 100]), "yoy"), "Revenue has doubled year over year");
  assert.equal(growthHeadline(s([20, 30, 40, 52]), "yoy"), "Revenue is up 52% year over year");
  assert.equal(growthHeadline(s([20, 30, 40, -8]), "yoy"), "Revenue is down 8% year over year");
  assert.equal(growthHeadline(s([20, 30, 40, null]), "yoy"), "");
});

test("quarter over quarter headline counts the straight quarters of growth", () => {
  const rows = (qoq: Array<number | null>) => qoq.map((v, i) => ({ label: `Q${i + 1}'27`, yoy: null, qoq: v }));
  const s = (qoq: Array<number | null>) => ({ key: "rev" as const, name: "Revenue", rows: rows(qoq) });
  assert.equal(growthHeadline(s([5, 6, 7, 8]), "qoq"), "Revenue has grown in each of the last 4 quarters");
  assert.equal(growthHeadline(s([-5, 6, 7, 8]), "qoq"), "Revenue has grown for 3 straight quarters");
  assert.equal(growthHeadline(s([5, 6, -7, 8]), "qoq"), "Revenue grew 8% last quarter");
  assert.equal(growthHeadline(s([5, 6, 7, -8]), "qoq"), "Revenue fell 8% last quarter");
});

test("score rows list Company first, skip categories with no data or no weight, and round", () => {
  const names = { BUS: "BUSINESS", EARN: "EARNINGS", TECH: "TECHNICALS", CAT: "CATALYSTS", VAL: "VALUATION", POS: "FLOWS", MAC: "MACRO" };
  const cat = (k: string, score: number, w: number, ds: number) => ({ k, label: k, w, score, ds: new Array(ds).fill(0) });
  const rows = scoreRows(
    [cat("TECH", 47.4, 20, 2), cat("MAC", 60, 10, 1), cat("BUS", 97.6, 25, 3), cat("CAT", 42, 0, 0), cat("VAL", 86.5, 15, 1), cat("POS", 0, 0, 1)],
    names,
  );
  assert.deepEqual(rows, [
    { k: "Business", v: 98 },
    { k: "Valuation", v: 87 },
    { k: "Macro", v: 60 },
    { k: "Technicals", v: 47 },
  ]);
});

test("a score reads bullish from 70, bearish under 40", () => {
  assert.equal(toneForScore(70), "up");
  assert.equal(toneForScore(69.4), "flat");
  assert.equal(toneForScore(40), "flat");
  assert.equal(toneForScore(39), "down");
  assert.equal(toneForScore(null), "flat");
  assert.equal(statusForTone("up"), "Bullish");
  assert.equal(statusForTone("down"), "Bearish");
  assert.equal(statusForTone("flat"), "Neutral");
});
