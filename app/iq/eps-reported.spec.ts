// Earnings tab: a company that has never reported earnings gets one clear message,
// not an EPS chart and a table of blanks. A freshly listed company still has quarters
// of revenue lifted from its IPO filing, so "are there rows" is not the test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasReportedEarnings } from "./eps-sales-data";

type Doc = Parameters<typeof hasReportedEarnings>[0];
const qtr = (p: Record<string, unknown>) => ({ revenue: 1_000_000, netIncome: -5_000_000, epsActual: null, epsActualReported: null, epsEstimateReported: null, ...p });
const doc = (quarters: Array<Record<string, unknown>>, epsHistory?: Array<Record<string, unknown>>) =>
  ({ quarters: quarters.map(qtr), epsHistory } as unknown as Doc);

describe("hasReportedEarnings", () => {
  it("no document: nothing reported", () => {
    assert.equal(hasReportedEarnings(null), false);
    assert.equal(hasReportedEarnings(undefined), false);
  });

  it("ANT as stored on 24 Nov 2026 (listed 19 Nov): revenue rows, a placeholder 0 EPS, only a future report: nothing reported", () => {
    const ant = doc(
      [
        { endDate: "2026-09-30", fiscalPeriod: "Q3", epsActual: 0, revenue: 16_956_000_000, netIncome: -23_291_000_000 },
        { endDate: "2026-06-30", fiscalPeriod: "Q2", revenue: 11_555_000_000 },
        { endDate: "2026-03-31", fiscalPeriod: "Q1", revenue: 4_731_000_000 },
        { endDate: "2025-12-31", fiscalPeriod: "Q4", revenue: 2_040_000_000 },
      ],
      [{ fiscalYear: 2027, fiscalPeriod: "Q1", date: "2027-02-24", epsActual: null, epsEstimate: 0.03 }],
    );
    assert.equal(hasReportedEarnings(ant), false);
  });

  it("a quarterly table with no EPS at all is not reported", () => {
    assert.equal(hasReportedEarnings(doc([{ fiscalPeriod: "Q1" }, { fiscalPeriod: "Q2" }], [])), false);
    assert.equal(hasReportedEarnings(doc([])), false);
  });

  it("an FMP EPS actual in the history is reported", () => {
    assert.equal(hasReportedEarnings(doc([], [{ date: "2026-08-01", epsActual: 1.2, epsEstimate: 1.1 }])), true);
  });

  it("an adjusted EPS actual on a quarter is reported", () => {
    assert.equal(hasReportedEarnings(doc([{ epsActualReported: 0.42 }])), true);
  });

  it("a real GAAP quarterly EPS (even a loss) is reported", () => {
    assert.equal(hasReportedEarnings(doc([{ epsActual: -1.37 }])), true);
    assert.equal(hasReportedEarnings(doc([{ epsActual: 2.1 }])), true);
  });

  it("one real quarter among placeholders is enough", () => {
    assert.equal(hasReportedEarnings(doc([{ epsActual: 0 }, { epsActual: null }, { epsActual: 0.18 }])), true);
  });

  it("a missing epsHistory field is handled", () => {
    assert.equal(hasReportedEarnings({ quarters: [] } as unknown as Doc), false);
  });
});
