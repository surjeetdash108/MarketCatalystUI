import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moneyDayPossessive } from "./market-status";

// Instants are UTC; November 2026 is EST (UTC-5).
describe("moneyDayPossessive (Money Flow subtitle, ET calendar)", () => {
  it("is today's on a trading day, at any hour", () => {
    assert.equal(moneyDayPossessive(new Date("2026-11-16T15:00:00Z")), "today's"); // Mon 10:00 ET
    assert.equal(moneyDayPossessive(new Date("2026-11-16T05:30:00Z")), "today's"); // Mon 00:30 ET
  });

  it("names Friday on a weekend", () => {
    assert.equal(moneyDayPossessive(new Date("2026-11-14T17:00:00Z")), "Friday's"); // Sat
    assert.equal(moneyDayPossessive(new Date("2026-11-16T04:59:00Z")), "Friday's"); // Sun 23:59 ET
  });

  it("judges the day in ET, not UTC", () => {
    // Sat 03:00 UTC is still Friday 22:00 in New York.
    assert.equal(moneyDayPossessive(new Date("2026-11-14T03:00:00Z")), "today's");
  });

  it("names the last session before a holiday", () => {
    assert.equal(moneyDayPossessive(new Date("2026-11-26T17:00:00Z")), "Wednesday's"); // Thanksgiving
    assert.equal(moneyDayPossessive(new Date("2026-04-04T16:00:00Z")), "Thursday's"); // Sat after Good Friday
  });
});
