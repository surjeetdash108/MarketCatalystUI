import { describe, it } from "node:test";
import assert from "node:assert";
import { tickFromQuoteRow } from "./quote-row";

// PEP after the 2026-10-26 close (FMP quote + after-hours trade, saved in the
// backend fixture after-close-quotes.json): official close 135.45 (−0.2357%
// from 135.77), after-hours trade 135.05.
const row = { ticker: "PEP", name: null, price: 135.45, pctChange: -0.23569, extended: { session: "after-hours" as const, price: 135.05, pctChange: (135.05 / 135.45 - 1) * 100, at: 1793047418000 } };

describe("tickFromQuoteRow", () => {
  it("the tick is the after-hours trade, its move measured from the same previous close", () => {
    const t = tickFromQuoteRow(row);
    assert.strictEqual(t.price, 135.05);
    assert.ok(Math.abs(t.pct! - (135.05 / 135.77 - 1) * 100) < 0.01);
    assert.strictEqual(t.at, 1793047418000);
  });
  it("no extended trade: the official close and its own move", () => {
    const t = tickFromQuoteRow({ ...row, extended: null });
    assert.deepStrictEqual([t.price, t.pct], [135.45, -0.23569]);
  });
});
