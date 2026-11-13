// Why It Moved labelled NVDA's −9.26% on 5 Nov 2026 with "Here's What $10,000
// Invested in SpaceX and Nvidia Could Be Worth by 2030" (audit, 13 Nov). The
// headlines below are the real ones from NVDA's feed around each move.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { explainScore, isHoldingsNote, isSolicitation, mentionedDayOffset, pickMoveHeadline, pickRecentMove } from "./move-headline";
import { getSixMonthMajorEvents, usableSummary } from "./data";

const day = (d: string) => Date.parse(`${d}T00:00:00Z`);
const art = (publishedAt: string, headline: string) => ({ publishedAt, headline });

describe("pickMoveHeadline", () => {
  it("5 Nov −9.26%: the selloff story, not the '$10,000 invested by 2030' piece", () => {
    const news = [
      art("2026-11-05T01:10:00Z", "Here's What $10,000 Invested in SpaceX and Nvidia Could Be Worth by 2030"),
      art("2026-11-05T16:33:00Z", "Nvidia Is the Biggest Bet in Your Index Fund. Here's What Its Drop Just Cost You"),
      art("2026-11-05T17:27:00Z", "Why Nvidia Stock Is Getting Punished Today"),
      art("2026-11-05T18:42:00Z", "Jim Cramer Says Nvidia Should Buy Shares on Thursday's 8% Drop: 'If the Cheapest Asset is Your Stock, You Should Buy It'"),
      art("2026-11-05T21:32:00Z", "Nvidia Plunges 9% as AI Selloff Wipes Out $2.3 Trillion | Closing Bell"),
      art("2026-11-05T22:00:00Z", "Nvidia Investors Need to Be Paying Attention on Nov. 17"),
    ];
    const got = pickMoveHeadline(news, { moveDay: day("2026-11-05"), ret: -9.26, prevDay: day("2026-11-04") });
    assert.equal(got?.headline, "Why Nvidia Stock Is Getting Punished Today");
  });

  it("12 Nov −4.34%: the after-hours CEO news from the evening before counts; that day's own rebound story does not", () => {
    const news = [
      art("2026-11-11T10:03:00Z", "Nvidia shares rebound 4% as Huang faces scrutiny ahead of earnings"),
      art("2026-11-11T20:13:00Z", "Nvidia: Why I'm Buying The Fear"),
      art("2026-11-11T22:51:00Z", "Nvidia stock falls 7% after report board is preparing to oust Jensen Huang after second affair"),
      art("2026-11-12T15:00:00Z", "Is Nvidia a Bad-News Buy or a Stock to Avoid?"),
    ];
    const got = pickMoveHeadline(news, { moveDay: day("2026-11-12"), ret: -4.34, prevDay: day("2026-11-11") });
    assert.match(String(got?.headline), /falls 7% after report board is preparing to oust/);
  });

  it("27 Jul −4.99%: 'Why Nvidia Stock Fell Today' published that night, not a 'more gains ahead' piece", () => {
    const news = [
      art("2026-07-27T15:17:00Z", "Nvidia Has Given a Massive Boost to This AI Infrastructure Stock. Buy It Before It Doubles"),
      art("2026-07-27T16:25:00Z", "Could AMD Dethrone Nvidia?"),
      art("2026-07-27T19:33:00Z", "Alphabet's Massive AI Investment Push Signals More Gains Ahead for Nvidia"),
      art("2026-07-28T03:18:00Z", "Why Nvidia Stock Fell Today"),
    ];
    const got = pickMoveHeadline(news, { moveDay: day("2026-07-27"), ret: -4.99, prevDay: day("2026-07-24") });
    assert.equal(got?.headline, "Why Nvidia Stock Fell Today");
  });

  it("14 Sep −3.36%: nothing explains the drop, so no headline rather than the dividend story", () => {
    const news = [
      art("2026-09-14T11:30:00Z", "Nvidia Returned a Record $26 Billion to Shareholders. Here's Why That Matters."),
      art("2026-09-14T19:30:00Z", "Nvidia Stock Could Get a Boost From CoreWeave's Latest Announcement"),
    ];
    assert.equal(pickMoveHeadline(news, { moveDay: day("2026-09-14"), ret: -3.36, prevDay: day("2026-09-11") }), null);
  });

  it("an up move takes an up headline", () => {
    const news = [
      art("2026-08-27T21:00:00Z", "Nvidia stock drops after hours as guidance disappoints"),
      art("2026-08-27T22:00:00Z", "Nvidia shares jump 8% as data center revenue tops estimates"),
    ];
    const got = pickMoveHeadline(news, { moveDay: day("2026-08-27"), ret: 8.74, prevDay: day("2026-08-26") });
    assert.match(String(got?.headline), /jump 8%/);
  });

  it("ignores articles from after the evening following the session", () => {
    const news = [art("2026-11-06T15:00:00Z", "Why Nvidia Stock Fell on Thursday")];
    assert.equal(pickMoveHeadline(news, { moveDay: day("2026-11-05"), ret: -9.26, prevDay: day("2026-11-04") }), null);
  });

  it("a Monday move looks back to Friday's close, so weekend news counts", () => {
    const news = [art("2026-11-08T14:00:00Z", "Nvidia shares slide in weekend trading after export curbs report")];
    const got = pickMoveHeadline(news, { moveDay: day("2026-11-09"), ret: -4.27, prevDay: day("2026-11-06") });
    assert.ok(got);
  });
});

describe("explainScore", () => {
  it("filler, questions and first-person opinion stay below the bar even with a direction word", () => {
    assert.ok(explainScore("Nvidia Stock Fell. Should You Buy the Dip?", -3) < 30);
    assert.ok(explainScore("My 3 Favorite AI Stocks to Buy During the Chip Sell-Off", -3) < 30);
    assert.ok(explainScore("Nvidia: Why I'm Buying The Fear", -3) < 30);
    // Zacks' recurring template, not news about the day (picked for TSLA's 21 Aug move in testing).
    assert.ok(explainScore("Tesla (TSLA) Up 8% Since Last Earnings Report: Can It Continue?", 5.1) < 30);
  });
  it("an event alone is not enough; an event with the move is", () => {
    assert.ok(explainScore("NVDA Earnings: What Active ETFs Can Do", -3) < 30);
    assert.ok(explainScore("Nvidia slides as CEO Jensen Huang resigns", -3) >= 30);
  });
});

describe("getSixMonthMajorEvents uses it", () => {
  it("labels the 5 Nov drop with the explaining headline", () => {
    // 20 flat sessions, then a −9% day on 5 Nov.
    const start = day("2026-10-08");
    const bars = Array.from({ length: 21 }, (_, i) => ({ t: start + i * 86_400_000, o: 100, h: 100, l: 100, c: 100, v: 1 }));
    bars.push({ t: day("2026-11-05"), o: 91, h: 91, l: 91, c: 91, v: 1 });
    const news = [
      art("2026-11-05T01:10:00Z", "Here's What $10,000 Invested in SpaceX and Nvidia Could Be Worth by 2030"),
      art("2026-11-05T21:32:00Z", "Nvidia Plunges 9% as AI Selloff Wipes Out $2.3 Trillion | Closing Bell"),
    ];
    const evs = getSixMonthMajorEvents("NVDA", { t: "NVDA", name: "NVIDIA Corporation" } as never, bars, [], news, []);
    const nov5 = evs.find((e) => e.mv < -8);
    assert.equal(nov5?.label, "Nvidia Plunges 9% as AI Selloff Wipes Out $2.3 Trillion | Closing Bell");
  });
});

// NVDA's last sessions as the live feed had them on 13 Nov 2026 (daily % moves),
// after 118 ordinary sessions around the stock's 1.6% median.
const nvdaMoves = () => {
  const tail = [-1.26, 2.29, -3.17, -9.26, 2.78, -4.27, -5.47, 2.87, -4.34]; // 2 Nov … 12 Nov
  const head = Array.from({ length: 118 }, (_, i) => (i % 2 ? 1.6 : -1.6));
  return [...head, ...tail].map((r, i) => ({ idx: i + 1, ret: r, absRet: Math.abs(r) }));
};

describe("pickRecentMove", () => {
  it("NVDA: the 5 Nov pick leaves the scandal days off the chart, so the biggest recent unusual move (10 Nov −5.47%) is added", () => {
    const moves = nvdaMoves();
    const n = moves.length + 1; // bars
    const nov5 = moves[moves.length - 6]; // −9.26
    assert.equal(nov5.ret, -9.26);
    const got = pickRecentMove(moves, [nov5], n);
    assert.equal(got?.ret, -5.47);
  });

  it("nothing is added when a latest-session move is already on the chart", () => {
    const moves = nvdaMoves();
    const n = moves.length + 1;
    const nov10 = moves[moves.length - 3];
    assert.equal(pickRecentMove(moves, [moves[moves.length - 6], nov10], n), null);
  });

  it("nothing is added when the latest sessions were ordinary", () => {
    const moves = Array.from({ length: 127 }, (_, i) => ({ idx: i + 1, ret: i % 2 ? 1.2 : -1.2, absRet: 1.2 }));
    assert.equal(pickRecentMove(moves, [moves[10]], 128), null);
  });

  it("a quiet stock: 2% is unusual, 1.5% is not (never below the 2% floor)", () => {
    const quiet = (last: number) => {
      const m = Array.from({ length: 127 }, (_, i) => ({ idx: i + 1, ret: 0.4, absRet: 0.4 }));
      m[124] = { idx: 125, ret: last, absRet: Math.abs(last) };
      return m;
    };
    assert.equal(pickRecentMove(quiet(2.2), [], 128)?.idx, 125);
    assert.equal(pickRecentMove(quiet(1.5), [], 128), null);
  });

  it("a volatile stock needs a big move: 3% is routine when the median day is 2%", () => {
    const m = Array.from({ length: 127 }, (_, i) => ({ idx: i + 1, ret: 2, absRet: 2 }));
    m[125] = { idx: 126, ret: -3, absRet: 3 };
    assert.equal(pickRecentMove(m, [], 128), null);
  });

  it("two equal recent moves: the later one wins", () => {
    const m = Array.from({ length: 127 }, (_, i) => ({ idx: i + 1, ret: 1, absRet: 1 }));
    m[122] = { idx: 123, ret: -5, absRet: 5 };
    m[125] = { idx: 126, ret: -5, absRet: 5 };
    assert.equal(pickRecentMove(m, [], 128)?.idx, 126);
  });

  it("only sessions inside the latest five count", () => {
    const m = Array.from({ length: 127 }, (_, i) => ({ idx: i + 1, ret: 1, absRet: 1 }));
    m[121] = { idx: 122, ret: -9, absRet: 9 }; // 6th from the end of 128 bars
    assert.equal(pickRecentMove(m, [], 128), null);
  });

  it("no moves, no pick", () => {
    assert.equal(pickRecentMove([], [], 0), null);
  });
});

describe("isHoldingsNote", () => {
  it("stake filings are holdings notes", () => {
    assert.ok(isHoldingsNote("NVIDIA Corporation $NVDA Shares Acquired by First County Bank CT"));
    assert.ok(isHoldingsNote("Smith Capital Sells 1,200 Shares of NVIDIA Corporation $NVDA"));
    assert.ok(isHoldingsNote("Jones Advisors Raises Position in NVIDIA Corporation"));
    assert.ok(isHoldingsNote("First County Bank grew its stake in NVIDIA"));
  });
  it("real company news is not", () => {
    assert.ok(!isHoldingsNote("Nvidia to acquire Groq in a $20 billion deal"));
    assert.ok(!isHoldingsNote("Nvidia CEO Jensen Huang resigns amid probe"));
    assert.ok(!isHoldingsNote("Nvidia stock falls 7% after report board is preparing to oust Jensen Huang"));
    assert.ok(!isHoldingsNote("Nvidia sells chips to Gulf states under new export licences"));
  });
});

describe("the Why It Moved chart as a whole", () => {
  const stock = { t: "NVDA", name: "NVIDIA Corporation" } as never;
  const D = 86_400_000;
  const start = day("2026-08-03");
  const iso = (i: number) => new Date(start + i * D).toISOString().slice(0, 10);
  /** n sessions of ±1%, with `moves` = { session index: fractional move } overriding. */
  const series = (n: number, moves: Record<number, number>) => {
    const bars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
    let c = 100;
    for (let i = 0; i < n; i++) {
      if (i > 0) c *= 1 + (moves[i] ?? (i % 2 ? 0.01 : -0.01));
      bars.push({ t: start + i * D, o: c, h: c, l: c, c, v: 1 });
    }
    return bars;
  };

  it("the junk that used to fill a card's notable events is gone; the real events stay", () => {
    const bars = series(60, { 50: -0.09 });
    const at = (h: number, headline: string, summary = "", d = 50) => ({ publishedAt: `${iso(d)}T${String(h).padStart(2, "0")}:00:00Z`, headline, summary });
    const news = [
      at(13, "Nvidia plunges 9% as CEO Jensen Huang resigns"),
      // The three that used to appear as the move's "notable events":
      at(14, "NVIDIA Corporation $NVDA Shares Acquired by First County Bank CT", "First County Bank CT acquired a new stake in NVIDIA."),
      at(15, "Breakfast News: Did Nvidia Just Favor Marvell?", "Marvell agreed to acquire Lumentum in a $15 billion deal."),
      at(16, "Nvidia Stock Just Crashed 22%. Jim Cramer Says It's the Cheapest in a Decade", "The stock could settle near its lows.", 49),
      // Real ones:
      at(12, "Commerce Dept opens probe into Nvidia chip diversion"),
      at(11, "Nvidia raises third-quarter guidance on data center demand"),
    ];
    const card = getSixMonthMajorEvents("NVDA", stock, bars, [], news, []).find((e) => e.mv < -8.9);
    assert.ok(card, "the −9% day has a card");
    assert.equal(card.label, "Nvidia plunges 9% as CEO Jensen Huang resigns");
    const text = (card.context ?? []).map((c) => `${c.kind}: ${c.text}`).join("\n");
    assert.match(text, /Legal \/ Regulatory: Commerce Dept opens probe/);
    assert.match(text, /Guidance: Nvidia raises third-quarter guidance/);
    assert.doesNotMatch(text, /First County/);
    assert.doesNotMatch(text, /Marvell/);
    assert.doesNotMatch(text, /Cramer/);
  });

  it("safety net: a recent unusual move no pick covers gets an extra card, in date order", () => {
    // Five old −8% days take every pick; the latest session is quiet, so the
    // "latest session" rule does not apply, but session 56 (−4%) is the news.
    const old = { 5: -0.08, 15: -0.08, 25: -0.08, 35: -0.08, 45: -0.08 };
    const bars = series(60, { ...old, 56: -0.04 });
    const events = getSixMonthMajorEvents("NVDA", stock, bars, [], [], []);
    assert.equal(events.length, 6);
    assert.deepEqual(events.map((e) => e.num), [1, 2, 3, 4, 5, 6]);
    assert.ok(events[5].mv < -3.9 && events[5].mv > -4.1, `last card is the −4% move, got ${events[5].mv}`);
    assert.ok(events.slice(0, 5).every((e) => e.mv < -7.9), "the five old −8% days are all still there");
  });

  it("no extra card when the latest sessions were ordinary", () => {
    const old = { 5: -0.08, 15: -0.08, 25: -0.08, 35: -0.08, 45: -0.08 };
    assert.equal(getSixMonthMajorEvents("NVDA", stock, series(60, old), [], [], []).length, 5);
  });

  it("when the latest session itself is the big one, the existing rule covers it and nothing is added", () => {
    const old = { 5: -0.08, 15: -0.08, 25: -0.08, 35: -0.08, 45: -0.08 };
    const events = getSixMonthMajorEvents("NVDA", stock, series(60, { ...old, 59: -0.05 }), [], [], []);
    assert.equal(events.length, 5);
    assert.ok(events[events.length - 1].mv < -4.9, "the latest session is the last card");
  });
});

describe("isSolicitation", () => {
  it("law-firm releases from NVDA's feed are solicitations", () => {
    assert.ok(isSolicitation("SHAREHOLDER ALERT: Bronstein Gewirtz & Grossman, LLC Announces Class Action Against NVIDIA Corporation (NASDAQ: NVDA) — Investors Who Suffered Losses Are Encouraged to Contact the Firm"));
    assert.ok(isSolicitation("NVDA INVESTOR ALERT: Hagens Berman Updates NVIDIA Corporation Securities Class Action Investigation"));
    assert.ok(isSolicitation("NVDA INVESTOR DEADLINE APPROACHING: Faruqi & Faruqi, LLP Reminds NVIDIA (NASDAQ: NVDA) Investors of Securities Class Action Lawsuit Deadline on January 8, 2027"));
    assert.ok(isSolicitation("NVDA CLASS ACTION UPDATE: Rosen Law Firm Expands Class Period to Include More NVIDIA Corporation Investors"));
    assert.ok(isSolicitation("NVDA Investors Have Opportunity to Lead NVIDIA Corporation Securities Class Action Lawsuit"));
  });
  it("real legal and regulatory news is not", () => {
    assert.ok(!isSolicitation("Nvidia hit with lawsuit over China chip exports"));
    assert.ok(!isSolicitation("Class action filed against Nvidia over China sales"));
    assert.ok(!isSolicitation("Commerce Dept opens probe into Nvidia chip diversion"));
    assert.ok(!isSolicitation("Nvidia CEO Jensen Huang has no obvious successor as Chinese 'spy' affair puts job at risk"));
  });
});

describe("notable events on a card", () => {
  const start = day("2026-08-03");
  const iso = (i: number) => new Date(start + i * 86_400_000).toISOString().slice(0, 10);
  const bars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
  let c = 100;
  for (let i = 0; i < 60; i++) {
    if (i > 0) c *= 1 + (i === 50 ? -0.09 : i % 2 ? 0.01 : -0.01);
    bars.push({ t: start + i * 86_400_000, o: c, h: c, l: c, c, v: 1 });
  }
  const stock = { t: "NVDA", name: "NVIDIA Corporation" } as never;
  const at = (hh: number, headline: string, summary = "") => ({ publishedAt: `${iso(50)}T${String(hh).padStart(2, "0")}:00:00Z`, headline, summary });
  const news = [
    at(13, "Nvidia Plunges 9% as AI Selloff Wipes Out $2.3 Trillion"),
    // Said "outlook" without being guidance (NVDA, 5 Nov):
    at(14, "This Is the Number That Could Change Nvidia Stock's Outlook for 2027", "One price target reframes the case."),
    at(15, "Intel Drops 5%, NVIDIA Retreats 2% After AMD Earnings Beat and Strong 2027 Outlook as Intel Falls 3%"),
    // Law-firm ads around the scandal:
    at(16, "NVDA INVESTOR DEADLINE APPROACHING: Faruqi & Faruqi, LLP Reminds NVIDIA (NASDAQ: NVDA) Investors of Securities Class Action Lawsuit Deadline"),
    // Real ones:
    at(12, "Nvidia raises third-quarter guidance on data center demand"),
    at(11, "Commerce Dept opens probe into Nvidia chip diversion"),
  ];
  const events = getSixMonthMajorEvents("NVDA", stock, bars, [], news, []);
  const card = events.find((e) => e.mv < -8.9);
  const text = (card?.context ?? []).map((x) => `${x.kind}: ${x.text}`).join("\n");

  it("keeps real guidance and a real probe", () => {
    assert.match(text, /Guidance: Nvidia raises third-quarter guidance/);
    assert.match(text, /Legal \/ Regulatory: Commerce Dept opens probe/);
  });
  it("drops 'outlook' price-target pieces, another company's earnings story and law-firm ads", () => {
    assert.doesNotMatch(text, /Change Nvidia Stock's Outlook/);
    assert.doesNotMatch(text, /Intel Drops 5%/);
    assert.doesNotMatch(text, /Faruqi/);
  });
});

describe("recaps of an earlier session", () => {
  it("AMD Mon 9 Nov +13.3%: Friday's 'Stock Market Today, Nov. 6' recap does not explain it; the Monday story does", () => {
    const news = [
      art("2026-11-06T21:40:00Z", "Stock Market Today, Nov. 6: AMD Surges 11% on Record Quarterly Revenue and Stronger Growth Outlook"),
      art("2026-11-09T14:10:00Z", "AMD stock jumps 13% as OpenAI expands its chip order"),
    ];
    const got = pickMoveHeadline(news, { moveDay: day("2026-11-09"), ret: 13.26, prevDay: day("2026-11-06") });
    assert.equal(got?.headline, "AMD stock jumps 13% as OpenAI expands its chip order");
  });

  it("with only the recap in the window, no headline is shown", () => {
    const news = [art("2026-11-06T21:40:00Z", "Stock Market Today, Nov. 6: AMD Surges 11% on Record Quarterly Revenue")];
    assert.equal(pickMoveHeadline(news, { moveDay: day("2026-11-09"), ret: 13.26, prevDay: day("2026-11-06") }), null);
  });

  it("a recap that names the session itself is the right story", () => {
    const news = [art("2026-11-10T21:30:00Z", "Stock Market Today, Nov. 10: Nvidia Stock Plunges 5.5% as CEO Scandal Overshadows Its Upcoming Earnings Report")];
    const got = pickMoveHeadline(news, { moveDay: day("2026-11-10"), ret: -5.47, prevDay: day("2026-11-09") });
    assert.match(String(got?.headline), /Nov\. 10: Nvidia Stock Plunges 5\.5%/);
  });

  it("a date ahead of the move (an event or deadline) does not disqualify the story", () => {
    const news = [art("2026-11-12T01:00:00Z", "Nvidia stock falls 4% as CEO resigns ahead of Nov. 17 earnings")];
    const got = pickMoveHeadline(news, { moveDay: day("2026-11-12"), ret: -4.34, prevDay: day("2026-11-11") });
    assert.ok(got);
  });
});

describe("mentionedDayOffset", () => {
  const d = day("2026-11-09");
  it("reads 'Nov. 6', 'Nov 6', 'November 6' and counts days from the session", () => {
    assert.equal(mentionedDayOffset("Stock Market Today, Nov. 6: AMD Surges", d), -3);
    assert.equal(mentionedDayOffset("Nvidia slides on Nov 9", d), 0);
    assert.equal(mentionedDayOffset("Fed decision November 12 in focus", d), 3);
  });
  it("ignores dates with a year, and words that only start like a month", () => {
    assert.equal(mentionedDayOffset("Lead Plaintiff Deadline: January 8, 2027", d), null);
    assert.equal(mentionedDayOffset("Market 5 stocks to watch", d), null);
    assert.equal(mentionedDayOffset("Mayor 2 says chips are safe", d), null);
    assert.equal(mentionedDayOffset("Nvidia falls as the market opens lower", d), null);
  });
  it("wraps the year: Dec. 30 named on a January move is last year's", () => {
    assert.equal(mentionedDayOffset("Stocks slide: Dec. 30 recap", day("2027-01-04")), -5);
  });
});

describe("usableSummary", () => {
  it("a quote stamp is not a description", () => {
    assert.equal(usableSummary("NASDAQ · As of 4:00 PM ET 11/05/26"), null);
    assert.equal(usableSummary("NYSE: As of 4:00 PM ET 11/05/26"), null);
  });
  it("empty and very short summaries are not either", () => {
    assert.equal(usableSummary(""), null);
    assert.equal(usableSummary(undefined), null);
    assert.equal(usableSummary("Nvidia slides."), null);
  });
  it("a real summary is kept as written", () => {
    const t = "Nvidia stock hasn't been this low since April. Nvidia's expected revenue growth is supply constrained.";
    assert.equal(usableSummary(`  ${t} `), t);
  });
  it("a card whose article has only a stamp falls back to the move text", () => {
    const start = Date.parse("2026-08-03T00:00:00Z");
    const bars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
    let c = 100;
    for (let i = 0; i < 40; i++) {
      if (i > 0) c *= 1 + (i === 30 ? -0.09 : i % 2 ? 0.01 : -0.01);
      bars.push({ t: start + i * 86_400_000, o: c, h: c, l: c, c, v: 1 });
    }
    const d = new Date(start + 30 * 86_400_000).toISOString().slice(0, 10);
    const news = [{ publishedAt: `${d}T21:00:00Z`, headline: "Nvidia Slides on AI Chip Selloff as Election Uncertainty Weighs", summary: "NASDAQ · As of 4:00 PM ET 11/05/26" }];
    const ev = getSixMonthMajorEvents("NVDA", { t: "NVDA", name: "NVIDIA Corporation" } as never, bars, [], news, []).find((e) => e.mv < -8.9);
    assert.equal(ev?.label, "Nvidia Slides on AI Chip Selloff as Election Uncertainty Weighs");
    assert.match(String(ev?.details), /^Stock moved −9\.00% that session\.$/);
  });
});

describe("events that carry a direction", () => {
  it("a CEO stepping down, a downgrade, a probe or cut guidance can explain a drop, and never a rise", () => {
    for (const h of [
      "Jensen Huang steps down: the hands-on kingmaker behind the AI boom",
      "Bernstein downgrades Nvidia to Market Perform",
      "Commerce Dept opens probe into Nvidia chip diversion",
      "Nvidia cuts third-quarter guidance on China curbs",
      "Nvidia CEO resigns after board investigation",
    ]) {
      assert.ok(explainScore(h, -5) >= 30, `explains a drop: ${h}`);
      assert.ok(explainScore(h, 5) < 30, `does not explain a rise: ${h}`);
    }
  });

  it("an upgrade, a buyback or raised guidance can explain a rise, and never a drop", () => {
    for (const h of [
      "Oppenheimer upgrades AMD to Outperform with a $600 target",
      "Nvidia announces a $60 billion buyback",
      "Nvidia raises third-quarter guidance on data center demand",
      "AMD posts record revenue and beats estimates",
    ]) {
      assert.ok(explainScore(h, 5) >= 30, `explains a rise: ${h}`);
      assert.ok(explainScore(h, -5) < 30, `does not explain a drop: ${h}`);
    }
  });

  it("an event word alone, with no direction, still explains nothing", () => {
    assert.ok(explainScore("NVDA Earnings: What Active ETFs Can Do", -3) < 30);
    assert.ok(explainScore("Nvidia CEO to speak at the Nov. 17 earnings call", -3) < 30);
    assert.ok(explainScore("Nvidia outlook for 2027: what analysts expect", 3) < 30);
  });
});

describe("pickMoveHeadline: the optional story bonus", () => {
  const move = { moveDay: day("2026-11-05"), ret: -9.26, prevDay: day("2026-11-04") };
  const a = art("2026-11-05T17:00:00Z", "Nvidia stock falls 8% as AI selloff deepens");
  const b = art("2026-11-05T18:00:00Z", "Nvidia shares plunge 9% on AI chip selloff");
  it("ranks two headlines that both explain the move by the bonus, then by closeness to the close", () => {
    assert.equal(pickMoveHeadline([a, b], move, (x) => (x === a ? 15 : 0))?.headline, a.headline);
    assert.equal(pickMoveHeadline([a, b], move, (x) => (x === b ? 15 : 0))?.headline, b.headline);
  });
  it("never lets a headline in: a big bonus does not rescue one that does not explain the move", () => {
    const fluff = art("2026-11-05T16:00:00Z", "Here's What $10,000 Invested in SpaceX and Nvidia Could Be Worth by 2030");
    assert.equal(pickMoveHeadline([fluff], move, () => 100), null);
  });
});
