import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withLiveQuote } from "./useAlphaPicks";
import { SCREENS } from "../alpha-signals-model";
import type { LiveQuote } from "../live-quotes-context";
import type { CompanyDoc } from "../types";

const q = (o: Partial<LiveQuote>): LiveQuote => ({
  price: null, pctChange: null, earlyPct: null, regularPct: null, marketStatus: "open", latePct: null,
  previousClose: null, regularClose: null, updatedAt: null, open: null, dayHigh: null, dayLow: null, dayVolume: null, ...o,
});
const rowsOf = (id: string, companies: CompanyDoc[]) =>
  SCREENS.find(s => s.id === id)!.rows({ companies, sigs: [], analyst: new Map(), ipos: [], now: Date.parse("2026-11-18T17:00:00Z") });

// Errors 12, 14–17, 22, 27: the 52-week figures were the stored ones, measured
// from an earlier price and without today's high/low — so "0.1% above its low
// of $9.58" sat beside a $9.32 price.
describe("52-week figures follow the price on screen and today's range", () => {
  it("MSTY: today's low below the stored low becomes the low; % measured from the live price", () => {
    const c = { ticker: "MSTY", price: 9.075, pctChange: -5, low52: 9.58, high52: 40.9, pctFromLow52: 0.1, pctFromHigh52: -76.55 } as CompanyDoc;
    const out = withLiveQuote(c, q({ price: 9.32, pctChange: -2.8, dayLow: 8.96, dayHigh: 9.7 }));
    assert.equal(out.low52, 8.96);
    assert.equal(Number(out.pctFromLow52?.toFixed(1)), 4.0);
  });
  it("UUP: a price above the stored high makes today's high the high", () => {
    const c = { ticker: "UUP", price: 29.62, pctChange: 0.2, high52: 29.57, low52: 26.4, pctFromHigh52: -0.1 } as CompanyDoc;
    const out = withLiveQuote(c, q({ price: 29.62, pctChange: 0.2, dayHigh: 29.64 }));
    assert.equal(out.high52, 29.64);
    assert.equal(Number(out.pctFromHigh52?.toFixed(2)), -0.07);
  });
  it("SGC: without a quote, the stored price still re-anchors (−0.3%/at the high, not −4.6%)", () => {
    const c = { ticker: "SGC", name: "Surgalign", sector: "Consumer Durables", type: "CS", price: 14.65, pctChange: 4.49, high52: 14.7, low52: 8.3, pctFromHigh52: -4.59, rvol: 1.5 } as CompanyDoc;
    const out = withLiveQuote(c, undefined);
    assert.equal(Number(out.pctFromHigh52?.toFixed(1)), -0.3);
    assert.match(rowsOf("brk", [out])[0].why, /0\.3% from its 52-week high/);
  });
  it("CUE: +53% off the low is not on New 52W Low", () => {
    const c = { ticker: "CUE", price: 4.32, pctChange: 52.5, low52: 2.83, high52: 45.5, pctFromLow52: 0 } as CompanyDoc;
    assert.equal(rowsOf("l52", [withLiveQuote(c, undefined)]).length, 0);
  });
  it("RHHBY: 3% below its high is not on New 52W High", () => {
    const c = { ticker: "RHHBY", price: 59.64, pctChange: -0.7, high52: 61.49, low52: 40.07, pctFromHigh52: -0.36 } as CompanyDoc;
    assert.equal(rowsOf("h52", [withLiveQuote(c, undefined)]).length, 0);
  });
  it("a doc without a 52-week range passes through unchanged", () => {
    const c = { ticker: "X", price: 1, pctChange: 0 } as CompanyDoc;
    assert.equal(withLiveQuote(c, undefined), c);
  });
});
