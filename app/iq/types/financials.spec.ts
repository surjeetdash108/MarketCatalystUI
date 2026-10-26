import { test, describe, it } from "node:test";
import assert from "node:assert";
import { formatEpsSurprise, quarterEpsSurpriseStr, computeOperatingIncomeSeries } from "./financials";

describe("formatEpsSurprise", () => {
  it("formats MAMA small estimate |est| < 0.05 as dollar difference instead of dash", () => {
    // MAMA 2026-09-03: actual 0.06 vs estimate 0.0475
    const surp = formatEpsSurprise(0.06, 0.0475);
    assert.strictEqual(surp, "+$0.01 vs est");
  });

  it("formats EPM small estimate |est| < 0.05 as dollar difference instead of dash", () => {
    // EPM 2026-09-15: actual 0.13 vs estimate 0.00667
    const surp = formatEpsSurprise(0.13, 0.00667);
    assert.strictEqual(surp, "+$0.12 vs est");
  });

  it("formats negative difference with small estimate as -$0.XX vs est", () => {
    const surp = formatEpsSurprise(0.01, 0.03);
    assert.strictEqual(surp, "-$0.02 vs est");
  });

  it("formats standard percentage when |estimate| >= 0.05", () => {
    const surp = formatEpsSurprise(1.20, 1.00);
    assert.strictEqual(surp, "+20%");
  });

  it("returns dash when actual or estimate is missing", () => {
    assert.strictEqual(formatEpsSurprise(null, 0.05), "—");
    assert.strictEqual(formatEpsSurprise(0.05, null), "—");
  });

  it("quarterEpsSurpriseStr formats MAMA and EPM quarters using dollar difference", () => {
    const mamaQ = { epsActualReported: 0.06, epsEstimateReported: 0.0475 } as any;
    assert.strictEqual(quarterEpsSurpriseStr(mamaQ), "+$0.01 vs est");

    const epmQ = { epsActualReported: 0.13, epsEstimateReported: 0.00667 } as any;
    assert.strictEqual(quarterEpsSurpriseStr(epmQ), "+$0.12 vs est");
  });
});


describe("computeOperatingIncomeSeries", () => {
  it("never falls back to net income when operating income is missing and returns empty series", () => {
    // A financial entity / bank or company without operating income
    const fmpQ = [
      { operatingIncome: null, netIncome: 1.5e9 },
      { operatingIncome: null, netIncome: 1.8e9 }
    ];
    const series = computeOperatingIncomeSeries(fmpQ, false);
    // Must return empty array so UI renders "—", never [1.5, 1.8]
    assert.deepStrictEqual(series, []);
  });

  it("returns empty series when isBank is true even if netIncome exists", () => {
    const fmpQ = [
      { operatingIncome: 1.0e9, netIncome: 1.5e9 },
      { operatingIncome: 1.2e9, netIncome: 1.8e9 }
    ];
    const series = computeOperatingIncomeSeries(fmpQ, true);
    assert.deepStrictEqual(series, []);
  });

  it("returns operating income divided by 1e9 when operating income is present", () => {
    const fmpQ = [
      { operatingIncome: 2.5e9, netIncome: 1.5e9 },
      { operatingIncome: 3.0e9, netIncome: 2.0e9 }
    ];
    const series = computeOperatingIncomeSeries(fmpQ, false);
    assert.deepStrictEqual(series, [2.5, 3.0]);
  });
});

