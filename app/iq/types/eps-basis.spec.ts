import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { gaapQuarterEps, quarterYoY, quarterLabel, ADJUSTED_SURPRISE_LABEL } from "./financials";

// Real quarters from the deployed /live/financials (2026-10-26). Newest first,
// as the API serves them. PEP Q3 2026: GAAP diluted 2.23, FMP adjusted 2.34.
const fx = JSON.parse(readFileSync(new URL("../fixtures/financials-quarters.json", import.meta.url), "utf-8"));

describe("EPS basis: GAAP diluted for reported EPS, adjusted only for the surprise", () => {
  it("quarterly EPS is the GAAP diluted figure, not FMP's adjusted one", () => {
    assert.strictEqual(gaapQuarterEps(fx.PEP[0]), 2.23);
  });

  it("EPS growth y/y compares GAAP with GAAP (same fiscal period a year earlier)", () => {
    const latest = fx.PEP[0];
    const yearAgo = fx.PEP.find((q: { fiscalPeriod: string; fiscalYear: string }) =>
      q.fiscalPeriod === latest.fiscalPeriod && Number(q.fiscalYear) === Number(latest.fiscalYear) - 1);
    const g = quarterYoY(fx.PEP);
    assert.ok(g && yearAgo);
    assert.strictEqual(g!.epsYoy, ((latest.epsActual - yearAgo.epsActual) / Math.abs(yearAgo.epsActual)) * 100);
  });

  it("the newest quarter is labelled with its fiscal period and period end", () => {
    assert.strictEqual(quarterLabel(fx.PEP[0]), "Q3 FY26 (ended Sep 5)");
  });

  it("the surprise keeps the adjusted basis and says so", () => {
    assert.strictEqual(ADJUSTED_SURPRISE_LABEL, "Adjusted EPS vs estimate");
  });
});
