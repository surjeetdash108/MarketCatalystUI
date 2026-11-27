import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analystLead,
  analystRowText,
  archiveOrder,
  breadthForSession,
  catalystSummary,
  contributorBars,
  contributorsFromQuotes,
  countdown,
  dayLabel,
  earningsSummary,
  epsLine,
  extendedMove,
  figure,
  focusDayLabel,
  focusPrice,
  guidanceLabel,
  marketHeadline,
  revenueLine,
  sessionMove,
  signedPoints,
  versusLabel,
} from "./wmn-model";
import type { WmnQuote } from "./wmn-model";
import type { WmnAnalysts, WmnCatalyst, WmnEarningsItem, WmnWeight } from "./types/wmn";

const base = { phase: "closed" as const, spx: 0.62, ndx: 0.91, vix: 14.2, breadth: { advancers: 941, decliners: 497, total: 1462 } };

describe("marketHeadline", () => {
  it("states the close from numbers on the page", () => {
    assert.equal(
      marketHeadline(base),
      "Stocks closed higher: the S&P 500 gained 0.62% and the Nasdaq 0.91%, with 941 of the 1,462 stocks we track advancing and 497 declining, and the VIX at 14.20.",
    );
  });

  it("uses present tense while the market is open", () => {
    assert.match(marketHeadline({ ...base, phase: "open" })!, /^Stocks are higher: the S&P 500 is up 0.62% and the Nasdaq 0.91%/);
  });

  it("gives the Nasdaq its own clause when it went the other way (but only just)", () => {
    // -0.05% is inside the flat band, so the day is not "mixed"; it still must
    // not read as though the Nasdaq gained too.
    const s = marketHeadline({ ...base, ndx: -0.05 })!;
    assert.match(s, /^Stocks closed higher: the S&P 500 gained 0.62%, while the Nasdaq lost 0.05%/);
  });

  it("calls opposite moves mixed rather than picking a side", () => {
    assert.match(marketHeadline({ ...base, spx: 0.4, ndx: -0.5 })!, /^Stocks closed mixed/);
  });

  it("calls a sub-0.1% move little changed", () => {
    assert.match(marketHeadline({ ...base, spx: 0.04, ndx: 0.02 })!, /^Stocks closed little changed/);
  });

  it("says sharply on a big day", () => {
    assert.match(marketHeadline({ ...base, spx: -2.1, ndx: -2.8 })!, /^Stocks closed sharply lower/);
  });

  it("never asserts a cause", () => {
    const s = marketHeadline(base)!;
    assert.doesNotMatch(s, /\b(led|driven|because|on fears|amid|as yields)\b/i);
  });

  it("drops clauses it has no number for, and refuses without the S&P move", () => {
    assert.equal(marketHeadline({ ...base, breadth: null, vix: null })!, "Stocks closed higher: the S&P 500 gained 0.62% and the Nasdaq 0.91%.");
    assert.equal(marketHeadline({ ...base, spx: null }), null);
  });
});

describe("breadthForSession", () => {
  const b = (date: string) => ({ date, advancers: 941, decliners: 497, unchanged: 24 });
  it("keeps breadth that belongs to the last session", () => {
    // Thanksgiving (26 Nov 2026) is a full closure: the last session is Wed 25 Nov.
    assert.deepEqual(breadthForSession(b("2026-11-25"), new Date("2026-11-26T20:00:00Z")), b("2026-11-25"));
    // Sunday evening: the last session is Friday.
    assert.deepEqual(breadthForSession(b("2026-11-20"), new Date("2026-11-22T23:00:00Z")), b("2026-11-20"));
  });
  it("drops yesterday's breadth once today's session is under way", () => {
    // Fri 27 Nov, 10:00 ET: the live index move is today's, the newest settled count is not.
    assert.equal(breadthForSession(b("2026-11-25"), new Date("2026-11-27T15:00:00Z")), null);
    assert.deepEqual(breadthForSession(b("2026-11-27"), new Date("2026-11-27T15:00:00Z")), b("2026-11-27"));
  });
  it("treats pre-market as still belonging to the previous session", () => {
    assert.deepEqual(breadthForSession(b("2026-11-27"), new Date("2026-11-30T12:00:00Z")), b("2026-11-27")); // Mon 07:00 ET
  });
  it("is null without breadth", () => {
    assert.equal(breadthForSession(null, new Date()), null);
    assert.equal(breadthForSession(undefined, new Date()), null);
  });
});

describe("contributorBars", () => {
  const rows = [
    { ticker: "A", name: "A", changePct: 2, weightPct: 7, contributionPct: 0.14 },
    { ticker: "B", name: "B", changePct: -1, weightPct: 3.5, contributionPct: -0.07 },
    { ticker: "C", name: "C", changePct: 0.1, weightPct: 1, contributionPct: 0.001 },
  ];
  it("scales to the biggest bar and keeps tiny ones visible", () => {
    const w = contributorBars(rows).map((r) => r.widthPct);
    assert.deepEqual(w, [100, 50, 4]);
  });
  it("is safe on all-zero input", () => {
    assert.deepEqual(contributorBars([{ ...rows[0], contributionPct: 0 }]).map((r) => r.widthPct), [0]);
  });
  it("prints signed points without negative zero", () => {
    assert.equal(signedPoints(0.14), "+0.14");
    assert.equal(signedPoints(-0.071), "-0.07");
    assert.equal(signedPoints(-0.001), "0.00");
  });
});

describe("contributorsFromQuotes", () => {
  const weights: WmnWeight[] = Array.from({ length: 40 }, (_, i) => ({ ticker: `T${i}`, name: `N${i}`, weightPct: 7 - i * 0.15 }));
  const quote = (over: Partial<WmnQuote>): WmnQuote => ({ price: 100, regularClose: 100, marketStatus: "closed", pctChange: 0, lastSessionPct: null, ...over });
  const quotesFor = (move: (i: number) => number, over: Partial<WmnQuote> = {}) =>
    new Map(weights.map((w, i) => [w.ticker, quote({ lastSessionPct: move(i), pctChange: 0, ...over })]));

  it("multiplies weight by the completed session's move when the market is closed", () => {
    const out = contributorsFromQuotes(weights, quotesFor((i) => (i === 0 ? 2 : i === 1 ? -3 : i % 2 ? 0.2 : -0.2)), 2)!;
    // T0: 7.00 × 2% = +0.14 pts; T1: 6.85 × -3% = -0.2055 pts (kept to 3 dp) → T1 is bigger.
    assert.deepEqual(out.map((r) => r.ticker), ["T1", "T0"]);
    assert.equal(out[0].contributionPct, -0.205);
    assert.equal(out[1].contributionPct, 0.14);
  });

  it("reads the live move while the session is open", () => {
    const q = quote({ marketStatus: "open", pctChange: 1.5, lastSessionPct: null });
    assert.equal(sessionMove(q), 1.5);
  });

  it("does not use the pre-market print when a completed session's move exists", () => {
    const q = quote({ marketStatus: "early_trading", pctChange: 0, lastSessionPct: -1.1 });
    assert.equal(sessionMove(q), -1.1);
  });

  it("falls back to pctChange when there is no session move", () => {
    assert.equal(sessionMove(quote({ lastSessionPct: undefined, pctChange: 0.4 })), 0.4);
    assert.equal(sessionMove(undefined), null);
  });

  it("draws nothing for a flat tape rather than five empty bars", () => {
    assert.equal(contributorsFromQuotes(weights, quotesFor(() => 0)), null);
  });

  it("draws nothing when too few names have a quote", () => {
    const some = new Map([...quotesFor(() => 1)].slice(0, 10));
    assert.equal(contributorsFromQuotes(weights, some), null);
  });
});

describe("countdown", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  it("counts down in hours and minutes", () => {
    assert.deepEqual(countdown("2026-11-26T14:15:00Z", now), { text: "in 2h 15m", state: "upcoming" });
    assert.deepEqual(countdown("2026-11-26T14:00:00Z", now), { text: "in 2h", state: "upcoming" });
    assert.deepEqual(countdown("2026-11-26T12:40:00Z", now), { text: "in 40m", state: "upcoming" });
    assert.deepEqual(countdown("2026-11-26T12:00:30Z", now), { text: "in <1m", state: "upcoming" });
  });
  it("says due once the time has passed", () => {
    assert.deepEqual(countdown("2026-11-26T11:59:00Z", now), { text: "due now", state: "due" });
  });
});

describe("dayLabel", () => {
  const now = new Date("2026-11-26T15:00:00Z");
  it("labels today, tomorrow and later days on the New York calendar", () => {
    assert.equal(dayLabel("2026-11-26", now), "Today");
    assert.equal(dayLabel("2026-11-27", now), "Tomorrow");
    assert.equal(dayLabel("2026-12-03", now), "Thu, Dec 3");
  });
});

describe("figure / versusLabel / catalystSummary", () => {
  it("attaches the unit the way the feed prints it", () => {
    assert.equal(figure(3.4, "%"), "3.4%");
    assert.equal(figure(225, "K"), "225K");
    assert.equal(figure(1250, null), "1,250");
    assert.equal(figure(null, "%"), "—");
  });
  it("is neutral about direction", () => {
    assert.equal(versusLabel("above"), "Above forecast");
    assert.equal(versusLabel("below"), "Below forecast");
    assert.equal(versusLabel("in-line"), "In line with forecast");
    assert.doesNotMatch(versusLabel("above") + versusLabel("below"), /beat|miss/i);
  });
  it("summarises ahead vs out", () => {
    const c = (status: WmnCatalyst["status"]) => ({ status }) as WmnCatalyst;
    assert.match(catalystSummary([]), /No major economic releases/);
    assert.equal(catalystSummary([c("upcoming"), c("upcoming"), c("released")]), "2 major releases ahead in the next 24 hours, 1 already out.");
    assert.equal(catalystSummary([c("released")]), "1 major release printed in the last few hours.");
  });
});

describe("earnings copy", () => {
  const item = (over: Partial<WmnEarningsItem> = {}): WmnEarningsItem => ({
    ticker: "NVDA",
    name: "NVIDIA",
    marketCap: 4e12,
    session: "AMC",
    date: "2026-11-26",
    reported: true,
    eps: { actual: 1.3, estimate: 1.25, surprisePct: 4 },
    revenue: { actual: 57.0e9, estimate: 55.0e9, surprisePct: 3.6 },
    guidance: { direction: "raised", range: null },
    reactionPct: 2.1,
    ...over,
  });
  it("shows actual vs estimate with the surprise", () => {
    assert.equal(epsLine(item()), "EPS $1.30 vs $1.25 est. (+4.0%)");
    assert.equal(revenueLine(item()), "Revenue $57.00B vs $55.00B est. (+3.6%)");
  });
  it("puts the minus sign before the dollar sign for a loss, as seen on a real small-cap (ENLV, -4.48)", () => {
    const loss = item({ eps: { actual: null, estimate: -4.48, surprisePct: null }, revenue: { actual: -2.5e6, estimate: null, surprisePct: null } });
    assert.equal(epsLine(loss), "EPS est. -$4.48");
    assert.equal(revenueLine(loss), "Revenue -$2.5M");
    assert.doesNotMatch(epsLine(loss), /\$-/);
    assert.equal(epsLine(item({ eps: { actual: -0.31, estimate: -0.2, surprisePct: -55 } })), "EPS -$0.31 vs -$0.20 est. (-55.0%)");
  });
  it("shows only the estimate before a report", () => {
    const pre = item({ reported: false, eps: { actual: null, estimate: 1.25, surprisePct: null }, revenue: { actual: null, estimate: null, surprisePct: null } });
    assert.equal(epsLine(pre), "EPS est. $1.25");
    assert.equal(revenueLine(pre), null);
  });
  it("labels guidance by what the company said, never as a view", () => {
    assert.deepEqual(guidanceLabel({ direction: "raised", range: null }), { text: "Guidance raised ↑", tone: "up" });
    assert.deepEqual(guidanceLabel({ direction: "cut", range: null }), { text: "Guidance cut ↓", tone: "down" });
    assert.deepEqual(guidanceLabel({ direction: null, range: "$9 to $9.5" }), { text: "Guidance: $9 to $9.5", tone: "flat" });
    assert.equal(guidanceLabel(null), null);
  });
  it("reads the after-hours move off the regular close, and only off-hours", () => {
    const q = { price: 102.1, regularClose: 100, marketStatus: "late_trading" };
    const m = extendedMove(q)!;
    assert.equal(m.label, "After hours");
    assert.ok(Math.abs(m.pct - 2.1) < 1e-9);
    assert.equal(extendedMove({ ...q, marketStatus: "early_trading" })!.label, "Pre-market");
    assert.equal(extendedMove({ ...q, marketStatus: "closed" })!.label, "Extended hours");
    assert.equal(extendedMove({ ...q, marketStatus: "open" }), null);
    assert.equal(extendedMove({ ...q, regularClose: null }), null);
    assert.equal(extendedMove({ ...q, price: 100 }), null); // nothing traded away from the close
    assert.equal(extendedMove(undefined), null);
  });
  it("says how many reports are behind the list", () => {
    assert.equal(earningsSummary(5, 3), "The 3 biggest of 5 reports today, by market cap.");
    assert.equal(earningsSummary(2, 2), "The 2 companies reporting today, by market cap.");
    assert.equal(earningsSummary(1, 1), "One company reports today.");
    // No floor on size, so the line must never call the names notable or important.
    for (const [c, s] of [[5, 3], [2, 2], [1, 1]] as const) assert.doesNotMatch(earningsSummary(c, s), /notable|important/i);
  });
});

describe("Stock in Focus helpers", () => {
  const now = new Date("2026-11-26T20:00:00Z"); // Thu 26 Nov 2026, 15:00 ET
  it("labels the day: Today, then weekday and date, with the year once it is not this year", () => {
    assert.equal(focusDayLabel("2026-11-26", now), "Today");
    assert.equal(focusDayLabel("2026-11-25", now), "Wed, Nov 25");
    assert.equal(focusDayLabel("2025-11-25", now), "Tue, Nov 25, 2025");
  });
  it("uses New York's today, not UTC's", () => {
    // 02:00 UTC on the 27th is still the evening of the 26th in New York.
    assert.equal(focusDayLabel("2026-11-26", new Date("2026-11-27T02:00:00Z")), "Today");
  });
  it("formats a live price, and says nothing without one", () => {
    assert.equal(focusPrice({ price: 1234.5 }), "$1,234.50");
    assert.equal(focusPrice({ price: 99 }), "$99.00");
    assert.equal(focusPrice({ price: null }), null);
    assert.equal(focusPrice(undefined), null);
  });
  it("orders the archive newest day first whatever order it arrives in", () => {
    const e = (day: string) => ({ day, ticker: "X", headline: "h", note: "", createdAt: "", updatedAt: "" });
    assert.deepEqual(archiveOrder([e("2026-11-24"), e("2026-11-26"), e("2026-11-25")]).map((x) => x.day), ["2026-11-26", "2026-11-25", "2026-11-24"]);
    const input = [e("2026-11-24"), e("2026-11-26")];
    archiveOrder(input);
    assert.equal(input[0].day, "2026-11-24"); // does not reorder the caller's array
  });
});

describe("analyst copy", () => {
  const a: WmnAnalysts = { since: "2026-11-25", upgrades: 12, downgrades: 7, initiations: 1, ptRaises: 30, ptCuts: 8, rows: [] };
  it("leads with plain counts", () => {
    assert.equal(analystLead(a), "Since Wed: 12 upgrades, 7 downgrades and 1 initiation; 30 price-target raises and 8 cuts.");
  });
  it("copes with an empty window", () => {
    assert.match(analystLead({ ...a, upgrades: 0, downgrades: 0, initiations: 0, ptRaises: 0, ptCuts: 0 }), /No analyst rating changes/);
  });
  it("quotes what the firm did", () => {
    assert.equal(
      analystRowText({ ticker: "NVDA", name: "NVIDIA", firm: "Morgan Stanley", action: "upgrade", previousGrade: "Equal-Weight", newGrade: "Overweight", priceTarget: 210, priceTargetChange: "raise" }),
      "Morgan Stanley upgraded NVDA to Overweight (from Equal-Weight), target $210",
    );
    assert.equal(
      analystRowText({ ticker: "X", name: "X", firm: null, action: "initiate", previousGrade: null, newGrade: "Buy", priceTarget: null, priceTargetChange: null }),
      "A firm initiated coverage of X at Buy",
    );
  });
});
