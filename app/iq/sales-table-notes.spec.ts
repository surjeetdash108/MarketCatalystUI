import { describe, it } from "node:test";
import assert from "node:assert";
import { hasPublicEarningsReport, salesChangeNote, salesSurpriseNote } from "./sales-table-notes";

// ANT's stored financials/ANT on 24 Nov 2026: seven quarters from the IPO
// filing, no EPS actual anywhere, one future report (24 Feb 2027).
const ANT = {
  epsHistory: [{ epsActual: null }],
  quarters: Array.from({ length: 7 }, () => ({ epsActualReported: null })),
};

describe("Financials sales table: what an empty cell says", () => {
  it("%Chg with no year-ago quarter is N/A with the reason, not 'No data'", () => {
    const n = salesChangeNote({ isQ: true, hasPriorPeriod: false });
    assert.strictEqual(n.label, "N/A");
    assert.match(n.title, /year-ago quarter/);
  });

  it("annual %Chg names the missing fiscal year", () => {
    const n = salesChangeNote({ isQ: false, hasPriorPeriod: false });
    assert.strictEqual(n.label, "N/A");
    assert.match(n.title, /prior fiscal year/);
  });

  it("%Chg with a prior period but a missing figure stays 'No data'", () => {
    const n = salesChangeNote({ isQ: true, hasPriorPeriod: true });
    assert.strictEqual(n.label, "No data");
    assert.match(n.title, /missing/);
  });

  it("ANT has made no earnings report, so its Surp is N/A and names the first report", () => {
    assert.strictEqual(hasPublicEarningsReport(ANT), false);
    const n = salesSurpriseNote({ reportedYet: false, nextReportLabel: "Feb 24, 2027" });
    assert.strictEqual(n.label, "N/A");
    assert.match(n.title, /Feb 24, 2027/);
  });

  it("with no upcoming report on the calendar the tooltip still explains", () => {
    const n = salesSurpriseNote({ reportedYet: false, nextReportLabel: null });
    assert.strictEqual(n.label, "N/A");
    assert.match(n.title, /Not reported yet/);
  });

  it("a company that has reported keeps 'No data' for a quarter with no recorded estimate", () => {
    const n = salesSurpriseNote({ reportedYet: true });
    assert.strictEqual(n.label, "No data");
    assert.match(n.title, /estimate/);
  });

  it("any vendor EPS actual, in the report history or on a quarter, counts as reported", () => {
    assert.strictEqual(hasPublicEarningsReport({ epsHistory: [{ epsActual: 0.4 }] }), true);
    assert.strictEqual(hasPublicEarningsReport({ quarters: [{ epsActualReported: 1.2 }] }), true);
    assert.strictEqual(hasPublicEarningsReport(null), false);
    assert.strictEqual(hasPublicEarningsReport({}), false);
  });
});
