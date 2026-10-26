import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fiftyTwoWeekBars } from "./range52";

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
