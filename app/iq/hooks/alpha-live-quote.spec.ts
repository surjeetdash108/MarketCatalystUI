import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { metricsWithQuote, withLiveQuote } from "./useAlphaPicks";
import type { LiveQuote } from "../live-quotes-context";
import type { CompanyDoc } from "../types";
import type { SessionMetrics } from "../alpha-intraday";

const q = (o: Partial<LiveQuote>): LiveQuote => ({
  price: null, pctChange: null, earlyPct: null, regularPct: null, marketStatus: "open", latePct: null,
  previousClose: null, regularClose: null, updatedAt: null, open: null, dayHigh: null, dayLow: null, dayVolume: null, ...o,
});

describe("Alpha Signals uses the same live price as Market Catalyst", () => {
  it("lays the live quote's price and change over the stored doc, as one pair", () => {
    const c = { ticker: "NVDA", price: 154.62, pctChange: 1.2 } as CompanyDoc;
    const out = withLiveQuote(c, q({ price: 154, pctChange: 0.8 }));
    assert.equal(out.price, 154);
    assert.equal(out.pctChange, 0.8);
    assert.equal(withLiveQuote(c, undefined), c);
  });
  it("brings intraday price up to a newer quote; keeps bar levels", () => {
    const m = { session: "2026-11-18", price: 100, chg: 0.01, priorClose: 99, dayHigh: 101, dayLow: 98, vwap: 99.5, lastBarAt: 1_000_000 } as SessionMetrics;
    const newer = metricsWithQuote(m, q({ price: 102, pctChange: 3, updatedAt: 1_000_000 + 10 * 60_000 }), "2026-11-18");
    assert.equal(newer.price, 102);
    assert.equal(newer.chg, 0.03);
    assert.equal(newer.dayHigh, 102);
    assert.equal(newer.vwap, 99.5);
    // An older quote, or a quote for another session, doesn't override the bars.
    assert.equal(metricsWithQuote(m, q({ price: 102, updatedAt: 1_000_000 }), "2026-11-18"), m);
    assert.equal(metricsWithQuote(m, q({ price: 102 }), "2026-11-19"), m);
  });
  it("every pick popup, bullish and bearish, has View Full Chart", () => {
    const src = readFileSync(new URL("../screens/alpha-signals.tsx", import.meta.url), "utf8");
    assert.equal(src.match(/<Foot onExplore=\{onExplore\} onViewFullChart=\{onViewFullChart\} \/>/g)?.length, 4);
  });
});
