import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { withNextEarnings } from "./useAlphaPicks";
import type { CompanyDoc } from "../types";

// Logic #7 / "Not verifiable" NEXT EARNINGS: the bulk company docs carry no
// (or a past) nextEarningsDate, so every swing popup read "—" and the
// "earnings within 5 days" cap never fired.
describe("Alpha Signals fills the next report date from the earnings calendar", () => {
  const today = "2026-11-19";
  const events = [
    { ticker: "COIN", date: "2027-02-12" }, { ticker: "COIN", date: "2026-11-21" }, { ticker: "COIN", date: "2026-10-30" },
    { ticker: "AAPL", date: "2027-01-29" },
  ];
  it("missing → the earliest upcoming report; past → replaced; a current one stays", () => {
    const out = withNextEarnings([
      { ticker: "COIN" } as CompanyDoc,
      { ticker: "AAPL", nextEarningsDate: "2026-10-29" } as CompanyDoc,
      { ticker: "MSFT", nextEarningsDate: "2027-01-27" } as CompanyDoc,
      { ticker: "ZZZ" } as CompanyDoc,
    ], events, today);
    assert.deepEqual(out.map(c => c.nextEarningsDate ?? null), ["2026-11-21", "2027-01-29", "2027-01-27", null]);
  });
  it("the hook reads the calendar and applies it", () => {
    const src = readFileSync(new URL("./useAlphaPicks.ts", import.meta.url), "utf8");
    assert.match(src, /useApiList<\{ ticker: string; date: string \}>\(enabled \? "\/market-data\/earnings" : null\)/);
    assert.match(src, /withNextEarnings\(/);
  });
});
