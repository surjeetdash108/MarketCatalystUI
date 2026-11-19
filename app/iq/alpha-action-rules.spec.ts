import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { actionOf, bearActionOf, screenAction, type Signal } from "./alpha-signals-model";
import type { CompanyDoc } from "./types";

const NOW = Date.parse("2026-11-19T15:00:00Z");
const c = (o: Partial<CompanyDoc>): CompanyDoc => ({ ticker: "X", name: "X", sector: "Technology", type: "CS", price: 100, pctChange: 0, avgVolume20: 5e6, marketCap: 5e11, rsi14: 45, week5ChangePct: -5, pctFromHigh52: -20, high52: 125, ...o } as CompanyDoc);

describe("Emergence Action rules — bearish side (published)", () => {
  it("Watch: data under 70%", () => assert.equal(bearActionOf(c({}), 20, "Weakening", 60, NOW).key, "watch"));
  it("Watch: up 3%+ today", () => assert.equal(bearActionOf(c({ pctChange: 3.2 }), 20, "Weakening", 100, NOW).key, "watch"));
  it("Watch: score above 45", () => assert.equal(bearActionOf(c({}), 46, "Weakening", 100, NOW).key, "watch"));
  it("Building: score 31–45", () => assert.equal(bearActionOf(c({}), 40, "Weakening", 100, NOW).key, "alert"));
  it("Building: 30 or lower but capped (up 1.5%+ today)", () => assert.equal(bearActionOf(c({ pctChange: 1.8 }), 25, "Weakening", 100, NOW).key, "alert"));
  it("Setup active: 30 or lower with no caps", () => assert.equal(bearActionOf(c({}), 25, "Weakening", 100, NOW).key, "act"));
  it("never Avoid on the bearish side", () => {
    for (const s of [10, 30, 40, 50, 80]) for (const p of [-5, 0, 2, 4]) assert.notEqual(bearActionOf(c({ pctChange: p }), s, "Weakening", 100, NOW).key, "avoid");
  });
});

describe("Emergence Action rules — bullish side (published)", () => {
  it("Avoid: trend is Weakening (any score)", () => {
    assert.equal(actionOf(c({}), 40, "Weakening", 100, NOW).key, "avoid");
    assert.equal(actionOf(c({}), 90, "Weakening", 100, NOW).key, "avoid");
  });
});

describe("screens show the side's action: a Weakening stock uses the bearish rules (Nov 19 rows 6–8, Logic #1)", () => {
  const sig = (ticker: string, score: number, pctChange: number) => {
    const co = c({ ticker, pctChange });
    return { c: co, score, coverage: 100, trend: "Weakening", action: actionOf(co, score, "Weakening", 100, NOW), bear: bearActionOf(co, score, "Weakening", 100, NOW) } as unknown as Signal;
  };
  const cases: Array<[string, number, number]> = [
    ["NVDA", 49, 3.86], ["GOOG", 55, 4.37], ["GOOGL", 53, 4.08], ["MU", 73, 6.51], ["META", 61, -0.5],
    ["PLTR", 58, 2.2], ["ORCL", 45, 3.1], ["GE", 70, -1.2], ["ABBV", 68, 0.4],
  ];
  for (const [t, score, pct] of cases) {
    it(`${t} (score ${score}, ${pct >= 0 ? "+" : ""}${pct}% today) → Watch, not Avoid`, () => {
      const a = screenAction(sig(t, score, pct));
      assert.equal(a.key, "watch");
      assert.equal(a.bear, true);
    });
  }
  it("a rising stock keeps the bullish action", () => {
    const co = c({ pctChange: 1, week5ChangePct: 4 });
    const s = { c: co, score: 80, coverage: 100, trend: "Emerging", action: actionOf(co, 80, "Emerging", 100, NOW), bear: bearActionOf(co, 80, "Emerging", 100, NOW) } as unknown as Signal;
    assert.deepEqual([screenAction(s).key, screenAction(s).bear], [s.action.key, false]);
  });
  it("the detail panel uses screenAction", () => {
    const src = readFileSync(new URL("./screens/alpha-signals.tsx", import.meta.url), "utf8");
    assert.match(src, /<Pill k=\{scrAct\.key\} text=\{scrAct\.short\} bear=\{scrAct\.bear\} \/>/);
  });
});
