import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { previous13fDeadline, previousFomcDecision, previousMonthlyOpex } from "./calendar-range";

describe("previous-event helpers (Stock Intelligence catalyst look-back)", () => {
  it("previousMonthlyOpex is the third Friday before the date", () => {
    assert.equal(previousMonthlyOpex("2026-11-10"), "2026-10-16");
    // On or after this month's expiry the previous one is this month's.
    assert.equal(previousMonthlyOpex("2026-11-21"), "2026-11-20");
    // Strictly before: the expiry day itself looks back a month.
    assert.equal(previousMonthlyOpex("2026-11-20"), "2026-10-16");
    // Rolls back across the year boundary.
    assert.equal(previousMonthlyOpex("2027-01-05"), "2026-12-18");
  });

  it("previousFomcDecision is the last decision day before the date, or null", () => {
    assert.equal(previousFomcDecision("2026-11-10"), "2026-10-28");
    assert.equal(previousFomcDecision("2026-10-28"), "2026-09-16");
    assert.equal(previousFomcDecision("2026-01-10"), null);
  });

  it("previous13fDeadline is the last filing deadline before the date", () => {
    // Deadlines are 45 days after quarter end: Feb 14, May 15, Aug 14, Nov 14.
    assert.equal(previous13fDeadline("2026-11-10"), "2026-08-14");
    // Nov 14 2026 is a Saturday, so the deadline is Monday the 16th.
    assert.equal(previous13fDeadline("2026-11-17"), "2026-11-16");
    assert.equal(previous13fDeadline("2026-03-01"), "2026-02-16");
    // Rolls back across the year boundary.
    assert.equal(previous13fDeadline("2026-02-01"), "2025-11-14");
  });
});
