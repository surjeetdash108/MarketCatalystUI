import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fiftyTwoWeekBars, resolve52WeekRange } from "./range52";

// Real Polygon daily bars 2025-10-22 … 2026-10-23 (shared with the backend's
// technical-indicators-52w.spec). Daily bars are stamped at ET midnight.
const fx = JSON.parse(readFileSync(new URL("./fixtures/52w-fixtures.json", import.meta.url), "utf-8"));
const toBars = (rows: Array<{ barDate: string; open: number; high: number; low: number; close: number; volume: number }>) =>
  rows.map((r) => ({ t: Date.parse(`${r.barDate}T04:00:00Z`), o: r.open, h: r.high, l: r.low, c: r.close, v: r.volume }));

describe("fiftyTwoWeekBars (Oct 23 2026 close)", () => {
  for (const [t, field, expected] of [["SFM", "high", 107.31], ["GS", "low", 754], ["CAT", "low", 521.43]] as const) {
    it(`${t} 52-week ${field} matches the public ${expected}`, () => {
      const w = fiftyTwoWeekBars(toBars(fx[t]));
      const v = field === "high" ? Math.max(...w.map((b) => b.h)) : Math.min(...w.map((b) => b.l));
      assert.strictEqual(v, expected);
    });
  }
});

describe("fiftyTwoWeekBars before the 20:00 ET rollover (Oct 26 2026 after the close)", () => {
  const fx2 = JSON.parse(readFileSync(new URL("./fixtures/52w-rollover-oct26.json", import.meta.url), "utf-8"));
  const AT_17_ET = Date.parse("2026-10-26T21:00:00Z");
  for (const [t, expected] of [["ANIP", 96.57], ["MSEX", 62.18], ["ORCL", 287]] as const) {
    it(`${t} 52-week high matches the public ${expected}`, () => {
      const w = fiftyTwoWeekBars(toBars(fx2[t]), AT_17_ET);
      assert.ok(Math.abs(Math.max(...w.map((b) => b.h)) - expected) <= expected * 0.005);
    });
  }
});

describe("resolve52WeekRange unifies range across stock page and SI (Item 2)", () => {
  it("uses stored high52/low52 and widens by live session high/low", () => {
    const range = resolve52WeekRange(
      { high52: 95.57, low52: 45.0 },
      { dayHigh: 96.2, dayLow: 46.5 },
    );
    assert.strictEqual(range.high, 96.2);
    assert.strictEqual(range.low, 45.0);
  });

  it("supports stock.hi / stock.lo aliases from Stock Intelligence", () => {
    const range = resolve52WeekRange(
      { high: 285.46, low: 110.0 },
      { dayHigh: 280.0, dayLow: 108.5 },
    );
    assert.strictEqual(range.high, 285.46);
    assert.strictEqual(range.low, 108.5);
  });

  it("falls back to completed bars when source high52 is missing", () => {
    const bars = toBars(fx["SFM"]);
    const range = resolve52WeekRange(null, { dayHigh: 108.0, dayLow: 60.0 }, bars);
    assert.strictEqual(range.high, 108.0);
  });
});

