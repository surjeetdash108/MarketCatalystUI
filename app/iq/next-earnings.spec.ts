import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { nextEarningsDate, withOneUpcomingReport } from "./next-earnings";

// Deployed /market-data/earnings + /live/company, 2026-10-26: the calendar holds
// two upcoming rows for one report (ANIP Nov 5 + Nov 6, IRMD Oct 30 + Nov 2),
// and Stock Intelligence showed a second earnings card for the later one.
const fx = JSON.parse(readFileSync(new URL("./fixtures/next-earnings.json", import.meta.url), "utf-8"));
const TODAY = "2026-10-26";

describe("one next-earnings date for every screen", () => {
  for (const [t, expected] of [["ANIP", "2026-11-05"], ["IRMD", "2026-10-30"], ["PEP", "2027-02-02"]] as const) {
    it(`${t}: next report ${expected}, and the calendar keeps one upcoming card for it`, () => {
      const d = nextEarningsDate(fx[t].stored, fx[t].events, TODAY);
      assert.strictEqual(d, expected);
      const upcoming = withOneUpcomingReport(fx[t].events, d, TODAY).filter((e: { date: string }) => e.date >= TODAY);
      assert.deepStrictEqual(upcoming.map((e: { date: string }) => e.date), [expected]);
    });
  }
  it("past reports are kept", () => {
    const kept = withOneUpcomingReport(fx.ANIP.events, "2026-11-05", TODAY);
    assert.ok(kept.some((e: { date: string }) => e.date === "2026-08-07"));
  });
});
