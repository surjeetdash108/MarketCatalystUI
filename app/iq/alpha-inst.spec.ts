import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCREENS } from "./alpha-signals-model";
import type { CompanyDoc } from "./types";

const rows = (companies: CompanyDoc[]) =>
  SCREENS.find(s => s.id === "inst")!.rows({ companies, sigs: [], analyst: new Map(), ipos: [], now: 0 });
const co = (ticker: string, shares: number, change: number, holders: number, holdersChange: number, asOf = "Q3 2026") =>
  ({ ticker, name: ticker, sector: "Technology", type: "CS", price: 10, pctChange: 0, inst13FShares: shares, inst13FSharesChange: change, inst13FHolders: holders, inst13FHoldersChange: holdersChange, instAsOf: asOf, avgVolume20: 5_000_000 }) as CompanyDoc;

// Errors 10–11: "17610200.0% more shares" — a prior quarter of 1 reported share
// (AEHL 176,103 now, +176,102) makes the ratio meaningless.
describe("Institutional Accumulation: a % only when the prior quarter can carry one", () => {
  it("AEHL: a near-empty prior quarter shows the share count, not 17610200%", () => {
    const [r] = rows([co("AEHL", 176_103, 176_102, 8, 7, "Q2 2026")]);
    assert.match(r.why, /7 more institutional holders and 176,102 more shares \(almost none reported the prior quarter\)/);
    assert.doesNotMatch(r.why, /%/);
  });
  it("a normal rise keeps a grouped percent", () => {
    const [r] = rows([co("MSFT", 1_200_000, 200_000, 50, 3)]);
    assert.match(r.why, /20\.0% more shares/);
  });
  it("percent rows rank above count-only rows, which rank by holders", () => {
    const out = rows([co("AEHL", 176_103, 176_102, 8, 7), co("MSFT", 1_200_000, 200_000, 50, 3), co("SXTC", 20_185, 20_182, 4, 2)]).map(r => r.ticker);
    assert.deepEqual(out, ["MSFT", "AEHL", "SXTC"]);
  });
});
