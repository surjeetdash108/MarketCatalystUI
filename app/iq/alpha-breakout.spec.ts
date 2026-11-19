import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCREENS } from "./alpha-signals-model";
import type { CompanyDoc } from "./types";

const rows = (companies: CompanyDoc[]) => SCREENS.find(s => s.id === "brk")!.rows({ companies, sigs: [], analyst: new Map(), ipos: [], now: 0 });
const co = (ticker: string, price: number, high52: number, o: Partial<CompanyDoc> = {}) =>
  ({ ticker, name: ticker, sector: "Technology", type: "CS", price, pctChange: 3, rvol: 2, high52, low52: price / 2, pctFromHigh52: (price / high52 - 1) * 100, week5ChangePct: 5, rsi14: 60, sma50: price * 0.9, ...o }) as CompanyDoc;

// Nov 19 rows 3–4: Breaking Out listed SAIL 3.4% and FROG 2.2% below their highs.
describe("Breaking Out follows its rule: within 1.5% of the 52W high, up 2%+, RVOL 1.5×+, not Extended", () => {
  it("SAIL (3.4% off) and FROG (2.2% off) are not on it; a name 1% off is", () => {
    const out = rows([co("SAIL", 22.72, 23.52, { pctChange: 2.11, rvol: 3.5 }), co("FROG", 119.21, 121.85, { pctChange: 4.22, rvol: 1.9 }), co("OK", 99, 100)]).map(r => r.ticker);
    assert.deepEqual(out, ["OK"]);
  });
  it("Extended names are left off (up 5%+ today, +25% in 5 days, RSI 80+, 40%+ over the 50-day)", () => {
    const ext = [co("A", 99, 100, { pctChange: 6 }), co("B", 99, 100, { week5ChangePct: 30 }), co("C", 99, 100, { rsi14: 82 }), co("D", 99, 100, { sma50: 60 })];
    assert.deepEqual(rows(ext), []);
  });
  it("needs up 2%+ and RVOL 1.5×+", () => {
    assert.deepEqual(rows([co("E", 99, 100, { pctChange: 1.5 }), co("F", 99, 100, { rvol: 1.2 })]), []);
  });
});
