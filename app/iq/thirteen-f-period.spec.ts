import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filingDeadline, periodLabel, quarterCoverage } from "./thirteen-f-period";

describe("13F quarters", () => {
  it("labels and deadlines", () => {
    assert.equal(periodLabel(2026, 3), "Q3-26");
    assert.equal(filingDeadline(2026, 2), "Aug 14");
    assert.equal(filingDeadline(2026, 3), "Nov 14");
    assert.equal(filingDeadline(2026, 4), "Feb 14");
  });

  it("counts stocks per quarter, newest first, skipping docs without a period", () => {
    const docs = [
      { year: 2026, quarter: 2 }, { year: 2026, quarter: 2 }, { year: 2026, quarter: 3 },
      { year: null, quarter: null },
    ];
    assert.deepEqual(quarterCoverage(docs), [
      { label: "Q3-26", deadline: "Nov 14", count: 1 },
      { label: "Q2-26", deadline: "Aug 14", count: 2 },
    ]);
  });
});
