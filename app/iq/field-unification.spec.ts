import { describe, it } from "node:test";
import assert from "node:assert";
import { resolve52WeekRange } from "./range52";
import { reportedQuarterEps } from "./types/financials";
import type { QuarterFinancials } from "./types";

describe("Item 2 Field Unification Tests", () => {
  describe("52-week High/Low Range Unification", () => {
    it("ANIP: unifies on 95.57 high", () => {
      const range = resolve52WeekRange({ high52: 95.57, low52: 48.0 }, { dayHigh: 94.0, dayLow: 49.0 });
      assert.strictEqual(range.high, 95.57);
      assert.strictEqual(range.low, 48.0);
    });

    it("ORCL: unifies on 285.46 high", () => {
      const range = resolve52WeekRange({ high52: 285.46, low52: 100.0 }, { dayHigh: 282.0, dayLow: 101.0 });
      assert.strictEqual(range.high, 285.46);
    });

    it("MSEX: unifies on 61.60 high", () => {
      const range = resolve52WeekRange({ high52: 61.60, low52: 45.0 }, { dayHigh: 60.5, dayLow: 46.0 });
      assert.strictEqual(range.high, 61.60);
    });
  });

  describe("Next-Q EPS estimate (CLAR 0.05 vs 0.06)", () => {
    it("picks immediate upcoming quarter rather than furthest future quarter", () => {
      const liveMatches = [
        { ticker: "CLAR", date: "2027-02-15", epsActual: null, epsEstimate: 0.05 },
        { ticker: "CLAR", date: "2026-11-06", epsActual: null, epsEstimate: 0.06 },
        { ticker: "CLAR", date: "2026-08-08", epsActual: 0.04, epsEstimate: 0.03 },
      ];
      const today = "2026-10-27";
      const upcomingRow = liveMatches
        .filter(e => e.epsActual == null && e.epsEstimate != null && (!today || e.date >= today))
        .sort((a, b) => a.date.localeCompare(b.date))[0];

      assert.strictEqual(upcomingRow?.epsEstimate, 0.06);
      assert.strictEqual(upcomingRow?.date, "2026-11-06");
    });
  });

  describe("Earnings tab reported EPS (Adj. EPS basis)", () => {
    it("CAT: reportedQuarterEps prefers non-GAAP 8.17 over GAAP 7.77", () => {
      const q: QuarterFinancials = {
        endDate: "2026-09-30",
        epsActual: 7.77,
        epsActualReported: 8.17,
      } as QuarterFinancials;
      assert.strictEqual(reportedQuarterEps(q), 8.17);
    });

    it("BAC: reportedQuarterEps prefers non-GAAP 1.08 over GAAP 0.91", () => {
      const q: QuarterFinancials = {
        endDate: "2026-09-30",
        epsActual: 0.91,
        epsActualReported: 1.08,
      } as QuarterFinancials;
      assert.strictEqual(reportedQuarterEps(q), 1.08);
    });

    it("REPX: reportedQuarterEps prefers non-GAAP 2.55 over GAAP 4.11", () => {
      const q: QuarterFinancials = {
        endDate: "2026-09-30",
        epsActual: 4.11,
        epsActualReported: 2.55,
      } as QuarterFinancials;
      assert.strictEqual(reportedQuarterEps(q), 2.55);
    });

    it("PNRG: reportedQuarterEps prefers non-GAAP 4.06 over GAAP 2.75", () => {
      const q: QuarterFinancials = {
        endDate: "2026-09-30",
        epsActual: 2.75,
        epsActualReported: 4.06,
      } as QuarterFinancials;
      assert.strictEqual(reportedQuarterEps(q), 4.06);
    });
  });
});
