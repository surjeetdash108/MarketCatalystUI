import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tradingSessionsBack, week5Base } from "./movers-week5";
import type { Week5Close } from "./types/companies";

describe("weekly movers base date and calculation", () => {
  it("computes the unified 5-session base date (2026-10-20 for 2026-10-27)", () => {
    const base = tradingSessionsBack("2026-10-27", 5);
    assert.equal(base, "2026-10-20");
  });

  it("finds the close 5 sessions back even if closes has 7 bars", () => {
    const closes: Week5Close[] = [
      { date: "2026-10-19", close: 100 },
      { date: "2026-10-20", close: 105 },
      { date: "2026-10-21", close: 110 },
      { date: "2026-10-22", close: 115 },
      { date: "2026-10-23", close: 120 },
      { date: "2026-10-26", close: 125 },
      { date: "2026-10-27", close: 130 },
    ];
    const base = week5Base(closes, "2026-10-27");
    assert.equal(base, 105);
  });

  it("finds the close on the target date when closes has 5 bars", () => {
    const closes: Week5Close[] = [
      { date: "2026-10-20", close: 50 },
      { date: "2026-10-21", close: 51 },
      { date: "2026-10-22", close: 52 },
      { date: "2026-10-23", close: 53 },
      { date: "2026-10-26", close: 54 },
    ];
    const base = week5Base(closes, "2026-10-27");
    assert.equal(base, 50);
  });

  it("returns null if no bar exists on or before the target date", () => {
    const closes: Week5Close[] = [
      { date: "2026-10-22", close: 52 },
      { date: "2026-10-23", close: 53 },
      { date: "2026-10-26", close: 54 },
    ];
    const base = week5Base(closes, "2026-10-27");
    assert.equal(base, null);
  });
});
