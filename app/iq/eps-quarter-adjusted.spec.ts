import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quarterlyEpsSalesRows } from "./eps-sales-data";
import type { QuarterFinancials } from "./types";

const q = (over: Partial<QuarterFinancials>): QuarterFinancials => ({
  fiscalPeriod: "Q4", fiscalYear: "2024", endDate: "2024-05-31", filingDate: null,
  revenue: 1_000_000_000, grossProfit: null, operatingIncome: null, netIncome: null,
  epsActual: null, epsEstimate: null, costOfRevenue: null, operatingExpenses: null,
  researchAndDevelopment: null, sellingGeneralAndAdministrative: null, incomeTaxExpense: null,
  dilutedAverageShares: null,
  ...over,
} as QuarterFinancials);

describe("quarterly EPS rows: no surprise % beside a blank EPS", () => {
  it("a quarter with only an adjusted actual shows it as the EPS (May-24)", () => {
    const [r] = quarterlyEpsSalesRows([q({ epsActualReported: 1.1, epsEstimateReported: 1.0 })]);
    assert.equal(r.monthLabel, "May-24");
    assert.equal(r.eps, 1.1);
    assert.notEqual(r.epsSurp, "—");
  });
  it("no EPS at all: the surprise is blank too", () => {
    const [r] = quarterlyEpsSalesRows([q({ epsActualReported: null, epsEstimateReported: 1.0 })]);
    assert.equal(r.eps, null);
    assert.equal(r.epsSurp, "—");
  });
});
