import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompanyDoc } from "./types";
import {
  actionOf, bearActionOf, dataFresh, issuerKey, isPickable, labelOf, pickBear, pickTop, planOf,
  scoreCompany, trendOf, MOMENTUM_CAP_BELOW_BOTH, DAY,
} from "./alpha-signals-model";

const NOW = Date.parse("2026-11-12T18:00:00Z");

/** A liquid, fresh, common-equity company above both averages; override per case. */
const co = (o: Partial<CompanyDoc> = {}): CompanyDoc => ({
  id: o.ticker ?? "TEST", ticker: "TEST", name: "Test Corp", price: 100, pctChange: 0.5, marketCap: 5e9,
  rvol: 1, peRatio: 20, rsRating: 70, techRating: null, revenueGrowthYoY: 0.1, epsGrowthYoY: 0.1,
  grossMargin: null, dividendYield: null, beta: 1, sector: "Technology Services", industry: null,
  rsi14: 60, macd: null, macdSignal: null, macdHistogram: 0.5, sma50: 90, sma200: 80,
  aboveSma50: true, aboveSma200: true, week5ChangePct: 2, monthChangePct: 4, high52: 110, low52: 60,
  avgVolume20: 2_000_000, realizedVol30: 30, sectorRank: null, sectorRankTotal: null, peers: null, source: null,
  exchange: "NASDAQ", quoteUpdatedAt: new Date(NOW - DAY).toISOString(), technicalsUpdatedAt: new Date(NOW - DAY).toISOString(),
  ...o,
});

describe("swing trend (§3.2): first match wins", () => {
  it("1 Weakening: 5D ≤ −3, or 5D < 0 and not above the 50-DMA", () => {
    assert.equal(trendOf(co({ week5ChangePct: -3 })), "Weakening");
    assert.equal(trendOf(co({ week5ChangePct: -0.5, price: 85 })), "Weakening");
  });
  it("2 Losing momentum: not above the 50-DMA with 5D flat or up", () => {
    assert.equal(trendOf(co({ week5ChangePct: 1, price: 85 })), "Losing momentum");
  });
  it("3 Under pressure: a −5% day above the 50-DMA", () => {
    assert.equal(trendOf(co({ week5ChangePct: 6, pctChange: -5 })), "Under pressure");
  });
  it("4 Pulling back: 5D ≥ +4 and red today", () => {
    assert.equal(trendOf(co({ week5ChangePct: 5, pctChange: -1 })), "Pulling back");
  });
  it("5 Emerging: 5D ≥ +4 and faster than 1M × 5/21 (or no 1M)", () => {
    assert.equal(trendOf(co({ week5ChangePct: 5, monthChangePct: 10 })), "Emerging");
    assert.equal(trendOf(co({ week5ChangePct: 5, monthChangePct: null })), "Emerging");
    assert.equal(trendOf(co({ week5ChangePct: 5, monthChangePct: 30 })), "Strengthening");
  });
  it("6 Strengthening / 7 Stable", () => {
    assert.equal(trendOf(co({ week5ChangePct: 1.5 })), "Strengthening");
    assert.equal(trendOf(co({ week5ChangePct: 1 })), "Stable");
  });
  it("uses the live price vs the 50-DMA over the lagging flag", () => {
    // Flag says above, live price is below → not above.
    assert.equal(trendOf(co({ week5ChangePct: 1, price: 85, aboveSma50: true })), "Losing momentum");
    // No average: the flag is the fallback.
    assert.equal(trendOf(co({ week5ChangePct: 1, sma50: null, aboveSma50: false })), "Losing momentum");
  });
});

describe("display labels (§3.3) are mirrored pairs", () => {
  it("Extended ↔ Oversold (checked first)", () => {
    assert.equal(labelOf(co({ week5ChangePct: 26 }), "Emerging"), "Extended");
    assert.equal(labelOf(co({ week5ChangePct: 3, pctChange: 5 }), "Strengthening"), "Extended");
    assert.equal(labelOf(co({ week5ChangePct: 3, rsi14: 80 }), "Strengthening"), "Extended");
    assert.equal(labelOf(co({ week5ChangePct: 3, price: 130 }), "Strengthening"), "Extended");
    assert.equal(labelOf(co({ week5ChangePct: -21, price: 70 }), "Weakening"), "Oversold");
    assert.equal(labelOf(co({ week5ChangePct: -5, rsi14: 24, price: 70 }), "Weakening"), "Oversold");
  });
  it("Breakout ↔ Breakdown", () => {
    assert.equal(labelOf(co({ price: 109, pctChange: 2.5, rvol: 1.6, week5ChangePct: 3 }), "Strengthening"), "Breakout");
    assert.equal(labelOf(co({ price: 61, pctChange: -2.5, rvol: 1.6, week5ChangePct: -6, rsi14: 35 }), "Weakening"), "Breakdown");
  });
  it("Recovering, Bouncing, Rolling over, Downtrend", () => {
    assert.equal(labelOf(co({ price: 87, week5ChangePct: 5 }), "Losing momentum"), "Recovering");
    assert.equal(labelOf(co({ price: 80, week5ChangePct: -5, pctChange: 2, rsi14: 40 }), "Weakening"), "Bouncing");
    assert.equal(labelOf(co({ price: 95, week5ChangePct: -4, pctChange: -1, rsi14: 45 }), "Weakening"), "Rolling over");
    assert.equal(labelOf(co({ price: 80, week5ChangePct: -4, pctChange: -1, rsi14: 40 }), "Weakening"), "Downtrend");
  });
});

describe("momentum (§3.1)", () => {
  it("is capped at 40 while price is below both averages", () => {
    const s = scoreCompany(co({ price: 70, sma50: 90, sma200: 80, rsi14: 60, macdHistogram: 1, week5ChangePct: 6 }), undefined, NOW)!;
    assert.ok((s.comps.find(c => c.key === "m")!.value as number) <= MOMENTUM_CAP_BELOW_BOTH);
  });
});

describe("bullish actions (§3.4)", () => {
  const act = (o: Partial<CompanyDoc>, score: number, cov = 100) => {
    const c = co(o);
    return actionOf(c, score, trendOf(c), cov, NOW).key;
  };
  it("Weakening → Avoid (bullish rules); Losing momentum / Under pressure / Stable → Watch", () => {
    assert.equal(act({ week5ChangePct: -4 }, 60), "avoid");
    assert.equal(act({ week5ChangePct: -4 }, 90), "avoid");
    assert.equal(act({ week5ChangePct: 1, price: 85 }, 90), "watch");
    assert.equal(act({ week5ChangePct: 6, pctChange: -6 }, 90), "watch");
    assert.equal(act({ week5ChangePct: 0.5 }, 90), "watch");
  });
  it("rising: data < 70 → Watch; < 60 → Watch; 60–74 → Building; 75+ → Setup active", () => {
    assert.equal(act({ week5ChangePct: 2 }, 90, 65), "watch");
    assert.equal(act({ week5ChangePct: 2 }, 59), "watch");
    assert.equal(act({ week5ChangePct: 2 }, 70), "alert");
    assert.equal(act({ week5ChangePct: 2 }, 75), "act");
  });
  it("caps on 75+: earnings soon, deep rebound, Extended, illiquid → Building", () => {
    assert.equal(act({ week5ChangePct: 2, nextEarningsDate: "2026-11-15" }, 80), "alert");
    assert.equal(act({ week5ChangePct: 2, high52: 250 }, 80), "alert");
    assert.equal(act({ week5ChangePct: 30 }, 80), "alert");
    assert.equal(act({ week5ChangePct: 2, avgVolume20: 100_000 }, 80), "alert");
    assert.equal(act({ week5ChangePct: 2, nextEarningsDate: "2026-12-30" }, 80), "act");
  });
});

describe("bearish actions (§3.5), on the shown score", () => {
  const weak = (o: Partial<CompanyDoc> = {}) => co({ price: 80, week5ChangePct: -5, pctChange: -1, rsi14: 40, high52: 110, ...o });
  const bear = (o: Partial<CompanyDoc>, score: number, cov = 100) => {
    const c = weak(o);
    return bearActionOf(c, score, trendOf(c), cov, NOW).key;
  };
  it("Watch: not Weakening, data < 70, rallying +3%, score > 45", () => {
    const strong = co();
    assert.equal(bearActionOf(strong, 20, trendOf(strong), 100, NOW).key, "watch");
    assert.equal(bear({}, 20, 60), "watch");
    assert.equal(bear({ pctChange: 3 }, 20), "watch");
    assert.equal(bear({}, 46), "watch");
  });
  it("Building at 31–45, Setup active at ≤ 30 with no cap", () => {
    assert.equal(bear({}, 40), "alert");
    assert.equal(bear({}, 30), "act");
  });
  it("caps on ≤ 30: bounce, washed-out RSI, deep drop, crash week, small cap, illiquid", () => {
    assert.equal(bear({ pctChange: 1.6 }, 25), "alert");
    assert.equal(bear({ rsi14: 24 }, 25), "alert");
    assert.equal(bear({ high52: 200 }, 25), "alert");
    assert.equal(bear({ week5ChangePct: -21 }, 25), "alert");
    assert.equal(bear({ marketCap: 400e6 }, 25), "alert");
    assert.equal(bear({ avgVolume20: 10_000 }, 25), "alert");
  });
});

describe("plans (§3.6)", () => {
  it("long: stop just below a nearby 50-DMA, else the cap", () => {
    const near = planOf(co({ price: 100, sma50: 95 }), "Moderate", "bull");
    assert.equal(near.stop, "$94.05");
    assert.equal(near.size, "Standard");
    const far = planOf(co({ price: 100, sma50: 80 }), "High", "bull");
    assert.equal(far.stop, "$90.00");
    assert.equal(far.size, "Small");
    assert.equal(far.stopPct, "−10%");
  });
  it("short: cover stop just above a nearby 50-DMA, else the cap", () => {
    const near = planOf(co({ price: 100, sma50: 104 }), "Elevated", "bear");
    assert.equal(near.stop, "$105.04");
    assert.equal(near.size, "Reduced");
    assert.equal(near.entry, "$99.00 – $102.00");
    const far = planOf(co({ price: 100, sma50: 130 }), "Low", "bear");
    assert.equal(far.stop, "$107.00");
  });
});

describe("hygiene (§3.7)", () => {
  it("common equity only", () => {
    assert.equal(isPickable(co()), true);
    assert.equal(isPickable(co({ name: "Some Income Fund" })), false);
    assert.equal(isPickable(co({ name: "Ultra 2x Long ETF" })), false);
    assert.equal(isPickable(co({ name: "Grayscale Bitcoin Trust" })), false);
    assert.equal(isPickable(co({ name: "Northern Trust Corporation" })), true);
    assert.equal(isPickable(co({ sector: null })), false);
  });
  it("fresh data: no OTC, quotes and technicals within 5 days", () => {
    assert.equal(dataFresh(co(), NOW), true);
    assert.equal(dataFresh(co({ exchange: "OTC" }), NOW), false);
    assert.equal(dataFresh(co({ technicalsUpdatedAt: new Date(NOW - 6 * DAY).toISOString() }), NOW), false);
    assert.equal(dataFresh(co({ quoteUpdatedAt: null, technicalsUpdatedAt: null }), NOW), true);
  });
  it("one line per issuer", () => {
    assert.equal(issuerKey({ ticker: "GOOGL", name: "Alphabet Inc. Class A" }), issuerKey({ ticker: "GOOG", name: "Alphabet Inc. Class C" }));
    assert.equal(issuerKey({ ticker: "BRK.A", name: null }), issuerKey({ ticker: "BRK.B", name: null }));
  });
});

describe("pick lists", () => {
  const sig = (o: Partial<CompanyDoc>) => scoreCompany(co(o), undefined, NOW)!;
  it("bullish: rising only, data ≥ 70, deduped, highest first; bearish: Weakening, Setup active first then lowest", () => {
    const up1 = sig({ ticker: "AAA", name: "Aaa Inc", rsRating: 95, week5ChangePct: 3 });
    const up2 = sig({ ticker: "BBB", name: "Bbb Inc", rsRating: 60, week5ChangePct: 3 });
    const dup = sig({ ticker: "AAAB", name: "Aaa Inc Class B", rsRating: 90, week5ChangePct: 3 });
    const flat = sig({ ticker: "CCC", name: "Ccc Inc", week5ChangePct: 0 });
    const down = sig({ ticker: "DDD", name: "Ddd Inc", price: 70, week5ChangePct: -6, pctChange: -1, rsi14: 40, rsRating: 10, epsGrowthYoY: -0.5, revenueGrowthYoY: -0.2, macdHistogram: -1 });
    const bull = pickTop([up2, flat, dup, down, up1], 10, NOW).map(s => s.c.ticker);
    assert.deepEqual(bull, ["AAA", "BBB"]);
    const bearList = pickBear([up1, down], 10, NOW).map(s => s.c.ticker);
    assert.ok(!bearList.includes("AAA"));
    for (const t of bull) assert.ok(!bearList.includes(t), "never in both lists");
  });
});
