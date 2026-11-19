import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCREENS } from "./alpha-signals-model";
import type { CompanyDoc } from "./types";

const rows = (companies: CompanyDoc[]) => SCREENS.find(s => s.id === "eps")!.rows({ companies, sigs: [], analyst: new Map(), ipos: [], now: 0 });
const co = (o: Partial<CompanyDoc>) => ({ ticker: "MU", name: "Micron", sector: "Electronic Technology", type: "CS", price: 750, pctChange: 1, ...o }) as CompanyDoc;

// Nov 19 rows 9–10: EPS and revenue on one basis (FY reported statement).
describe("Earnings Acceleration shows EPS and revenue on the same FY basis", () => {
  it("uses FY diluted EPS growth when present (MU +879%)", () => {
    const [r] = rows([co({ epsDilutedGrowthYoY: 8.7926, epsGrowthYoY: 8.1086, revenueGrowthYoY: 2.5633 } as Partial<CompanyDoc>)]);
    assert.equal(r.why, "EPS (diluted, FY) +879% YoY, revenue +256% YoY.");
  });
  it("falls back to the labelled adjusted figure until the doc is refreshed", () => {
    const [r] = rows([co({ epsGrowthYoY: 8.1086, revenueGrowthYoY: 2.5633 })]);
    assert.equal(r.why, "Adjusted EPS +811% YoY, revenue +256% YoY.");
  });
});
